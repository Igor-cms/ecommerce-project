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
    return new Response(
      JSON.stringify({ error: 'Shopify credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ eligible: false, reason: 'No email provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query Shopify orders by customer email
    const shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/orders.json?email=${encodeURIComponent(email)}&status=any&limit=250`;

    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Shopify API error: ${response.status}`);
      return new Response(
        JSON.stringify({ eligible: true, reason: 'Could not verify history' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const orders = data.orders || [];

    // Check if any non-cancelled order contains a "sample" line item
    const hasPurchasedSample = orders.some((order: any) => {
      if (order.cancelled_at) return false;
      return (order.line_items || []).some((item: any) =>
        item.title?.toLowerCase().includes('sample')
      );
    });

    return new Response(
      JSON.stringify({
        eligible: !hasPurchasedSample,
        hasPurchased: hasPurchasedSample,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking sample eligibility:', error);
    return new Response(
      JSON.stringify({ eligible: true, reason: 'Error checking history' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
