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

const parseShopifyErrors = (errorData: any): string => {
  const errors = errorData?.errors;
  if (errors && typeof errors === 'object') {
    return Object.entries(errors)
      .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
      .join('; ');
  }
  return typeof errors === 'string' ? errors : 'Unknown Shopify error';
};

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

  const apiBase = `https://${storeName}.myshopify.com/admin/api/2025-04`;
  const shopifyHeaders = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  try {
    const { price_rule_id, discount_code_id, code, percentage, status, previous_code } = await req.json();

    if (!price_rule_id) return json({ error: 'price_rule_id is required' }, 400);
    if (!code || typeof code !== 'string' || code.trim().length === 0 || code.trim().length > 100) {
      return json({ error: 'Invalid code' }, 400);
    }
    const numericPct = Number(percentage);
    if (!Number.isFinite(numericPct) || numericPct < 1 || numericPct > 100) {
      return json({ error: 'Percentage must be between 1 and 100' }, 400);
    }
    if (status !== 'active' && status !== 'disabled') {
      return json({ error: 'Status must be active or disabled' }, 400);
    }

    const trimmedCode = code.trim().toUpperCase();
    const now = new Date().toISOString();

    const pricePayload = {
      price_rule: {
        id: price_rule_id,
        title: trimmedCode,
        value_type: 'percentage',
        value: `-${numericPct}`,
        starts_at: now,
        ends_at: status === 'disabled' ? now : null,
      },
    };

    const ruleRes = await fetch(`${apiBase}/price_rules/${price_rule_id}.json`, {
      method: 'PUT',
      headers: shopifyHeaders,
      body: JSON.stringify(pricePayload),
    });

    if (!ruleRes.ok) {
      const errData = await ruleRes.json().catch(() => null);
      return json({ error: parseShopifyErrors(errData) }, 422);
    }

    if (discount_code_id && trimmedCode !== (previous_code ?? '').toUpperCase()) {
      const codeRes = await fetch(
        `${apiBase}/price_rules/${price_rule_id}/discount_codes/${discount_code_id}.json`,
        {
          method: 'PUT',
          headers: shopifyHeaders,
          body: JSON.stringify({ discount_code: { id: discount_code_id, code: trimmedCode } }),
        }
      );
      if (!codeRes.ok) {
        const errData = await codeRes.json().catch(() => null);
        return json({ error: parseShopifyErrors(errData) }, 422);
      }
    }

    return json({ success: true });
  } catch (error: any) {
    console.error('Error in shopify-update-discount:', error);
    return json({ error: error.message || 'Failed to update discount' }, 500);
  }
});
