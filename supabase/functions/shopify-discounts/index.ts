import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface PriceRule {
  id: number;
  title: string;
  value_type: 'percentage' | 'fixed_amount';
  value: string;
  target_type: string;
  target_selection: string;
  allocation_method: string;
  customer_selection: string;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  once_per_customer: boolean;
  created_at: string;
  updated_at: string;
}

interface DiscountCode {
  id: number;
  price_rule_id: number;
  code: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

function computeStatus(rule: PriceRule): 'active' | 'scheduled' | 'expired' {
  const now = new Date();
  if (rule.starts_at && new Date(rule.starts_at) > now) return 'scheduled';
  if (rule.ends_at && new Date(rule.ends_at) < now) return 'expired';
  return 'active';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

  if (!storeName || !accessToken) {
    return respond({ error: 'Server configuration error' }, 500);
  }

  const shopifyHeaders = { 'X-Shopify-Access-Token': accessToken };
  const apiBase = `https://${storeName}.myshopify.com/admin/api/2025-04`;

  try {
    const rulesRes = await fetch(
      `${apiBase}/price_rules.json?limit=250`,
      { headers: shopifyHeaders }
    );

    if (!rulesRes.ok) {
      console.error(`Failed to fetch price rules: ${rulesRes.status}`);
      return respond({ error: 'Failed to fetch price rules' }, 502);
    }

    const { price_rules } = await rulesRes.json() as { price_rules: PriceRule[] };

    const discounts = await Promise.all(
      price_rules.map(async (rule) => {
        let codes: DiscountCode[] = [];
        try {
          const codesRes = await fetch(
            `${apiBase}/price_rules/${rule.id}/discount_codes.json`,
            { headers: shopifyHeaders }
          );
          if (codesRes.ok) {
            const data = await codesRes.json();
            codes = data.discount_codes || [];
          }
        } catch (e) {
          console.error(`Failed to fetch codes for rule ${rule.id}:`, e);
        }

        const status = computeStatus(rule);
        const value = Math.abs(parseFloat(rule.value));
        const primary = codes[0];
        const totalUsage = codes.reduce((sum, c) => sum + (c.usage_count || 0), 0);

        return {
          id: rule.id,
          price_rule_id: rule.id,
          discount_code_id: primary?.id ?? null,
          code: primary?.code ?? null,
          codes_count: codes.length,
          title: rule.title,
          value_type: rule.value_type,
          value,
          status,
          starts_at: rule.starts_at,
          ends_at: rule.ends_at,
          usage_limit: rule.usage_limit,
          usage_count: totalUsage,
          once_per_customer: rule.once_per_customer,
          target_type: rule.target_type,
          target_selection: rule.target_selection,
          customer_selection: rule.customer_selection,
          created_at: rule.created_at,
        };
      })
    );

    discounts.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return respond({ discounts, count: discounts.length });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    return respond({ error: 'Failed to fetch discounts' }, 500);
  }
});
