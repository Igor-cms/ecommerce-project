import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service role client for inventory_deductions (RLS bypassed)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userId = userData.user.id;

    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'owner']);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    // Parse request body
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dry_run === true;
    } catch { /* no body or invalid JSON */ }

    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeName || !accessToken) {
      return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // STEP 0: Revert stock for cancelled Shopify orders (idempotent)
    // ============================================================
    const reversals: Array<{ order_id: string; order_name: string; material_name: string; qty_returned: number }> = [];

    if (!dryRun) {
      console.log('=== STEP 0: Reverting cancelled orders ===');

      const cancelledRes = await fetch(
        `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json?status=cancelled&limit=50`,
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      if (!cancelledRes.ok) {
        console.error('Failed to fetch cancelled orders:', cancelledRes.status);
      } else {
        const cancelledOrders = (await cancelledRes.json()).orders || [];
        const cancelledOrderIds = cancelledOrders.map((o: any) => String(o.id));
        console.log(`Fetched ${cancelledOrders.length} cancelled orders from Shopify`);

        if (cancelledOrderIds.length > 0) {
          const { data: pendingReversals } = await supabaseAdmin
            .from('inventory_deductions')
            .select('*')
            .in('shopify_order_id', cancelledOrderIds)
            .is('reverted_at', null)
            .gt('quantity_deducted', 0);

          for (const ded of (pendingReversals || [])) {
            const { data: matRows } = await supabaseAdmin
              .from('raw_materials')
              .select('id, name, quantity_available, unit')
              .eq('id', ded.raw_material_id)
              .limit(1);

            const mat = matRows?.[0];
            if (!mat) {
              console.error(`Material ${ded.raw_material_id} not found for deduction ${ded.id}, skipping`);
              continue;
            }

            const { error: updateErr } = await supabaseAdmin
              .from('raw_materials')
              .update({ quantity_available: mat.quantity_available + ded.quantity_deducted })
              .eq('id', mat.id);

            if (updateErr) {
              console.error(`Failed to revert ${mat.name}:`, updateErr);
              continue;
            }

            await supabaseAdmin
              .from('inventory_deductions')
              .update({ reverted_at: new Date().toISOString() })
              .eq('id', ded.id);

            reversals.push({
              order_id: ded.shopify_order_id,
              order_name: ded.shopify_order_name,
              material_name: mat.name,
              qty_returned: ded.quantity_deducted,
            });

            console.log(`Returned ${ded.quantity_deducted}${mat.unit} to ${mat.name} (order ${ded.shopify_order_name})`);
          }
        }
      }

      console.log(`Step 0 complete: ${reversals.length} reversals`);
    }

    // ============================================================
    // STEP 1: Fetch recent Shopify orders and deduct from raw materials
    // ============================================================
    const deductions: Array<{ order_id: string; order_name: string; variant_id: string; product_name: string; variant_title: string; qty_deducted: number; material_name: string }> = [];

    if (!dryRun) {
      console.log('=== STEP 1: Importing Shopify orders ===');

      // Fetch recent fulfilled/paid orders from Shopify
      const ordersRes = await fetch(
        `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json?status=any&financial_status=paid&limit=50`,
        { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
      );

      if (!ordersRes.ok) {
        console.error('Failed to fetch Shopify orders:', ordersRes.status);
      } else {
        const ordersData = await ordersRes.json();
        const orders = ordersData.orders || [];
        console.log(`Fetched ${orders.length} paid orders from Shopify`);

        // Get already-processed order IDs
        const { data: existingDeductions } = await supabaseAdmin
          .from('inventory_deductions')
          .select('shopify_order_id');
        const processedOrderIds = new Set((existingDeductions || []).map((d: any) => d.shopify_order_id));

        // Get all variant mappings
        const { data: allMappings } = await supabase
          .from('raw_material_variants')
          .select('*');
        const { data: allMaterials } = await supabase
          .from('raw_materials')
          .select('*');

        for (const order of orders) {
          const orderId = String(order.id);
          if (processedOrderIds.has(orderId)) continue;

          console.log(`Processing order ${order.name} (${orderId})`);

          for (const lineItem of (order.line_items || [])) {
            const variantId = String(lineItem.variant_id);
            const quantity = lineItem.quantity || 0;

            // Find mapping for this variant
            const mapping = (allMappings || []).find((m: any) => String(m.shopify_variant_id) === variantId);
            if (!mapping) continue;

            const material = (allMaterials || []).find((m: any) => m.id === mapping.raw_material_id);
            if (!material) continue;

            const deductionAmount = mapping.quantity_per_unit * quantity;

            // Deduct from raw material
            const newQty = Math.max(0, material.quantity_available - deductionAmount);
            const { error: updateError } = await supabase
              .from('raw_materials')
              .update({ quantity_available: newQty })
              .eq('id', material.id);

            if (updateError) {
              console.error(`Failed to deduct from ${material.name}:`, updateError);
              continue;
            }

            // Update in-memory value for subsequent calculations
            material.quantity_available = newQty;

            // Log the deduction
            await supabaseAdmin
              .from('inventory_deductions')
              .insert({
                shopify_order_id: orderId,
                shopify_order_name: order.name,
                raw_material_id: material.id,
                shopify_variant_id: variantId,
                quantity_deducted: deductionAmount,
                shopify_product_name: lineItem.title || mapping.shopify_product_name || null,
                shopify_variant_title: lineItem.variant_title || mapping.shopify_variant_title || null,
              });

            deductions.push({
              order_id: orderId,
              order_name: order.name,
              variant_id: variantId,
              product_name: lineItem.title || mapping.shopify_product_name,
              variant_title: lineItem.variant_title || mapping.shopify_variant_title,
              qty_deducted: deductionAmount,
              material_name: material.name,
            });

            console.log(`Deducted ${deductionAmount}${material.unit} from ${material.name} (order ${order.name})`);
          }

          // Mark this order as processed (even if no mappings matched)
          if (!processedOrderIds.has(orderId)) {
            processedOrderIds.add(orderId);
            // If no line items matched, still record the order so we don't re-check it
            const hasDeductions = deductions.some(d => d.order_id === orderId);
            if (!hasDeductions) {
              await supabaseAdmin
                .from('inventory_deductions')
                .insert({
                  shopify_order_id: orderId,
                  shopify_order_name: order.name,
                  raw_material_id: null,
                  shopify_variant_id: null,
                  quantity_deducted: 0,
                });
            }
          }
        }
      }
    }

    // ============================================================
    // STEP 2: Calculate available stock per variant (re-fetch after deductions)
    // ============================================================
    console.log('=== STEP 2: Calculating available stock per variant ===');

    const { data: materials, error: matError } = await supabase
      .from('raw_materials')
      .select('*');
    if (matError) throw matError;

    const { data: mappings, error: mapError } = await supabase
      .from('raw_material_variants')
      .select('*');
    if (mapError) throw mapError;

    const variantStockMap: Record<string, { stock: number; productName: string; variantTitle: string }> = {};

    for (const mapping of (mappings || [])) {
      const material = (materials || []).find((m: any) => m.id === mapping.raw_material_id);
      if (!material) continue;

      const available = Math.floor(material.quantity_available / mapping.quantity_per_unit);

      if (variantStockMap[mapping.shopify_variant_id]) {
        variantStockMap[mapping.shopify_variant_id].stock = Math.min(
          variantStockMap[mapping.shopify_variant_id].stock,
          available
        );
      } else {
        variantStockMap[mapping.shopify_variant_id] = {
          stock: available,
          productName: mapping.shopify_product_name,
          variantTitle: mapping.shopify_variant_title,
        };
      }
    }

    // ============================================================
    // STEP 2.5: Equalize stock across Retail/Wholesale equivalent variants
    // Group by product name + weight, take minimum stock across the group
    // ============================================================
    const weightGroups: Record<string, string[]> = {}; // "productName::weight" -> [variantId, ...]
    for (const [variantId, info] of Object.entries(variantStockMap)) {
      // Extract weight from variant title (e.g. "250g", "1kg" -> normalize)
      const titleLower = (info.variantTitle || '').toLowerCase().trim();
      // Normalize product name for grouping
      const productKey = (info.productName || '').toLowerCase().trim();
      const groupKey = `${productKey}::${titleLower}`;
      if (!weightGroups[groupKey]) weightGroups[groupKey] = [];
      weightGroups[groupKey].push(variantId);
    }

    for (const [groupKey, variantIds] of Object.entries(weightGroups)) {
      if (variantIds.length <= 1) continue;
      const minStock = Math.min(...variantIds.map(vid => variantStockMap[vid].stock));
      for (const vid of variantIds) {
        if (variantStockMap[vid].stock !== minStock) {
          console.log(`Equalized ${variantStockMap[vid].productName} ${variantStockMap[vid].variantTitle}: ${variantStockMap[vid].stock} → ${minStock} (group: ${groupKey})`);
          variantStockMap[vid].stock = minStock;
        }
      }
    }

    const summary = Object.entries(variantStockMap).map(([variantId, info]) => ({
      shopify_variant_id: variantId,
      product_name: info.productName,
      variant_title: info.variantTitle,
      calculated_stock: Math.max(0, info.stock),
    }));

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================================
    // STEP 3: Push updated stock levels to Shopify
    // ============================================================
    console.log(`=== STEP 3: Pushing stock to Shopify (${summary.length} variants) ===`);

    // Get location ID via GraphQL (needed for on_hand mutation)
    const locResponse = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2025-04/locations.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
    );
    if (!locResponse.ok) throw new Error(`Failed to fetch locations: ${locResponse.status}`);
    const locData = await locResponse.json();
    const locationId = locData.locations?.[0]?.id;
    if (!locationId) throw new Error('No Shopify location found');

    const locationGid = `gid://shopify/Location/${locationId}`;

    const results: Array<{ variant_id: string; product: string; variant: string; stock: number; success: boolean; error?: string }> = [];

    // Resolve all inventory_item_ids via batch GraphQL (instead of sequential REST)
    const inventoryMap: Record<string, string> = {}; // variantId -> inventoryItemGid
    const variantGids = summary.map(item => `gid://shopify/ProductVariant/${item.shopify_variant_id}`);

    for (let g = 0; g < variantGids.length; g += 50) {
      const gidChunk = variantGids.slice(g, g + 50);
      const nodesQuery = `
        query($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              inventoryItem {
                id
              }
            }
          }
        }
      `;
      try {
        const gqlRes = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: nodesQuery, variables: { ids: gidChunk } }),
        });
        if (!gqlRes.ok) {
          console.error('GraphQL variant lookup failed:', gqlRes.status);
          continue;
        }
        const gqlData = await gqlRes.json();
        for (const node of (gqlData.data?.nodes || [])) {
          if (!node?.id || !node?.inventoryItem?.id) continue;
          // Extract numeric variant ID from GID
          const numericId = node.id.replace('gid://shopify/ProductVariant/', '');
          inventoryMap[numericId] = node.inventoryItem.id;
        }
      } catch (e) {
        console.error('GraphQL variant lookup error:', e);
      }
    }

    // Mark items that failed to resolve
    for (const item of summary) {
      if (!inventoryMap[item.shopify_variant_id]) {
        results.push({ variant_id: item.shopify_variant_id, product: item.product_name, variant: item.variant_title, stock: item.calculated_stock, success: false, error: 'No inventory_item_id resolved' });
      }
    }

    // Build quantities for GraphQL mutation (only items that resolved successfully)
    const pendingItems = summary.filter(item => inventoryMap[item.shopify_variant_id]);

    // Fetch committed quantities so we can enforce Available >= 0
    const committedMap: Record<string, number> = {}; // inventoryItemGid -> committed qty
    const allGids = pendingItems.map(item => inventoryMap[item.shopify_variant_id]);
    for (let g = 0; g < allGids.length; g += 50) {
      const gidChunk = allGids.slice(g, g + 50);
      const nodesQuery = `
        query($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on InventoryItem {
              id
              inventoryLevel(locationId: "${locationGid}") {
                quantities(names: ["committed"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      `;
      try {
        const cRes = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: nodesQuery, variables: { ids: gidChunk } }),
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          for (const node of (cData.data?.nodes || [])) {
            if (!node?.id) continue;
            const committed = node.inventoryLevel?.quantities?.find((q: any) => q.name === 'committed')?.quantity || 0;
            committedMap[node.id] = committed;
          }
        }
      } catch (e) {
        console.error('Failed to fetch committed quantities:', e);
      }
    }

    // Batch in chunks of 50 to avoid GraphQL limits
    const chunkSize = 50;
    for (let c = 0; c < pendingItems.length; c += chunkSize) {
      const chunk = pendingItems.slice(c, c + chunkSize);
      const quantities = chunk.map(item => {
        const gid = inventoryMap[item.shopify_variant_id];
        const committed = committedMap[gid] || 0;
        // If on_hand - committed < 0, force on_hand = committed so Available = 0
        const onHand = item.calculated_stock < committed ? committed : item.calculated_stock;
        if (onHand !== item.calculated_stock) {
          console.log(`Adjusted on_hand for ${item.product_name} ${item.variant_title}: ${item.calculated_stock} → ${onHand} (committed=${committed}) to prevent negative Available`);
        }
        return {
          inventoryItemId: gid,
          locationId: locationGid,
          quantity: onHand,
        };
      });

      const mutation = `
        mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
          inventorySetOnHandQuantities(input: $input) {
            inventoryAdjustmentGroup {
              reason
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      try {
        const gqlRes = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`, {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: mutation,
            variables: {
              input: {
                reason: 'correction',
                setQuantities: quantities,
              },
            },
          }),
        });

        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          const userErrors = gqlData.data?.inventorySetOnHandQuantities?.userErrors || [];
          if (userErrors.length > 0) {
            console.error('GraphQL userErrors:', userErrors);
            for (const item of chunk) {
              results.push({ variant_id: item.shopify_variant_id, product: item.product_name, variant: item.variant_title, stock: item.calculated_stock, success: false, error: JSON.stringify(userErrors) });
            }
          } else {
            for (const item of chunk) {
              results.push({ variant_id: item.shopify_variant_id, product: item.product_name, variant: item.variant_title, stock: item.calculated_stock, success: true });
            }
            console.log(`Set on_hand for ${chunk.length} variants via GraphQL`);
          }
        } else {
          const errText = await gqlRes.text();
          console.error('GraphQL mutation failed:', gqlRes.status, errText);
          for (const item of chunk) {
            results.push({ variant_id: item.shopify_variant_id, product: item.product_name, variant: item.variant_title, stock: item.calculated_stock, success: false, error: errText });
          }
        }
      } catch (e) {
        for (const item of chunk) {
          results.push({ variant_id: item.shopify_variant_id, product: item.product_name, variant: item.variant_title, stock: item.calculated_stock, success: false, error: (e as Error).message });
        }
      }
    }

    const payload = { dry_run: false, results, deductions, reversals };
    console.log(`=== Sync complete: ${results.length} variants pushed, ${deductions.length} deductions, ${reversals.length} reversals ===`);
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync inventory error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
