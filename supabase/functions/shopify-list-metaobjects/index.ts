import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth: admin/owner only
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'owner');
    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden - admin role required' }, 403);
    }

    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    if (!storeName || !accessToken) {
      return jsonResponse({ error: 'Shopify credentials not configured' }, 500);
    }

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    if (!type) {
      return jsonResponse({ error: 'type query param is required' }, 400);
    }

    // GraphQL: paginate metaobjects of the given type (up to 250 per call)
    const items: Array<{ gid: string; name: string }> = [];
    let cursor: string | null = null;
    let pages = 0;
    const MAX_PAGES = 5; // safety cap: 1250 items

    do {
      const query = `
        query ListMetaobjects($type: String!, $first: Int!, $after: String) {
          metaobjects(type: $type, first: $first, after: $after) {
            edges {
              cursor
              node { id displayName fields { key value } }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;

      const res = await fetch(
        `https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`,
        {
          method: 'POST',
          headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { type, first: 250, after: cursor } }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[SHOPIFY] metaobjects query HTTP ${res.status}:`, errorText);
        return jsonResponse({ error: 'Shopify list metaobjects failed', details: errorText }, res.status);
      }

      const data = await res.json();
      const errors = data.errors;
      if (errors && errors.length) {
        console.error('[SHOPIFY] GraphQL errors:', JSON.stringify(errors));
        return jsonResponse({ error: 'GraphQL errors', errors }, 400);
      }

      const edges = data?.data?.metaobjects?.edges || [];
      for (const edge of edges) {
        const node = edge.node;
        const name =
          node.displayName ||
          node.fields?.find((f: any) => f.key === 'name')?.value ||
          '';
        if (name) items.push({ gid: node.id, name });
      }

      const pageInfo = data?.data?.metaobjects?.pageInfo;
      cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
      pages++;
    } while (cursor && pages < MAX_PAGES);

    // Deduplicate and sort by name for stable UX
    const seen = new Set<string>();
    const unique = items.filter(i => {
      if (seen.has(i.gid)) return false;
      seen.add(i.gid);
      return true;
    });
    unique.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[SHOPIFY] Listed ${unique.length} metaobject(s) of type "${type}"`);
    return jsonResponse({ type, items: unique });
  } catch (error) {
    console.error('[ERROR] shopify-list-metaobjects:', error);
    return jsonResponse({ error: 'Internal server error', message: (error as Error).message }, 500);
  }
});
