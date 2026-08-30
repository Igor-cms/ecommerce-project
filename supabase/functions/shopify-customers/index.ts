import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeName || !accessToken) {
      throw new Error('Missing Shopify credentials');
    }

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');

    if (mode === 'count') {
      const countUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/customers/count.json`;
      const countRes = await fetch(countUrl, {
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      });
      if (!countRes.ok) throw new Error(`Shopify count error: ${countRes.status}`);
      const countData = await countRes.json();
      return new Response(JSON.stringify({ count: countData.count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const query = url.searchParams.get('query') || '';
    const pageInfo = url.searchParams.get('page_info') || '';
    const limit = 50;

    let shopifyUrl: string;
    if (pageInfo) {
      shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/customers.json?limit=${limit}&page_info=${pageInfo}`;
    } else if (query) {
      shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/customers/search.json?limit=${limit}&query=${encodeURIComponent(query)}`;
    } else {
      shopifyUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/customers.json?limit=${limit}`;
    }

    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify API error:', response.status, errorText);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    // Parse pagination from Link header
    const linkHeader = response.headers.get('Link') || '';
    let nextPageInfo: string | null = null;
    let prevPageInfo: string | null = null;

    if (linkHeader) {
      const links = linkHeader.split(',');
      for (const link of links) {
        const match = link.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="(\w+)"/);
        if (match) {
          if (match[2] === 'next') nextPageInfo = match[1];
          if (match[2] === 'previous') prevPageInfo = match[1];
        }
      }
    }

    const data = await response.json();
    const customers = (data.customers || []).map((c: any) => ({
      id: c.id,
      name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
      email: c.email,
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      phone: c.phone || '',
      note: c.note || '',
      tags: c.tags || '',
      accepts_marketing: c.accepts_marketing || false,
      city: c.default_address?.city || '',
      country: c.default_address?.country || '',
      orders_count: c.orders_count || 0,
      total_spent: c.total_spent || '0.00',
      currency: c.currency || 'EUR',
      default_address: c.default_address ? {
        address1: c.default_address.address1 || '',
        address2: c.default_address.address2 || '',
        city: c.default_address.city || '',
        province: c.default_address.province || '',
        country: c.default_address.country || '',
        zip: c.default_address.zip || '',
        phone: c.default_address.phone || '',
      } : null,
    }));

    return new Response(JSON.stringify({
      customers,
      pagination: {
        next: nextPageInfo,
        previous: prevPageInfo,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
