import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

  if (!storeName || !accessToken) {
    return new Response('Shopify credentials not configured', { status: 500 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let parsed: any;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      parsed = JSON.parse(params.get('json') || '{}');
    } else {
      parsed = await req.json();
    }

    const { cart, discountCode, discountInfo, customer } = parsed;

    if (!cart || cart.length === 0) {
      return new Response('Cart is empty', { status: 400 });
    }

    console.log(`Creating checkout redirect for ${cart.length} items${discountCode ? ` with discount: ${discountCode}` : ''}`);

    const lineItems = cart.map((item: any) => ({
      title: item.name,
      price: item.price.toFixed(2),
      quantity: item.quantity,
      ...(item.variantId && { variant_id: parseInt(item.variantId) }),
    }));

    const draftOrderPayload: any = {
      draft_order: {
        line_items: lineItems,
      },
    };

    // Associate customer if provided
    if (customer?.email) {
      draftOrderPayload.draft_order.customer = { email: customer.email };
      console.log(`Associating order with customer`);
    }

    // Apply discount to draft order if provided
    if (discountCode && discountInfo) {
      draftOrderPayload.draft_order.applied_discount = {
        title: discountCode,
        value: String(discountInfo.value),
        value_type: discountInfo.type,
        description: `Discount code: ${discountCode}`,
      };
      console.log(`Applied discount: ${discountCode} - ${discountInfo.type} ${discountInfo.value}`);
    }

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
      return new Response(`Failed to create order: ${errorText}`, { status: 502 });
    }

    const draftOrderData = await createResponse.json();
    const invoiceUrl = draftOrderData.draft_order?.invoice_url;

    if (!invoiceUrl) {
      console.error('No invoice_url in draft order response');
      return new Response('No checkout URL returned from Shopify', { status: 502 });
    }

    const checkoutUrl = new URL(invoiceUrl);
    checkoutUrl.searchParams.set('locale', 'en');

    console.log(`Redirecting to Shopify checkout`);

    return new Response(null, {
      status: 303,
      headers: {
        'Location': checkoutUrl.toString(),
      },
    });
  } catch (error) {
    console.error('Error in shopify-checkout-redirect:', error);
    return new Response(`Internal error: ${(error as Error).message}`, { status: 500 });
  }
});
