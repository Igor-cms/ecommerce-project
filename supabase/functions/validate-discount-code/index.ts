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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

  if (!storeName || !accessToken) {
    return respond({ valid: false, error: 'Server configuration error' }, 500);
  }

  const shopifyHeaders = { 'X-Shopify-Access-Token': accessToken };
  const apiBase = `https://${storeName}.myshopify.com/admin/api/2025-04`;

  try {
    const { code, customerEmail } = await req.json();

    if (!code || typeof code !== 'string' || code.trim().length === 0 || code.trim().length > 100) {
      return respond({ valid: false, error: 'Invalid discount code' }, 400);
    }

    const trimmedCode = code.trim().toUpperCase();
    console.log(`Validating discount code: ${trimmedCode}`);

    // Look up the discount code via Shopify Admin API
    const lookupRes = await fetch(
      `${apiBase}/discount_codes/lookup.json?code=${encodeURIComponent(trimmedCode)}`,
      { headers: shopifyHeaders, redirect: 'manual' }
    );

    // Shopify returns 303 redirect to the discount code resource if found
    if (lookupRes.status !== 303) {
      return respond({ valid: false, error: 'Invalid or expired code' });
    }

    const location = lookupRes.headers.get('location');
    if (!location) {
      return respond({ valid: false, error: 'Invalid or expired code' });
    }

    // Extract price_rule_id and discount_code_id from the redirect URL
    const priceRuleMatch = location.match(/price_rules\/(\d+)/);
    const discountCodeIdMatch = location.match(/discount_codes\/(\d+)/);
    if (!priceRuleMatch) {
      return respond({ valid: false, error: 'Invalid or expired code' });
    }

    const priceRuleId = priceRuleMatch[1];
    const discountCodeId = discountCodeIdMatch?.[1];

    // Fetch the price rule details
    const priceRuleRes = await fetch(
      `${apiBase}/price_rules/${priceRuleId}.json`,
      { headers: shopifyHeaders }
    );

    if (!priceRuleRes.ok) {
      console.error(`Failed to fetch price rule: ${priceRuleRes.status}`);
      return respond({ valid: false, error: 'Could not verify discount' });
    }

    const { price_rule } = await priceRuleRes.json();

    // Check if the price rule is currently active
    const now = new Date();
    if (price_rule.starts_at && new Date(price_rule.starts_at) > now) {
      return respond({ valid: false, error: 'This discount is not yet active' });
    }
    if (price_rule.ends_at && new Date(price_rule.ends_at) < now) {
      return respond({ valid: false, error: 'This discount has expired' });
    }

    // --- Usage limit check (total cap) ---
    if (price_rule.usage_limit !== null && price_rule.usage_limit !== undefined) {
      // Fetch the specific discount code to get usage_count
      if (discountCodeId) {
        const codeRes = await fetch(
          `${apiBase}/price_rules/${priceRuleId}/discount_codes/${discountCodeId}.json`,
          { headers: shopifyHeaders }
        );
        if (codeRes.ok) {
          const { discount_code } = await codeRes.json();
          if (discount_code && discount_code.usage_count >= price_rule.usage_limit) {
            console.log(`Code ${trimmedCode} has reached usage limit: ${discount_code.usage_count}/${price_rule.usage_limit}`);
            return respond({ valid: false, error: 'This discount has reached its usage limit' });
          }
        }
      }
    }

    // --- Once per customer check ---
    if (price_rule.once_per_customer && customerEmail && typeof customerEmail === 'string') {
      const sanitizedEmail = customerEmail.trim().toLowerCase();
      console.log(`Checking once_per_customer for: ${sanitizedEmail.substring(0, 3)}***`);

      const custRes = await fetch(
        `${apiBase}/customers/search.json?query=email:${encodeURIComponent(sanitizedEmail)}`,
        { headers: shopifyHeaders }
      );
      if (custRes.ok) {
        const { customers } = await custRes.json();
        if (customers?.length > 0) {
          const customerId = customers[0].id;
          // Search orders that used this discount code
          const ordersRes = await fetch(
            `${apiBase}/orders.json?status=any&customer_id=${customerId}&fields=id,discount_codes`,
            { headers: shopifyHeaders }
          );
          if (ordersRes.ok) {
            const { orders } = await ordersRes.json();
            const alreadyUsed = orders?.some((o: any) =>
              o.discount_codes?.some((dc: any) => dc.code.toUpperCase() === trimmedCode)
            );
            if (alreadyUsed) {
              console.log(`Customer already used code ${trimmedCode}`);
              return respond({ valid: false, error: 'You have already used this discount code' });
            }
          }
        }
      }
    }

    // Determine discount type and value
    const valueType = price_rule.value_type; // "percentage" or "fixed_amount"
    const value = Math.abs(parseFloat(price_rule.value)); // Shopify returns negative values

    // Resolve entitled product handles for product-level restrictions
    let entitled_product_handles: string[] = [];

    if (price_rule.target_selection === 'entitled' && price_rule.entitled_product_ids?.length > 0) {
      const handlePromises = price_rule.entitled_product_ids.map(async (pid: string) => {
        try {
          const pRes = await fetch(
            `${apiBase}/products/${pid}.json?fields=handle`,
            { headers: shopifyHeaders }
          );
          if (pRes.ok) {
            const { product } = await pRes.json();
            return product?.handle || null;
          }
        } catch (e) {
          console.error(`Failed to fetch product ${pid}:`, e);
        }
        return null;
      });
      const handles = await Promise.all(handlePromises);
      entitled_product_handles = handles.filter(Boolean);
    }

    console.log(`Discount valid: ${trimmedCode} - ${valueType} ${value}, entitled: [${entitled_product_handles.join(',')}]`);

    return respond({
      valid: true,
      type: valueType,
      value,
      title: trimmedCode,
      entitled_product_handles,
    });

  } catch (error) {
    console.error('Error validating discount code:', error);
    return respond({ valid: false, error: 'Failed to validate discount code' }, 500);
  }
});
