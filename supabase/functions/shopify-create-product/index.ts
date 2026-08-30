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

    const shopifyHeaders = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
    const baseUrl = `https://${storeName}.myshopify.com/admin/api/2025-04`;

    // Step 4: Parse payload
    const body = await req.json();
    const {
      title,
      bodyHtml,
      vendor,
      productType,
      status,
      tags,
      collectionId,
      variants,
      options,
      images,
    } = body;

    console.log(`[PAYLOAD] title=${title}, status=${status}, variants=${variants?.length || 0}, collectionId=${collectionId || 'none'}`);

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one variant is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 5: Build Shopify product payload
    const shopifyVariants = variants.map((v: any) => {
      const variant: Record<string, any> = {
        price: String(v.price),
        requires_shipping: v.requiresShipping !== false,
        inventory_management: 'shopify',
      };
      if (v.option1) variant.option1 = String(v.option1);
      if (v.option2) variant.option2 = String(v.option2);
      if (v.option3) variant.option3 = String(v.option3);
      if (v.sku) variant.sku = v.sku;
      if (v.weight !== undefined && v.weight !== null && v.weight !== '') {
        variant.weight = Number(v.weight);
        variant.weight_unit = v.weightUnit || 'g';
      }
      return variant;
    });

    const productPayload: Record<string, any> = {
      title: title.trim(),
      status: status || 'draft',
      variants: shopifyVariants,
    };

    if (bodyHtml) productPayload.body_html = bodyHtml;
    if (vendor) productPayload.vendor = vendor;
    if (productType) productPayload.product_type = productType;
    if (tags) productPayload.tags = tags;
    if (options && Array.isArray(options) && options.length > 0) {
      productPayload.options = options;
    }
    if (images && Array.isArray(images) && images.length > 0) {
      productPayload.images = images.map((img: any) => ({ src: img.src }));
    }

    console.log(`[SHOPIFY] Creating product:`, JSON.stringify(productPayload));

    // Step 6: Create the product
    const createRes = await fetch(`${baseUrl}/products.json`, {
      method: 'POST',
      headers: shopifyHeaders,
      body: JSON.stringify({ product: productPayload }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error(`[SHOPIFY] Product creation failed: ${createRes.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: 'Shopify product creation failed', details: errorText }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createData = await createRes.json();
    const product = createData.product;
    console.log(`[SHOPIFY] Product created: id=${product.id}, title="${product.title}"`);

    // Step 7: Add to collection (if collectionId provided)
    let collectionAdded = false;
    if (collectionId) {
      try {
        const collectRes = await fetch(`${baseUrl}/collects.json`, {
          method: 'POST',
          headers: shopifyHeaders,
          body: JSON.stringify({
            collect: {
              product_id: product.id,
              collection_id: Number(collectionId),
            },
          }),
        });

        if (collectRes.ok) {
          collectionAdded = true;
          console.log(`[SHOPIFY] Product added to collection ${collectionId}`);
        } else {
          const collectError = await collectRes.text();
          console.warn(`[SHOPIFY] Failed to add to collection: ${collectError}`);
        }
      } catch (err) {
        console.warn(`[SHOPIFY] Collection assignment error:`, err);
      }
    }

    // Step 8: Set inventory levels (if any variant has inventoryQuantity)
    let inventorySet = false;
    const variantsWithInventory = variants
      .map((v: any, i: number) => ({
        inventoryQuantity: v.inventoryQuantity,
        inventoryItemId: product.variants?.[i]?.inventory_item_id,
      }))
      .filter((v: any) => v.inventoryQuantity !== undefined && v.inventoryQuantity !== null && v.inventoryQuantity !== '' && v.inventoryItemId);

    if (variantsWithInventory.length > 0) {
      try {
        // Get primary location
        const locRes = await fetch(`${baseUrl}/locations.json`, { headers: shopifyHeaders });
        if (locRes.ok) {
          const locData = await locRes.json();
          const locationId = locData.locations?.[0]?.id;

          if (locationId) {
            let allSet = true;
            for (const v of variantsWithInventory) {
              const invRes = await fetch(`${baseUrl}/inventory_levels/set.json`, {
                method: 'POST',
                headers: shopifyHeaders,
                body: JSON.stringify({
                  location_id: locationId,
                  inventory_item_id: v.inventoryItemId,
                  available: Number(v.inventoryQuantity),
                }),
              });

              if (!invRes.ok) {
                const invError = await invRes.text();
                console.warn(`[SHOPIFY] Failed to set inventory for item ${v.inventoryItemId}: ${invError}`);
                allSet = false;
              } else {
                console.log(`[SHOPIFY] Inventory set for item ${v.inventoryItemId}: ${v.inventoryQuantity}`);
              }
            }
            inventorySet = allSet;
          }
        }
      } catch (err) {
        console.warn(`[SHOPIFY] Inventory setting error:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        variantsCreated: product.variants?.length || 0,
        collectionAdded,
        inventorySet,
      }),
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
