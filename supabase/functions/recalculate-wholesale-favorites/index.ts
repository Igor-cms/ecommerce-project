// Recalculates a user's favorites for the wholesale experience.
// Removes favorited product slugs that do not have any wholesale variant in Shopify.
// Invoked by the admin WholesaleTab when approving an application, or self-invoked by
// an approved wholesale user (e.g., on first Favorites page load after promotion).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyVariant {
  option2: string | null;
}

interface ShopifyProduct {
  handle: string;
  variants: ShopifyVariant[];
}

async function fetchAllShopifyProducts(storeName: string, accessToken: string): Promise<ShopifyProduct[]> {
  const results: ShopifyProduct[] = [];
  // Fetch a generous page — store has well under 250 active products. Adjust if the store grows.
  const url = `https://${storeName}.myshopify.com/admin/api/2025-04/products.json?limit=250&status=active&fields=handle,variants`;
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Shopify products fetch failed: ${res.status}`);
  }
  const data = await res.json();
  for (const p of (data.products || [])) {
    results.push({
      handle: p.handle,
      variants: (p.variants || []).map((v: any) => ({ option2: v.option2 ?? null })),
    });
  }
  return results;
}

function hasWholesaleVariant(product: ShopifyProduct): boolean {
  return product.variants.some(v => (v.option2 || '').toLowerCase() === 'wholesale');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized - no auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client scoped to caller (for auth + role check)
    const supabaseCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseCaller.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedUserId: string | undefined = body?.user_id;

    // Authorization:
    // - Admin/owner can recalculate for any user_id.
    // - Any authenticated user can recalculate their own favorites (self-service).
    let targetUserId = user.id;
    if (requestedUserId && requestedUserId !== user.id) {
      const { data: roles } = await supabaseCaller
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'owner');
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden - admin role required to recalculate for another user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      targetUserId = requestedUserId;
    }

    // Service-role client for unrestricted reads/deletes on the target user's favorites
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: favRows, error: favError } = await supabaseAdmin
      .from('favorites')
      .select('product_slug')
      .eq('user_id', targetUserId);

    if (favError) {
      return new Response(JSON.stringify({ error: favError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const favoriteSlugs: string[] = (favRows || []).map((r: any) => r.product_slug);
    if (favoriteSlugs.length === 0) {
      return new Response(JSON.stringify({ removed: [], count: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!storeName || !accessToken) {
      return new Response(JSON.stringify({ error: 'Shopify credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const products = await fetchAllShopifyProducts(storeName, accessToken);
    const wholesaleSlugs = new Set(products.filter(hasWholesaleVariant).map(p => p.handle));

    const toRemove = favoriteSlugs.filter(slug => !wholesaleSlugs.has(slug));

    if (toRemove.length === 0) {
      return new Response(JSON.stringify({ removed: [], count: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('favorites')
      .delete()
      .eq('user_id', targetUserId)
      .in('product_slug', toRemove);

    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ removed: toRemove, count: toRemove.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
