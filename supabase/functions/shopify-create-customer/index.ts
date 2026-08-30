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
    const { firstName, lastName, email, phone, company, tags, note, acceptsMarketing } = body;

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: 'Email or phone is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerPayload: any = {
      customer: {},
    };

    if (firstName) customerPayload.customer.first_name = firstName;
    if (lastName) customerPayload.customer.last_name = lastName;
    if (email) customerPayload.customer.email = email;
    if (phone) customerPayload.customer.phone = phone;
    if (tags) customerPayload.customer.tags = tags;
    if (note) customerPayload.customer.note = note;
    if (acceptsMarketing) customerPayload.customer.accepts_marketing = true;

    if (company) {
      customerPayload.customer.addresses = [{ company }];
    }

    console.log(`Creating customer: ${firstName ?? ''} ${lastName ?? ''} (${email ?? phone})`);

    const response = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2025-04/customers.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
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

    console.log(`Customer created: id=${customer.id}, name=${customer.first_name} ${customer.last_name}`);

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
    console.error('Error in shopify-create-customer:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
