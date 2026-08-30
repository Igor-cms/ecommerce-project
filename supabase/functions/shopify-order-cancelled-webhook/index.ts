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
    const rawBody = await req.text();

    // HMAC verification
    const shopifyHmac = req.headers.get('x-shopify-hmac-sha256');
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('SHOPIFY_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!shopifyHmac) {
      console.warn('No HMAC header present — rejecting request');
      return new Response(JSON.stringify({ error: 'Missing HMAC' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const order = JSON.parse(rawBody);
    const orderId = String(order.id);
    const orderName = order.name || `#${order.order_number}`;

    console.log(`Cancellation webhook received: order ${orderName} (${orderId})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active (not yet reverted) deductions for this order
    const { data: deductions, error: dedErr } = await supabaseAdmin
      .from('inventory_deductions')
      .select('id, raw_material_id, quantity_deducted')
      .eq('shopify_order_id', orderId)
      .is('reverted_at', null);

    if (dedErr) {
      console.error('Failed to fetch deductions:', dedErr);
      return new Response(JSON.stringify({ error: 'DB read failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const actionable = (deductions || []).filter(
      (d: any) => d.raw_material_id && Number(d.quantity_deducted) > 0
    );

    if (actionable.length === 0) {
      console.log(`Order ${orderName}: nothing to revert`);
      return new Response(JSON.stringify({ status: 'nothing_to_revert' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sum by raw_material_id
    const restorePerMaterial: Record<string, number> = {};
    for (const d of actionable) {
      restorePerMaterial[d.raw_material_id] =
        (restorePerMaterial[d.raw_material_id] || 0) + Number(d.quantity_deducted);
    }

    // Fetch current materials
    const materialIds = Object.keys(restorePerMaterial);
    const { data: materials } = await supabaseAdmin
      .from('raw_materials')
      .select('*')
      .in('id', materialIds);

    const affectedMaterials: any[] = [];

    for (const mat of (materials || [])) {
      const restore = restorePerMaterial[mat.id] || 0;
      const newQty = Number(mat.quantity_available) + restore;
      const { error: upErr } = await supabaseAdmin
        .from('raw_materials')
        .update({ quantity_available: newQty })
        .eq('id', mat.id);
      if (upErr) {
        console.error(`Failed to restore ${mat.name}:`, upErr);
        continue;
      }
      mat.quantity_available = newQty;
      affectedMaterials.push(mat);
      console.log(`Restored ${restore}${mat.unit} to ${mat.name} (order ${orderName})`);
    }

    // Mark deductions as reverted
    const dedIds = actionable.map((d: any) => d.id);
    const { error: markErr } = await supabaseAdmin
      .from('inventory_deductions')
      .update({ reverted_at: new Date().toISOString() })
      .in('id', dedIds);
    if (markErr) {
      console.error('Failed to mark deductions reverted:', markErr);
    }

    // ============================================================
    // Push sibling variant stock to Shopify
    // ============================================================
    try {
      const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
      const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

      if (!storeName || !accessToken) {
        console.warn('Shopify credentials missing; skipping sibling stock push');
      } else if (affectedMaterials.length > 0) {
        const affectedMaterialIds = affectedMaterials.map((m) => m.id);

        const { data: siblingMappings } = await supabaseAdmin
          .from('raw_material_variants')
          .select('*')
          .in('raw_material_id', affectedMaterialIds);

        const variantStock: Record<string, { stock: number; productName: string; variantTitle: string }> = {};
        for (const m of (siblingMappings || [])) {
          const mat = affectedMaterials.find((mm: any) => mm.id === m.raw_material_id);
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

        // Equalize across product+title groups
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
                    referenceDocumentUri: `logistics://order/${orderId}/cancel`,
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
          console.log(`Pushed restored stock for ${setQuantities.length} sibling variants to Shopify`);
        }
      }
    } catch (pushErr) {
      console.error('Sibling stock push error:', pushErr);
    }

    return new Response(JSON.stringify({
      status: 'reverted',
      deductions_reverted: actionable.length,
      materials_restored: affectedMaterials.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cancel webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
