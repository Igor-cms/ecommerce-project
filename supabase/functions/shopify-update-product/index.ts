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
    console.log(`[AUTH] Authorization header present: ${!!authHeader}`);
    
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
      console.log('[AUTH] Invalid user:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[AUTH] User: ${user.id}`);

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

    // Step 4: Parse payload
    const body = await req.json();
    const { productId, title, body_html, tags, status, variants, options, metafields } = body;
    console.log(`[PAYLOAD] productId: ${productId}, title=${title !== undefined}, body_html=${body_html !== undefined}, tags=${tags !== undefined}, status=${status !== undefined}, options=${options?.length || 0}, variants=${variants?.length || 0}, metafields=${metafields?.length || 0}`);

    if (!productId) {
      return new Response(JSON.stringify({ error: 'productId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopifyHeaders = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
    const baseUrl = `https://${storeName}.myshopify.com/admin/api/2025-04`;

    // Detect "matrix mode": caller provided full options + variants array (with option1/2/3),
    // meaning we should replace the structure (create/update/delete variants).
    // Otherwise stay in legacy "incremental" mode (per-variant price patch).
    const isMatrixMode = Array.isArray(options) && options.length > 0
      && Array.isArray(variants) && variants.some((v: any) => v.option1 !== undefined || v.option2 !== undefined || v.option3 !== undefined);

    // Step 5: Update product-level fields. In matrix mode, send options + variants in the SAME PUT.
    const hasProductFields = title !== undefined || body_html !== undefined || tags !== undefined || status !== undefined;

    const variantResults: any[] = [];

    if (isMatrixMode) {
      const productUpdate: Record<string, any> = { id: Number(productId) };
      if (title !== undefined) productUpdate.title = title;
      if (body_html !== undefined) productUpdate.body_html = body_html;
      if (tags !== undefined) productUpdate.tags = tags;
      if (status !== undefined) productUpdate.status = status;

      productUpdate.options = options.map((o: any) => {
        const opt: Record<string, any> = { name: String(o.name), values: (o.values || []).map((v: any) => String(v)) };
        if (o.id) opt.id = Number(o.id);
        if (o.position) opt.position = Number(o.position);
        return opt;
      });

      productUpdate.variants = variants.map((v: any) => {
        const variant: Record<string, any> = {};
        if (v.id) variant.id = Number(v.id);
        if (v.option1 !== undefined) variant.option1 = v.option1 == null ? null : String(v.option1);
        if (v.option2 !== undefined) variant.option2 = v.option2 == null ? null : String(v.option2);
        if (v.option3 !== undefined) variant.option3 = v.option3 == null ? null : String(v.option3);
        if (v.price !== undefined) variant.price = String(v.price);
        if (v.sku !== undefined) variant.sku = String(v.sku);
        if (!v.id) {
          // New variant defaults
          variant.inventory_management = 'shopify';
          variant.requires_shipping = true;
        }
        return variant;
      });

      console.log(`[SHOPIFY] Matrix PUT product ${productId}: ${productUpdate.options.length} option(s), ${productUpdate.variants.length} variant(s)`);

      const response = await fetch(`${baseUrl}/products/${productId}.json`, {
        method: 'PUT',
        headers: shopifyHeaders,
        body: JSON.stringify({ product: productUpdate }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SHOPIFY] Matrix update failed: ${response.status} - ${errorText}`);
        // Try to parse Shopify's structured `{ errors: { ... } }` envelope.
        let parsedErrors: any = null;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed && typeof parsed === 'object' && parsed.errors) parsedErrors = parsed.errors;
        } catch (_) { /* keep raw */ }
        return new Response(
          JSON.stringify({
            error: 'Shopify product update failed',
            errors: parsedErrors,
            details: errorText,
          }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const result = await response.json();
      console.log(`[SHOPIFY] Matrix update OK — ${result.product?.variants?.length || 0} variants now on product`);
      variantResults.push(...(result.product?.variants || []).map((v: any) => ({ id: v.id, success: true, variant: v })));
    } else {
      if (hasProductFields) {
        const productUpdate: Record<string, any> = { id: Number(productId) };
        if (title !== undefined) productUpdate.title = title;
        if (body_html !== undefined) productUpdate.body_html = body_html;
        if (tags !== undefined) productUpdate.tags = tags;
        if (status !== undefined) productUpdate.status = status;

        console.log(`[SHOPIFY] Updating product fields:`, JSON.stringify(productUpdate));

        const response = await fetch(`${baseUrl}/products/${productId}.json`, {
          method: 'PUT',
          headers: shopifyHeaders,
          body: JSON.stringify({ product: productUpdate }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[SHOPIFY] Product update failed: ${response.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ error: 'Shopify product update failed', details: errorText }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`[SHOPIFY] Product fields updated successfully`);
      }

      // Legacy per-variant patch (price/sku only)
      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          const variantId = Number(v.id);
          const variantUpdate: Record<string, any> = { id: variantId };
          if (v.price !== undefined) variantUpdate.price = String(v.price);
          if (v.sku !== undefined) variantUpdate.sku = String(v.sku);

          console.log(`[SHOPIFY] Updating variant ${variantId}:`, JSON.stringify(variantUpdate));

          const response = await fetch(`${baseUrl}/variants/${variantId}.json`, {
            method: 'PUT',
            headers: shopifyHeaders,
            body: JSON.stringify({ variant: variantUpdate }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SHOPIFY] Variant ${variantId} update failed: ${response.status} - ${errorText}`);
            variantResults.push({ id: variantId, success: false, error: errorText });
          } else {
            const result = await response.json();
            console.log(`[SHOPIFY] Variant ${variantId} updated successfully`);
            variantResults.push({ id: variantId, success: true, variant: result.variant });
          }
        }
      }
    }

    const failedVariants = variantResults.filter(r => r.success === false);
    if (failedVariants.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Some variant updates failed', failedVariants, variantResults }),
        { status: 207, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 7: Update product metafields via GraphQL metafieldsSet (upsert)
    let metafieldResults: any = null;
    if (metafields && Array.isArray(metafields) && metafields.length > 0) {
      const ownerId = `gid://shopify/Product/${productId}`;
      const inputs = metafields
        .filter((m: any) => m && m.namespace && m.key && m.value !== undefined)
        .map((m: any) => ({
          ownerId,
          namespace: String(m.namespace),
          key: String(m.key),
          value: String(m.value),
          type: String(m.type || 'single_line_text_field'),
        }));

      if (inputs.length > 0) {
        const mutation = `
          mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key namespace value type }
              userErrors { field message code }
            }
          }
        `;

        console.log(`[SHOPIFY] Setting ${inputs.length} metafield(s) for product ${productId}`);

        const gqlRes = await fetch(`${baseUrl}/graphql.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({ query: mutation, variables: { metafields: inputs } }),
        });

        if (!gqlRes.ok) {
          const errorText = await gqlRes.text();
          console.error(`[SHOPIFY] metafieldsSet HTTP error: ${gqlRes.status} - ${errorText}`);
          return new Response(
            JSON.stringify({ error: 'Shopify metafields update failed', details: errorText }),
            { status: gqlRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const gqlData = await gqlRes.json();
        const userErrors = gqlData?.data?.metafieldsSet?.userErrors || [];
        if (userErrors.length > 0) {
          console.error(`[SHOPIFY] metafieldsSet userErrors:`, JSON.stringify(userErrors));
          return new Response(
            JSON.stringify({ error: 'Shopify rejected one or more metafields', userErrors }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        metafieldResults = gqlData?.data?.metafieldsSet?.metafields || [];
        console.log(`[SHOPIFY] ${metafieldResults.length} metafield(s) updated successfully`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, variantResults, metafieldResults }),
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
