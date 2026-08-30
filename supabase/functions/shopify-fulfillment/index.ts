import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const userId = claimsData.claims.sub;

  // Check admin/owner role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const isAdminOrOwner = roles?.some((r: any) => r.role === 'admin' || r.role === 'owner');
  if (!isAdminOrOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  if (!storeName || !accessToken) {
    return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const shopifyHeaders = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };
  const baseUrl = `https://${storeName}.myshopify.com/admin/api/2025-04`;

  try {
    const { orderId, action } = await req.json();

    if (!orderId || !action) {
      return new Response(JSON.stringify({ error: 'orderId and action are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Fulfillment action: ${action} for order ${orderId}`);

    // Get fulfillment orders for this order
    const foRes = await fetch(`${baseUrl}/orders/${orderId}/fulfillment_orders.json`, { headers: shopifyHeaders });
    if (!foRes.ok) {
      const errText = await foRes.text();
      console.error(`Failed to get fulfillment orders: ${foRes.status} - ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to get fulfillment orders', details: errText }), { status: foRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const foData = await foRes.json();
    const fulfillmentOrders = foData.fulfillment_orders || [];
    console.log(`Found ${fulfillmentOrders.length} fulfillment orders`);

    if (fulfillmentOrders.length === 0) {
      return new Response(JSON.stringify({ error: 'No fulfillment orders found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let result: any;

    if (action === 'fulfill') {
      // Create fulfillment for all open fulfillment orders
      const openFOs = fulfillmentOrders.filter((fo: any) => fo.status === 'open' || fo.status === 'in_progress');
      if (openFOs.length === 0) {
        return new Response(JSON.stringify({ error: 'No open fulfillment orders to fulfill' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const fulfillmentPayload = {
        fulfillment: {
          line_items_by_fulfillment_order: openFOs.map((fo: any) => ({
            fulfillment_order_id: fo.id,
          })),
        },
      };

      const res = await fetch(`${baseUrl}/fulfillments.json`, {
        method: 'POST',
        headers: shopifyHeaders,
        body: JSON.stringify(fulfillmentPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Failed to fulfill: ${res.status} - ${errText}`);
        return new Response(JSON.stringify({ error: 'Failed to fulfill order', details: errText }), { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      result = await res.json();

    } else if (action === 'hold') {
      // Put fulfillment orders on hold
      const openFOs = fulfillmentOrders.filter((fo: any) => fo.status === 'open' || fo.status === 'in_progress');
      const results = [];
      for (const fo of openFOs) {
        const res = await fetch(`${baseUrl}/fulfillment_orders/${fo.id}/hold.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({
            fulfillment_hold: {
              reason: "other",
              reason_notes: "Put on hold via admin dashboard",
            },
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Failed to hold FO ${fo.id}: ${res.status} - ${errText}`);
        }
        results.push({ id: fo.id, status: res.status });
      }
      result = { held: results };

    } else if (action === 'release_hold') {
      // Release hold on fulfillment orders
      const heldFOs = fulfillmentOrders.filter((fo: any) => fo.status === 'on_hold');
      const results = [];
      for (const fo of heldFOs) {
        const res = await fetch(`${baseUrl}/fulfillment_orders/${fo.id}/release_hold.json`, {
          method: 'POST',
          headers: shopifyHeaders,
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error(`Failed to release hold FO ${fo.id}: ${res.status} - ${errText}`);
        }
        results.push({ id: fo.id, status: res.status });
      }
      result = { released: results };

    } else if (action === 'cancel_fulfillment') {
      // Cancel existing fulfillments on the order
      // First get the order to find fulfillment IDs
      const orderRes = await fetch(`${baseUrl}/orders/${orderId}.json?fields=fulfillments`, { headers: shopifyHeaders });
      if (!orderRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to get order' }), { status: orderRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const orderData = await orderRes.json();
      const fulfillments = orderData.order?.fulfillments || [];
      
      const results = [];
      for (const f of fulfillments) {
        if (f.status === 'success') {
          const res = await fetch(`${baseUrl}/fulfillments/${f.id}/cancel.json`, {
            method: 'POST',
            headers: shopifyHeaders,
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error(`Failed to cancel fulfillment ${f.id}: ${res.status} - ${errText}`);
          }
          results.push({ id: f.id, status: res.status });
        }
      }
      result = { cancelled: results };

    } else if (action === 'in_progress') {
      console.log('Fulfillment order statuses:', fulfillmentOrders.map((fo: any) => ({ id: fo.id, status: fo.status, request_status: fo.request_status })));
      
      // Find fulfillment orders that can transition to in_progress
      let eligibleFOs = fulfillmentOrders.filter((fo: any) => 
        fo.status === 'open' || fo.status === 'scheduled'
      );
      
      // If none are open/scheduled, release held ones first
      if (eligibleFOs.length === 0) {
        const heldFOs = fulfillmentOrders.filter((fo: any) => fo.status === 'on_hold');
        if (heldFOs.length > 0) {
          console.log('Releasing held fulfillment orders first...');
          for (const fo of heldFOs) {
            const releaseRes = await fetch(`${baseUrl}/fulfillment_orders/${fo.id}/release_hold.json`, {
              method: 'POST',
              headers: shopifyHeaders,
            });
            const releaseText = await releaseRes.text();
            if (!releaseRes.ok) {
              console.error(`Failed to release hold FO ${fo.id}: ${releaseRes.status} - ${releaseText}`);
            } else {
              console.log(`Released hold FO ${fo.id}: ${releaseText}`);
              eligibleFOs.push(fo);
            }
          }
        }
      }

      if (eligibleFOs.length === 0) {
        const allStatuses = fulfillmentOrders.map((fo: any) => fo.status).join(', ');
        return new Response(JSON.stringify({ error: `No eligible fulfillment orders. Current statuses: ${allStatuses}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // To set "in_progress", send a fulfillment request then accept it
      const results = [];
      for (const fo of eligibleFOs) {
        // Step 1: Send fulfillment request
        const reqRes = await fetch(`${baseUrl}/fulfillment_orders/${fo.id}/fulfillment_request.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({
            fulfillment_request: {
              message: "Marking as in progress",
            },
          }),
        });
        const reqText = await reqRes.text();
        if (!reqRes.ok) {
          console.error(`Failed to send fulfillment request for FO ${fo.id}: ${reqRes.status} - ${reqText}`);
          // Fallback: try GraphQL mutation if REST fulfillment_request fails (merchant-managed)
          const graphqlUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`;
          const gqlRes = await fetch(graphqlUrl, {
            method: 'POST',
            headers: shopifyHeaders,
            body: JSON.stringify({
              query: `mutation { fulfillmentOrderLineItemsPreparedForPickup(input: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: "gid://shopify/FulfillmentOrder/${fo.id}" }] }) { userErrors { field message } } }`,
            }),
          });
          const gqlText = await gqlRes.text();
          console.log(`GraphQL preparedForPickup FO ${fo.id}: ${gqlRes.status} - ${gqlText}`);
          results.push({ id: fo.id, method: 'graphql_prepared', status: gqlRes.status, response: gqlText });
          continue;
        }
        console.log(`Fulfillment request sent for FO ${fo.id}: ${reqText}`);

        // Step 2: Accept the fulfillment request to transition to in_progress
        const acceptRes = await fetch(`${baseUrl}/fulfillment_orders/${fo.id}/fulfillment_request/accept.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({
            fulfillment_request: {
              message: "Accepted - in progress",
            },
          }),
        });
        const acceptText = await acceptRes.text();
        if (!acceptRes.ok) {
          console.error(`Failed to accept fulfillment request for FO ${fo.id}: ${acceptRes.status} - ${acceptText}`);
        } else {
          console.log(`Fulfillment request accepted for FO ${fo.id}: ${acceptText}`);
        }
        results.push({ id: fo.id, method: 'fulfillment_request_accept', status: acceptRes.status });
      }
      result = { in_progress: results };

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Action ${action} completed successfully`);
    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error in shopify-fulfillment:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', message: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
