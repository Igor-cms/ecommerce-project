import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Step 1: Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Role check
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'owner');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Shopify credentials
    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!storeName || !accessToken) {
      return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopifyHeaders = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
    const baseUrl = `https://${storeName}.myshopify.com/admin/api/2025-04`;

    // Step 4: Fetch custom and smart collections in parallel
    const [customRes, smartRes] = await Promise.all([
      fetch(`${baseUrl}/custom_collections.json?limit=250`, { headers: shopifyHeaders }),
      fetch(`${baseUrl}/smart_collections.json?limit=250`, { headers: shopifyHeaders }),
    ]);

    if (!customRes.ok || !smartRes.ok) {
      const errorText = !customRes.ok ? await customRes.text() : await smartRes.text();
      console.error('[SHOPIFY] Failed to fetch collections:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch collections from Shopify', details: errorText }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customData = await customRes.json();
    const smartData = await smartRes.json();

    const collections = [
      ...(customData.custom_collections || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        type: 'custom' as const,
      })),
      ...(smartData.smart_collections || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        type: 'smart' as const,
      })),
    ];

    console.log(`[COLLECTIONS] Fetched ${collections.length} collections`);

    return new Response(
      JSON.stringify({ collections }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ERROR] Unhandled:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
