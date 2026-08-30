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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdminOrOwner = roles?.some((r: any) => r.role === 'admin' || r.role === 'owner');
  if (!isAdminOrOwner) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  if (!storeName || !accessToken) {
    return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { lineItems, customer, notes, tags, shippingAddress, paymentTermsDays, freeShipping } = body;

    if (!lineItems || lineItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Line items are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build line_items for Shopify REST API
    const shopifyLineItems = lineItems.map((item: any) => {
      if (item.variantId) {
        return {
          variant_id: parseInt(item.variantId),
          quantity: item.quantity,
        };
      }
      return {
        title: item.title,
        quantity: item.quantity,
        price: Number(item.price).toFixed(2),
      };
    });

    // Build order payload (no payment_terms here — REST is read-only for payment terms)
    const orderPayload: any = {
      order: {
        line_items: shopifyLineItems,
        financial_status: "pending",
      },
    };

    // Customer association
    if (customer) {
      if (customer.shopifyId) {
        orderPayload.order.customer = { id: parseInt(customer.shopifyId) };
      } else if (customer.email) {
        orderPayload.order.customer = { email: customer.email };
      }
    }

    if (notes) {
      orderPayload.order.note = notes;
    }

    if (tags) {
      orderPayload.order.tags = tags;
    }

    // Shipping
    if (freeShipping) {
      orderPayload.order.shipping_lines = [{ title: "Free Shipping", price: "0.00" }];
    }

    // Shipping address
    if (shippingAddress) {
      const addr: Record<string, string> = {};
      if (shippingAddress.address1) addr.address1 = shippingAddress.address1;
      if (shippingAddress.address2) addr.address2 = shippingAddress.address2;
      if (shippingAddress.city) addr.city = shippingAddress.city;
      if (shippingAddress.province) addr.province = shippingAddress.province;
      if (shippingAddress.country) addr.country = shippingAddress.country;
      if (shippingAddress.zip) addr.zip = shippingAddress.zip;
      if (customer?.firstName) addr.first_name = customer.firstName;
      if (customer?.lastName) addr.last_name = customer.lastName;
      if (customer?.phone) addr.phone = customer.phone;
      if (Object.keys(addr).length > 0) {
        orderPayload.order.shipping_address = addr;
      }
    }

    console.log(`Creating order with ${shopifyLineItems.length} items, paymentTermsDays=${paymentTermsDays ?? 'none'}`);

    const createResponse = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`Shopify REST API error: ${createResponse.status}`);
      return new Response(JSON.stringify({ error: `Shopify error: ${errorText}` }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderData = await createResponse.json();
    const order = orderData.order;
    const orderId = order.id;

    console.log(`Order created: id=${orderId}, name=${order.name}`);

    // Apply payment terms via GraphQL if requested
    if (paymentTermsDays) {
      const dueInDays = parseInt(paymentTermsDays);
      console.log(`Applying payment terms: Net ${dueInDays} days`);

      const graphqlUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`;
      const graphqlHeaders = {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      };

      // Step 1: Query paymentTermsTemplates to find the matching NET template
      const templatesQuery = `query { paymentTermsTemplates(paymentTermsType: NET) { id name dueInDays paymentTermsType } }`;
      const templatesRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers: graphqlHeaders,
        body: JSON.stringify({ query: templatesQuery }),
      });

      if (!templatesRes.ok) {
        const errText = await templatesRes.text();
        console.error(`Failed to fetch payment terms templates: ${templatesRes.status}`);
        return new Response(JSON.stringify({
          error: `Order ${order.name} created but payment terms could not be applied. Templates fetch failed.`,
          orderId: orderId,
          orderName: order.name,
        }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const templatesData = await templatesRes.json();
      const templates = templatesData?.data?.paymentTermsTemplates || [];
      const matchingTemplate = templates.find((t: any) => t.dueInDays === dueInDays);

      if (!matchingTemplate) {
        console.error(`No payment terms template found for ${dueInDays} days. Available: ${templates.map((t: any) => t.dueInDays).join(', ')}`);
        return new Response(JSON.stringify({
          error: `Order ${order.name} created but no payment terms template found for Net ${dueInDays}.`,
          orderId: orderId,
          orderName: order.name,
        }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Found template: ${matchingTemplate.name} (${matchingTemplate.id})`);

      // Step 2: Apply payment terms via paymentTermsCreate mutation
      const mutation = `mutation PaymentTermsCreate($referenceId: ID!, $paymentTermsAttributes: PaymentTermsCreateInput!) {
        paymentTermsCreate(referenceId: $referenceId, paymentTermsAttributes: $paymentTermsAttributes) {
          paymentTerms { id }
          userErrors { field message }
        }
      }`;

      const variables = {
        referenceId: `gid://shopify/Order/${orderId}`,
        paymentTermsAttributes: {
          paymentTermsTemplateId: matchingTemplate.id,
          paymentSchedules: [
            {
              issuedAt: new Date().toISOString(),
              dueAt: new Date(Date.now() + dueInDays * 86400000).toISOString(),
            },
          ],
        },
      };

      const mutationRes = await fetch(graphqlUrl, {
        method: 'POST',
        headers: graphqlHeaders,
        body: JSON.stringify({ query: mutation, variables }),
      });

      if (!mutationRes.ok) {
        console.error(`GraphQL paymentTermsCreate HTTP error: ${mutationRes.status}`);
        return new Response(JSON.stringify({
          error: `Order ${order.name} created but payment terms mutation failed.`,
          orderId: orderId,
          orderName: order.name,
        }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mutationData = await mutationRes.json();
      const userErrors = mutationData?.data?.paymentTermsCreate?.userErrors || [];

      if (userErrors.length > 0) {
        console.error(`Payment terms userErrors: ${JSON.stringify(userErrors)}`);
        return new Response(JSON.stringify({
          error: `Order ${order.name} created but payment terms failed: ${userErrors.map((e: any) => e.message).join(', ')}`,
          orderId: orderId,
          orderName: order.name,
        }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ptId = mutationData?.data?.paymentTermsCreate?.paymentTerms?.id;
      console.log(`Payment terms applied successfully: ${ptId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: order.id,
        name: order.name,
        orderNumber: order.order_number,
        totalPrice: order.total_price,
        currency: order.currency,
        statusUrl: order.order_status_url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in shopify-create-draft-order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
