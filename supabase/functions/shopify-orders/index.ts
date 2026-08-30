import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

  if (!storeName || !accessToken) {
    return jsonResponse({ error: 'Shopify credentials not configured' }, 500);
  }

  try {
    // GET: Fetch orders from Shopify
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('mode');

      // ─────────────────────────────────────────────────────────────
      // Auth: identify caller and determine if they're admin/owner.
      // Non-admin callers may only fetch their own orders (filtered by
      // their authenticated email). Revenue endpoints are admin-only.
      // ─────────────────────────────────────────────────────────────
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      const token = authHeader.replace('Bearer ', '');

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const callerRole = claimsData.claims.role as string | undefined;
      const userId = claimsData.claims.sub as string | undefined;
      const userEmail = (claimsData.claims.email as string | undefined)?.toLowerCase() ?? null;

      let isAdminOrOwner = callerRole === 'service_role';
      if (!isAdminOrOwner && userId) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);
        isAdminOrOwner = !!roles?.some(
          (r: { role: string }) => r.role === 'admin' || r.role === 'owner'
        );
      }

      // Revenue mode: paginate through all paid orders and sum total_price
      if (mode === 'revenue' || mode === 'revenue-monthly') {
        if (!isAdminOrOwner) {
          return jsonResponse({ error: 'Forbidden' }, 403);
        }
        let revenue = 0;
        let currency = 'EUR';
        const monthlyMap: Record<string, number> = {};
        let pageUrl: string | null = `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json?status=any&limit=250&financial_status=paid&fields=id,total_price,currency,financial_status,cancelled_at,created_at`;

        while (pageUrl) {
          const res = await fetch(pageUrl, {
            headers: { 'X-Shopify-Access-Token': accessToken!, 'Content-Type': 'application/json' },
          });
          if (!res.ok) throw new Error(`Shopify error: ${res.status}`);
          const data = await res.json();
          for (const order of (data.orders || [])) {
            if (!order.cancelled_at) {
              const amount = parseFloat(order.total_price || '0');
              revenue += amount;
              currency = order.currency || currency;
              if (mode === 'revenue-monthly') {
                const date = new Date(order.created_at);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyMap[key] = (monthlyMap[key] || 0) + amount;
              }
            }
          }
          const linkHeader = res.headers.get('Link') || '';
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          pageUrl = nextMatch ? nextMatch[1] : null;
        }

        if (mode === 'revenue-monthly') {
          // Build array for current year months up to now
          const now = new Date();
          const year = now.getFullYear();
          const months = [];
          for (let m = 0; m <= now.getMonth(); m++) {
            const key = `${year}-${String(m + 1).padStart(2, '0')}`;
            months.push({ month: key, revenue: parseFloat((monthlyMap[key] || 0).toFixed(2)) });
          }
          return new Response(
            JSON.stringify({ months, totalRevenue: revenue.toFixed(2), currency }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ revenue: revenue.toFixed(2), currency }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const status = url.searchParams.get('status') || 'any';
      const limit = url.searchParams.get('limit') || '50';
      const sinceId = url.searchParams.get('since_id');
      const createdAtMin = url.searchParams.get('created_at_min');

      const createdAtMax = url.searchParams.get('created_at_max');

      // Non-admin callers can only see their own orders. Without an email
      // claim there's no way to safely filter, so deny.
      if (!isAdminOrOwner && !userEmail) {
        return jsonResponse({ error: 'Forbidden' }, 403);
      }

      let shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json?status=${status}&limit=${limit}&order=created_at+desc`;
      if (sinceId) shopifyUrl += `&since_id=${sinceId}`;
      if (createdAtMin) shopifyUrl += `&created_at_min=${createdAtMin}`;
      if (createdAtMax) shopifyUrl += `&created_at_max=${createdAtMax}`;
      if (!isAdminOrOwner && userEmail) {
        shopifyUrl += `&email=${encodeURIComponent(userEmail)}`;
      }

      console.log(
        `Fetching Shopify orders: status=${status}, limit=${limit}, scope=${
          isAdminOrOwner ? 'admin' : 'self'
        }`
      );

      const response = await fetch(shopifyUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch orders from Shopify', details: errorText }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const data = await response.json();
      const orders = data.orders || [];

      // Map to a clean structure
      // Map basic order data first
      const mapped = orders.map((order: any) => ({
        id: order.id,
        name: order.name,
        email: order.email || '',
        created_at: order.created_at,
        financial_status: order.financial_status,
        fulfillment_status: order.fulfillment_status,
        fulfillment_order_status: null as string | null,
        total_price: order.total_price,
        currency: order.currency,
        customer: (() => {
          const phone = order.phone || order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || null;
          return order.customer ? {
            first_name: order.customer.first_name || '',
            last_name: order.customer.last_name || '',
            email: order.customer.email || order.email || '',
            phone,
          } : { first_name: '', last_name: '', email: order.email || '', phone };
        })(),
        shipping_address: order.shipping_address ? {
          address1: order.shipping_address.address1,
          address2: order.shipping_address.address2,
          city: order.shipping_address.city,
          province: order.shipping_address.province,
          country: order.shipping_address.country,
          zip: order.shipping_address.zip,
        } : null,
        line_items: (order.line_items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          variant_title: item.variant_title,
          quantity: item.quantity,
          price: item.price,
          image: item.image?.src || null,
        })),
        note: order.note,
        tags: order.tags,
        cancelled_at: order.cancelled_at,
      }));

      // Enrich with fulfillment_order status for non-cancelled, non-fulfilled orders
      const ordersNeedingFOStatus = mapped.filter(
        (o: any) => !o.cancelled_at && o.fulfillment_status !== 'fulfilled'
      );

      // Fetch fulfillment orders in parallel (batches of 5 to avoid rate limits)
      const batchSize = 5;
      for (let i = 0; i < ordersNeedingFOStatus.length; i += batchSize) {
        const batch = ordersNeedingFOStatus.slice(i, i + batchSize);
        const foResults = await Promise.all(
          batch.map(async (order: any) => {
            try {
              const foRes = await fetch(
                `https://${storeName}.myshopify.com/admin/api/2025-04/orders/${order.id}/fulfillment_orders.json`,
                { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
              );
              if (!foRes.ok) return { orderId: order.id, status: null };
              const foData = await foRes.json();
              const fos = foData.fulfillment_orders || [];
              
              // Derive granular status from fulfillment orders
              if (fos.some((fo: any) => fo.status === 'on_hold')) return { orderId: order.id, status: 'on_hold' };
              if (fos.some((fo: any) => fo.status === 'in_progress')) return { orderId: order.id, status: 'in_progress' };
              if (fos.every((fo: any) => fo.status === 'closed')) return { orderId: order.id, status: 'fulfilled' };
              return { orderId: order.id, status: null };
            } catch (e) {
              console.error(`Error fetching FO for order ${order.id}:`, e);
              return { orderId: order.id, status: null };
            }
          })
        );

        for (const foResult of foResults) {
          if (foResult.status) {
            const order = mapped.find((o: any) => o.id === foResult.orderId);
            if (order) order.fulfillment_order_status = foResult.status;
          }
        }
      }

      console.log(`Returning ${mapped.length} orders (${ordersNeedingFOStatus.length} enriched with FO status)`);

      return new Response(
        JSON.stringify({ orders: mapped }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST: Create draft order (existing logic)
    if (req.method === 'POST') {
      const body = await req.json();
      const { cart, customer, notes } = body;

      if (!cart || cart.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Cart is empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Creating order for ${customer?.email || 'guest'} with ${cart.length} items`);

      const lineItems = cart.map((item: any) => ({
        title: item.name,
        price: item.price.toFixed(2),
        quantity: item.quantity,
        ...(item.variantId && { variant_id: parseInt(item.variantId) }),
      }));

      const draftOrderPayload: Record<string, unknown> = {
        draft_order: {
          line_items: lineItems,
          ...(customer && {
            customer: {
              email: customer.email,
              first_name: customer.firstName,
              last_name: customer.lastName,
              phone: customer.phone,
            },
          }),
          ...(customer?.address && {
            shipping_address: {
              first_name: customer.firstName,
              last_name: customer.lastName,
              address1: customer.address.address1,
              address2: customer.address.address2,
              city: customer.address.city,
              province: customer.address.province,
              country: customer.address.country,
              zip: customer.address.zip,
            },
          }),
          note: notes,
          ...(customer && { use_customer_default_address: !customer.address }),
        },
      };

      const createResponse = await fetch(
        `https://${storeName}.myshopify.com/admin/api/2025-04/draft_orders.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(draftOrderPayload),
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`Shopify API error: ${createResponse.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ error: 'Failed to create order', details: errorText }),
          { status: createResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const draftOrderData = await createResponse.json();
      const draftOrder = draftOrderData.draft_order;

      return new Response(
        JSON.stringify({
          success: true,
          orderId: draftOrder.id,
          orderName: draftOrder.name,
          checkoutUrl: draftOrder.invoice_url,
          totalPrice: draftOrder.total_price,
          currency: draftOrder.currency,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in shopify-orders:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
