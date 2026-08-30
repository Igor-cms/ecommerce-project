import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const isAdminOrOwner = roles?.some((r: any) => r.role === 'admin' || r.role === 'owner');
  if (!isAdminOrOwner) return json({ error: 'Forbidden' }, 403);

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  if (!storeName || !accessToken) return json({ error: 'Shopify credentials not configured' }, 500);

  try {
    const { price_rule_id } = await req.json();
    if (!price_rule_id) return json({ error: 'price_rule_id is required' }, 400);

    const res = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2025-04/price_rules/${price_rule_id}.json`,
      {
        method: 'DELETE',
        headers: { 'X-Shopify-Access-Token': accessToken },
      }
    );

    if (!res.ok && res.status !== 404) {
      const errText = await res.text().catch(() => '');
      return json({ error: `Shopify error: ${res.status} ${errText}` }, 422);
    }

    return json({ success: true });
  } catch (error: any) {
    console.error('Error in shopify-delete-discount:', error);
    return json({ error: error.message || 'Failed to delete discount' }, 500);
  }
});
