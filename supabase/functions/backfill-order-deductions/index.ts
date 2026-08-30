import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const shopifyStore = Deno.env.get('SHOPIFY_STORE_NAME');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!shopifyStore || !shopifyToken) {
      return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = `https://${shopifyStore}.myshopify.com`;

    // Get all already-processed order IDs
    const { data: existingDeductions } = await supabaseAdmin
      .from('inventory_deductions')
      .select('shopify_order_id');
    const processedOrderIds = new Set((existingDeductions || []).map((d: any) => d.shopify_order_id));

    let allOrders: any[] = [];
    let pageUrl: string | null = `${baseUrl}/admin/api/2025-04/orders.json?status=any&limit=250&financial_status=paid`;

    while (pageUrl) {
      const res = await fetch(pageUrl, {
        headers: { 'X-Shopify-Access-Token': shopifyToken },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Shopify API error:', errText);
        break;
      }
      const json = await res.json();
      allOrders = allOrders.concat(json.orders || []);

      // Check for pagination
      const linkHeader = res.headers.get('link');
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
      pageUrl = nextMatch ? nextMatch[1] : null;
    }

    console.log(`Fetched ${allOrders.length} paid orders from Shopify`);

    // Get all variant mappings and raw materials
    const { data: allMappings } = await supabaseAdmin.from('raw_material_variants').select('*');
    const { data: allMaterials } = await supabaseAdmin.from('raw_materials').select('*');

    // Make a mutable copy of materials for in-memory tracking
    const materialMap = new Map((allMaterials || []).map((m: any) => [m.id, { ...m }]));

    let processedCount = 0;
    const results: any[] = [];

    for (const order of allOrders) {
      const orderId = String(order.id);
      if (processedOrderIds.has(orderId)) continue;

      const orderName = order.name || `#${order.order_number}`;
      const deductions: any[] = [];

      for (const lineItem of (order.line_items || [])) {
        const variantId = String(lineItem.variant_id);
        const quantity = lineItem.quantity || 0;

        const mapping = (allMappings || []).find((m: any) => String(m.shopify_variant_id) === variantId);
        if (!mapping) continue;

        const material = materialMap.get(mapping.raw_material_id);
        if (!material) continue;

        const deductionAmount = mapping.quantity_per_unit * quantity;
        const newQty = Math.max(0, material.quantity_available - deductionAmount);

        // Deduct from raw material
        await supabaseAdmin
          .from('raw_materials')
          .update({ quantity_available: newQty })
          .eq('id', material.id);

        // Update in-memory for subsequent line items using same material
        material.quantity_available = newQty;

        // Log the deduction
        await supabaseAdmin.from('inventory_deductions').insert({
          shopify_order_id: orderId,
          shopify_order_name: orderName,
          raw_material_id: material.id,
          shopify_variant_id: variantId,
          quantity_deducted: deductionAmount,
          shopify_product_name: lineItem.title || mapping.shopify_product_name || null,
          shopify_variant_title: lineItem.variant_title || mapping.shopify_variant_title || null,
        });

        deductions.push({ material: material.name, qty: deductionAmount, variant: variantId });
      }

      // If no deductions, still mark as processed
      if (deductions.length === 0) {
        await supabaseAdmin.from('inventory_deductions').insert({
          shopify_order_id: orderId,
          shopify_order_name: orderName,
          raw_material_id: null,
          shopify_variant_id: null,
          quantity_deducted: 0,
        });
      }

      processedCount++;
      results.push({ order: orderName, deductions: deductions.length });
      console.log(`Backfilled order ${orderName}: ${deductions.length} deductions`);
    }

    console.log(`Backfill complete: ${processedCount} new orders processed`);
    return new Response(JSON.stringify({ status: 'ok', processed: processedCount, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
