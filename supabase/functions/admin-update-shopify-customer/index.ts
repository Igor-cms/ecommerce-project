import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Retry Shopify request when hitting rate limit (HTTP 429)
async function shopifyFetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429 || attempt === maxRetries) return res;
    // Honor Retry-After header if present, otherwise exponential backoff
    const retryAfter = parseFloat(res.headers.get('Retry-After') || '');
    const waitMs = isNaN(retryAfter) ? 500 * Math.pow(2, attempt) : Math.max(500, retryAfter * 1000);
    console.log(`Shopify 429 — retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  // Unreachable, but TS needs it
  return fetch(url, init);
}

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
    const { customerId, email, first_name, last_name, phone, note, accepts_marketing, tags } = body;

    // Resolve customer ID
    let resolvedId: number | null = null;

    if (customerId) {
      resolvedId = customerId;
    } else if (email) {
      // Search for customer by email
      const searchRes = await shopifyFetchWithRetry(
        `https://${storeName}.myshopify.com/admin/api/2025-04/customers/search.json?query=email:${encodeURIComponent(email)}`,
        { headers: { 'X-Shopify-Access-Token': accessToken } }
      );
      const searchData = await searchRes.json();

      // Exact email match to avoid Shopify fuzzy search issues
      const customer = searchData.customers?.find(
        (c: any) => c.email?.toLowerCase() === email.toLowerCase()
      );

      if (!customer) {
        return new Response(
          JSON.stringify({ success: false, shopify_not_found: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      resolvedId = customer.id;
    } else {
      return new Response(JSON.stringify({ error: 'customerId or email is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build update payload with only provided fields
    const customerPayload: any = { customer: { id: resolvedId } };
    if (first_name !== undefined) customerPayload.customer.first_name = first_name;
    if (last_name !== undefined) customerPayload.customer.last_name = last_name;
    if (email !== undefined) customerPayload.customer.email = email;
    if (phone !== undefined) customerPayload.customer.phone = phone;
    if (note !== undefined) customerPayload.customer.note = note;
    if (accepts_marketing !== undefined) customerPayload.customer.accepts_marketing = accepts_marketing;
    if (tags !== undefined) customerPayload.customer.tags = tags;

    console.log(`Updating customer: id=${resolvedId}`, JSON.stringify(customerPayload.customer));

    const response = await shopifyFetchWithRetry(
      `https://${storeName}.myshopify.com/admin/api/2025-04/customers/${resolvedId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error(`Shopify PUT failed: status=${response.status}`, JSON.stringify(errorData));
      const errors = errorData?.errors;

      // Shopify returns { errors: { "email": ["has already been taken"], ... } }
      if (errors && typeof errors === 'object') {
        const messages = Object.entries(errors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
          .join('; ');
        return new Response(JSON.stringify({ error: messages }), {
          status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: `Shopify error: ${response.status}` }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const customer = data.customer;

    console.log(`Customer updated: id=${customer.id}, name=${customer.first_name} ${customer.last_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        customer: {
          id: customer.id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in admin-update-shopify-customer:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
