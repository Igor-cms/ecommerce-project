import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-topic, x-shopify-hmac-sha256, x-shopify-shop-domain',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read raw body for HMAC verification
    const rawBody = await req.text();
    
    // Verify Shopify HMAC signature
    const shopifyHmac = req.headers.get('x-shopify-hmac-sha256');
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.error('SHOPIFY_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (shopifyHmac) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
      const computedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));

      if (computedHmac !== shopifyHmac) {
        console.error('Invalid HMAC signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.warn('No HMAC header present — rejecting request');
      return new Response(JSON.stringify({ error: 'Missing HMAC' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = JSON.parse(rawBody);
    const orderId = String(order.id);
    const orderName = order.name || `#${order.order_number}`;

    console.log(`Webhook received: order ${orderName} (${orderId})`);

    // Use service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if order was already processed
    const { data: existing } = await supabaseAdmin
      .from('inventory_deductions')
      .select('id')
      .eq('shopify_order_id', orderId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Order ${orderName} already processed, skipping`);
      return new Response(JSON.stringify({ status: 'already_processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all variant mappings and raw materials
    const { data: allMappings } = await supabaseAdmin
      .from('raw_material_variants')
      .select('*');
    const { data: allMaterials } = await supabaseAdmin
      .from('raw_materials')
      .select('*');

    const deductions: Array<{ material_name: string; qty_deducted: number; variant_id: string }> = [];

    for (const lineItem of (order.line_items || [])) {
      const variantId = String(lineItem.variant_id);
      const quantity = lineItem.quantity || 0;

      // Find mapping for this variant
      const mapping = (allMappings || []).find((m: any) => String(m.shopify_variant_id) === variantId);
      if (!mapping) continue;

      const material = (allMaterials || []).find((m: any) => m.id === mapping.raw_material_id);
      if (!material) continue;

      const deductionAmount = mapping.quantity_per_unit * quantity;
      const newQty = Math.max(0, material.quantity_available - deductionAmount);

      // Deduct from raw material
      const { error: updateError } = await supabaseAdmin
        .from('raw_materials')
        .update({ quantity_available: newQty })
        .eq('id', material.id);

      if (updateError) {
        console.error(`Failed to deduct from ${material.name}:`, updateError);
        continue;
      }

      // Update in-memory for subsequent line items using same material
      material.quantity_available = newQty;

      // Log the deduction
      await supabaseAdmin
        .from('inventory_deductions')
        .insert({
          shopify_order_id: orderId,
          shopify_order_name: orderName,
          raw_material_id: material.id,
          shopify_variant_id: variantId,
          quantity_deducted: deductionAmount,
          shopify_product_name: lineItem.title || mapping.shopify_product_name || null,
          shopify_variant_title: lineItem.variant_title || mapping.shopify_variant_title || null,
        });

      deductions.push({
        material_name: material.name,
        qty_deducted: deductionAmount,
        variant_id: variantId,
      });

      console.log(`Deducted ${deductionAmount}${material.unit} from ${material.name} (order ${orderName})`);
    }

    // If no line items matched any mapping, still mark order as processed
    if (deductions.length === 0) {
      await supabaseAdmin
        .from('inventory_deductions')
        .insert({
          shopify_order_id: orderId,
          shopify_order_name: orderName,
          raw_material_id: null,
          shopify_variant_id: null,
          quantity_deducted: 0,
        });
      console.log(`Order ${orderName} had no mapped variants, marked as processed`);
    }

    console.log(`Order ${orderName} processed: ${deductions.length} deductions`);

    // ============================================================
    // Push affected variant stock to Shopify immediately (sibling variants)
    // ============================================================
    try {
      const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
      const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

      if (!storeName || !accessToken) {
        console.warn('Shopify credentials missing; skipping sibling stock push');
      } else if (deductions.length > 0) {
        const affectedMaterialIds = Array.from(
          new Set(
            deductions
              .map((d) => (allMaterials || []).find((m: any) => m.name === d.material_name)?.id)
              .filter(Boolean)
          )
        ) as string[];

        const siblingMappings = (allMappings || []).filter((m: any) =>
          affectedMaterialIds.includes(m.raw_material_id)
        );

        const variantStock: Record<string, { stock: number; productName: string; variantTitle: string }> = {};
        for (const m of siblingMappings) {
          const mat = (allMaterials || []).find((mm: any) => mm.id === m.raw_material_id);
          if (!mat) continue;
          const available = Math.max(0, Math.floor(mat.quantity_available / m.quantity_per_unit));
          const vid = String(m.shopify_variant_id);
          if (variantStock[vid]) {
            variantStock[vid].stock = Math.min(variantStock[vid].stock, available);
          } else {
            variantStock[vid] = {
              stock: available,
              productName: m.shopify_product_name || '',
              variantTitle: m.shopify_variant_title || '',
            };
          }
        }

        // Equalize across product+title groups (mirrors sync-inventory)
        const groups: Record<string, string[]> = {};
        for (const [vid, info] of Object.entries(variantStock)) {
          const key = `${(info.productName || '').toLowerCase().trim()}::${(info.variantTitle || '').toLowerCase().trim()}`;
          (groups[key] ||= []).push(vid);
        }
        for (const vids of Object.values(groups)) {
          if (vids.length <= 1) continue;
          const minStock = Math.min(...vids.map((v) => variantStock[v].stock));
          for (const v of vids) variantStock[v].stock = minStock;
        }

        const variantIds = Object.keys(variantStock);
        if (variantIds.length > 0) {
          const graphqlUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`;
          const gqlHeaders = { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' };

          const locRes = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/locations.json`, { headers: gqlHeaders });
          const locData = await locRes.json();
          const locationId = locData.locations?.[0]?.id;
          if (!locationId) throw new Error('No Shopify location found');
          const locationGid = `gid://shopify/Location/${locationId}`;

          const inventoryMap: Record<string, string> = {};
          const variantGids = variantIds.map((v) => `gid://shopify/ProductVariant/${v}`);
          for (let g = 0; g < variantGids.length; g += 50) {
            const chunk = variantGids.slice(g, g + 50);
            const res = await fetch(graphqlUrl, {
              method: 'POST',
              headers: gqlHeaders,
              body: JSON.stringify({
                query: `query($ids:[ID!]!){nodes(ids:$ids){... on ProductVariant{id inventoryItem{id}}}}`,
                variables: { ids: chunk },
              }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            for (const node of (data.data?.nodes || [])) {
              if (!node?.id || !node?.inventoryItem?.id) continue;
              inventoryMap[node.id.replace('gid://shopify/ProductVariant/', '')] = node.inventoryItem.id;
            }
          }

          const committedMap: Record<string, number> = {};
          const itemGids = Object.values(inventoryMap);
          for (let g = 0; g < itemGids.length; g += 50) {
            const chunk = itemGids.slice(g, g + 50);
            const res = await fetch(graphqlUrl, {
              method: 'POST',
              headers: gqlHeaders,
              body: JSON.stringify({
                query: `query($ids:[ID!]!){nodes(ids:$ids){... on InventoryItem{id inventoryLevel(locationId:"${locationGid}"){quantities(names:["committed"]){name quantity}}}}}`,
                variables: { ids: chunk },
              }),
            });
            if (!res.ok) continue;
            const data = await res.json();
            for (const node of (data.data?.nodes || [])) {
              if (!node?.id) continue;
              const c = node.inventoryLevel?.quantities?.find((q: any) => q.name === 'committed')?.quantity || 0;
              committedMap[node.id] = c;
            }
          }

          const setQuantities = variantIds
            .filter((v) => inventoryMap[v])
            .map((v) => {
              const gid = inventoryMap[v];
              const committed = committedMap[gid] || 0;
              const calc = variantStock[v].stock;
              const onHand = calc < committed ? committed : calc;
              return { inventoryItemId: gid, locationId: locationGid, quantity: onHand };
            });

          for (let c = 0; c < setQuantities.length; c += 50) {
            const chunk = setQuantities.slice(c, c + 50);
            const res = await fetch(graphqlUrl, {
              method: 'POST',
              headers: gqlHeaders,
              body: JSON.stringify({
                query: `mutation($input:InventorySetOnHandQuantitiesInput!){inventorySetOnHandQuantities(input:$input){userErrors{field message}}}`,
                variables: {
                  input: {
                    reason: 'correction',
                    referenceDocumentUri: `logistics://order/${orderId}`,
                    setQuantities: chunk,
                  },
                },
              }),
            });
            if (!res.ok) {
              console.error('Shopify push failed:', res.status);
              continue;
            }
            const data = await res.json();
            const ue = data.data?.inventorySetOnHandQuantities?.userErrors || [];
            if (ue.length > 0) console.error('Shopify userErrors:', ue);
          }
          console.log(`Pushed stock for ${setQuantities.length} sibling variants to Shopify`);
        }
      }
    } catch (pushErr) {
      console.error('Sibling stock push error:', pushErr);
    }

    return new Response(JSON.stringify({ status: 'processed', deductions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
