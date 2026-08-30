// Shopify Products Edge Function - Fetches products from Shopify collections
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ShopifyProduct {
  id: number;
  handle: string;
  title: string;
  body_html: string;
  product_type: string;
  tags: string;
  variants: Array<{
    id: number;
    price: string;
    compare_at_price: string | null;
    sku: string;
    inventory_quantity: number;
    option1: string | null;
    option2: string | null;
    option3: string | null;
  }>;
  images: Array<{
    id: number;
    src: string;
    alt: string | null;
  }>;
  options: Array<{
    id?: number;
    name: string;
    values: string[];
    position?: number;
  }>;
}

interface ShopifyCollection {
  id: number;
  handle: string;
  title: string;
}

interface CoffeeDetails {
  origin: string;
  elevation_m: number;
  process: string;
  variety: string;
  roast_style: string;
  flavor_notes: string[];
  flavor_refs?: { gid: string; name: string }[];
  flavor_metafield?: { namespace: string; key: string; type: string };
  flavor_metaobject_type?: string;
  grind_options: string[];
  weight_options_g: number[];
  subscriptionEligible: boolean;
  limitedRelease: boolean;
  benQuote: string;
  country?: string;
  caffeine_content?: string;
  coffee_roast?: string;
  grind_size?: string;
  producer?: string;
  harvest?: string;
}

interface TransformedProduct {
  id: string;
  slug: string;
  name: string;
  brand: "legendary" | "everyday";
  category: string;
  price: number;
  images: string[];
  badges: string[];
  description: string;
  featured?: boolean;
  bensPick?: boolean;
  variantId?: string;
  coffee?: CoffeeDetails;
  options?: Array<{ id?: number; name: string; values: string[]; position?: number }>;
  variants: Array<{ id: string; title: string; price: number; type: string; sku: string; option1: string | null; option2: string | null; option3: string | null; inventory_quantity: number }>;
}

function parseFlavorValue(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
  } catch { /* not JSON */ }
  return value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
}

async function fetchProductMetafields(storeName: string, accessToken: string, productId: number): Promise<any[]> {
  const url = `https://${storeName}.myshopify.com/admin/api/2025-04/products/${productId}/metafields.json`;
  try {
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.metafields || [];
  } catch (e) {
    console.error(`Error fetching metafields for product ${productId}:`, e);
    return [];
  }
}

async function resolveMetaobjectsDetailed(
  storeName: string,
  accessToken: string,
  gids: string[]
): Promise<Array<{ gid: string; name: string; type: string }>> {
  if (!gids.length) return [];

  const nodeQueries = gids
    .map(
      (gid, i) =>
        `node${i}: node(id: "${gid}") { ... on Metaobject { id type displayName fields { key value } } }`
    )
    .join('\n');
  const query = `{ ${nodeQueries} }`;

  try {
    const response = await fetch(
      `https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`,
      {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      console.error('GraphQL detailed resolve failed:', response.status);
      return [];
    }

    const result = await response.json();
    const out: Array<{ gid: string; name: string; type: string }> = [];
    for (let i = 0; i < gids.length; i++) {
      const node = result.data?.[`node${i}`];
      if (!node) continue;
      const name =
        node.displayName || node.fields?.find((f: any) => f.key === 'name')?.value || '';
      out.push({ gid: gids[i], name, type: node.type || '' });
    }
    return out;
  } catch (e) {
    console.error('Error resolving metaobjects (detailed):', e);
    return [];
  }
}

async function resolveMetaobjectNames(storeName: string, accessToken: string, gids: string[]): Promise<string[]> {
  if (!gids.length) return [];
  
  // Build GraphQL query to resolve all metaobject GIDs at once
  const nodeQueries = gids.map((gid, i) => `node${i}: node(id: "${gid}") { ... on Metaobject { displayName fields { key value } } }`).join('\n');
  const query = `{ ${nodeQueries} }`;
  
  try {
    const response = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      console.error('GraphQL request failed:', response.status);
      return [];
    }
    
    const result = await response.json();
    const names: string[] = [];
    
    for (let i = 0; i < gids.length; i++) {
      const node = result.data?.[`node${i}`];
      if (node) {
        // Try displayName first, then look for a "name" field
        const name = node.displayName || node.fields?.find((f: any) => f.key === 'name')?.value || '';
        if (name) names.push(name);
      }
    }
    
    console.log('Resolved metaobject names:', names);
    return names;
  } catch (e) {
    console.error('Error resolving metaobjects:', e);
    return [];
  }
}

function parseCoffeeDetails(description: string): CoffeeDetails | null {
  const originMatch = description.match(/origin:\s*(.+)/i);
  const altitudeMatch = description.match(/altitude:\s*(\d+)/i);
  const processMatch = description.match(/processing\s*(?:method)?:\s*(.+)/i);
  const varietyMatch = description.match(/variet(?:y|al):\s*(.+)/i);

  if (!originMatch && !altitudeMatch) return null;

  return {
    origin: originMatch?.[1]?.trim() || "",
    elevation_m: parseInt(altitudeMatch?.[1] || "0"),
    process: processMatch?.[1]?.trim() || "",
    variety: varietyMatch?.[1]?.trim() || "",
    roast_style: "balanced",
    flavor_notes: [], // Always empty — populated exclusively from Shopify "Flavor" metafield
    grind_options: ["whole", "espresso", "filter"],
    weight_options_g: [250, 1000],
    subscriptionEligible: false,
    limitedRelease: false,
    benQuote: "",
  };
}

function cleanDescriptionMetadata(description: string): string {
  return description
    .replace(/^origin:\s*.+$/gim, '')
    .replace(/^altitude:\s*.+$/gim, '')
    .replace(/^processing\s*(?:method)?:\s*.+$/gim, '')
    .replace(/^variet(?:y|al):\s*.+$/gim, '')
    .replace(/^(?:flavor|tasting)\s*(?:notes?)?:\s*.+$/gim, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function detectCategory(shopifyProduct: ShopifyProduct, collectionIsCoffee: boolean): string {
  const typeLower = shopifyProduct.product_type?.toLowerCase() || '';
  const categoryMap: Record<string, string> = {
    'coffee': 'coffee', 'apparel': 'apparel', 'merch': 'merch', 'gear': 'gear', 'machines': 'machines',
  };
  if (categoryMap[typeLower]) return categoryMap[typeLower];

  const titleLower = shopifyProduct.title?.toLowerCase() || '';
  const tagsLower = shopifyProduct.tags?.toLowerCase() || '';
  const descLower = shopifyProduct.body_html?.toLowerCase() || '';

  const coffeeKeywords = ['coffee', 'café', 'cafe', 'blend', 'roast', 'espresso', 'grão', 'grao', 'moído', 'moido'];
  const coffeeDescKeywords = ['origin:', 'altitude:', 'processing method:', 'varietal:', 'elevation:', 'masl'];

  const matchesTitle = coffeeKeywords.some(k => titleLower.includes(k) || tagsLower.includes(k));
  const matchesDesc = coffeeDescKeywords.some(k => descLower.includes(k));

  if (matchesTitle || matchesDesc || collectionIsCoffee) return 'coffee';
  return 'merch';
}

function transformProduct(shopifyProduct: ShopifyProduct, brand: "legendary" | "everyday", collectionIsCoffee: boolean): TransformedProduct {
  const tags = shopifyProduct.tags ? shopifyProduct.tags.split(', ').filter(Boolean) : [];
  const category = detectCategory(shopifyProduct, collectionIsCoffee);

  const badgeTags = tags.filter(t => 
    t.toLowerCase().includes('limited') || 
    t.toLowerCase().includes('new') ||
    t.toLowerCase().includes('bestseller') ||
    t.toLowerCase().includes('ben')
  );

  const rawDescription = shopifyProduct.body_html
    ?.replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim() || '';

  // Always create a coffee object for coffee products so metafields can populate flavor_notes
  const parsedCoffee = category === 'coffee' ? parseCoffeeDetails(rawDescription) : undefined;
  const coffee = category === 'coffee' ? (parsedCoffee || {
    origin: "",
    elevation_m: 0,
    process: "",
    variety: "",
    roast_style: "balanced",
    flavor_notes: [],
    grind_options: ["whole", "espresso", "filter"],
    weight_options_g: [250, 1000],
    subscriptionEligible: false,
    limitedRelease: false,
    benQuote: "",
  }) : undefined;
  const description = category === 'coffee' ? cleanDescriptionMetadata(rawDescription) : rawDescription;

  return {
    id: String(shopifyProduct.id),
    slug: shopifyProduct.handle,
    name: shopifyProduct.title,
    brand,
    category,
    price: parseFloat((shopifyProduct.variants.find(v => !v.option2 || v.option2.toLowerCase() !== 'wholesale') || shopifyProduct.variants[0])?.price || '0'),
    images: shopifyProduct.images?.map(img => img.src) || [],
    badges: badgeTags,
    description,
    featured: tags.some(t => t.toLowerCase().includes('featured')),
    bensPick: tags.some(t => t.toLowerCase().includes('ben')),
    variantId: String((shopifyProduct.variants.find(v => !v.option2 || v.option2.toLowerCase() !== 'wholesale') || shopifyProduct.variants[0])?.id || ''),
    coffee,
    options: (shopifyProduct.options || []).map((o: any) => ({
      id: o.id,
      name: o.name,
      values: o.values || [],
      position: o.position,
    })),
    variants: shopifyProduct.variants.map(v => ({
      id: String(v.id),
      title: v.option1 || v.sku || 'Default',
      price: parseFloat(v.price || '0'),
      type: v.option2 || 'Retail',
      sku: v.sku || '',
      option1: v.option1,
      option2: v.option2,
      option3: v.option3,
      inventory_quantity: v.inventory_quantity ?? 0,
    })),
  };
}

async function fetchCollections(storeName: string, accessToken: string): Promise<ShopifyCollection[]> {
  const allCollections: ShopifyCollection[] = [];
  
  try {
    const customUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/custom_collections.json`;
    console.log('Fetching custom collections from Shopify...');
    
    const customResponse = await fetch(customUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (customResponse.ok) {
      const customData = await customResponse.json();
      allCollections.push(...(customData.custom_collections || []));
      console.log(`Found ${customData.custom_collections?.length || 0} custom collections`);
    } else {
      console.log(`Custom collections request failed: ${customResponse.status}`);
    }
  } catch (e) {
    console.log('Error fetching custom collections:', e);
  }

  try {
    const smartUrl = `https://${storeName}.myshopify.com/admin/api/2025-04/smart_collections.json`;
    console.log('Fetching smart collections from Shopify...');
    
    const smartResponse = await fetch(smartUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (smartResponse.ok) {
      const smartData = await smartResponse.json();
      allCollections.push(...(smartData.smart_collections || []));
      console.log(`Found ${smartData.smart_collections?.length || 0} smart collections`);
    } else {
      console.log(`Smart collections request failed: ${smartResponse.status}`);
    }
  } catch (e) {
    console.log('Error fetching smart collections:', e);
  }

  console.log(`Total collections found: ${allCollections.length}`);
  allCollections.forEach(c => console.log(`Collection: title="${c.title}", handle="${c.handle}", id=${c.id}`));
  return allCollections;
}

async function fetchProductsByCollection(storeName: string, accessToken: string, collectionId: number): Promise<ShopifyProduct[]> {
  const url = `https://${storeName}.myshopify.com/admin/api/2025-04/products.json?collection_id=${collectionId}&limit=250&status=active`;
  
  console.log(`Fetching products for collection ${collectionId}...`);
  
  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch products for collection ${collectionId}: ${response.status} - ${errorText}`);
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  const data = await response.json();
  return data.products || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

    if (!storeName || !accessToken) {
      console.error('Missing Shopify credentials');
      return new Response(
        JSON.stringify({ error: 'Shopify credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching products from Shopify: ${storeName}`);

    const collections = await fetchCollections(storeName, accessToken);
    console.log(`Found ${collections.length} collections`);

    const legendaryCollection = collections.find(c => 
      c.title.toLowerCase().includes('legendary') || c.handle.toLowerCase().includes('legendary')
    );
    const everydayCollection = collections.find(c => 
      c.title.toLowerCase().includes('everyday') || c.handle.toLowerCase().includes('everyday')
    );

    console.log(`Legendary collection: ${legendaryCollection?.id || 'not found'}`);
    console.log(`Everyday collection: ${everydayCollection?.id || 'not found'}`);

    const allProducts: TransformedProduct[] = [];
    const seenIds = new Set<string>();

    // Fetch products from both collections in parallel
    const [legendaryProducts, everydayProducts] = await Promise.all([
      legendaryCollection ? fetchProductsByCollection(storeName, accessToken, legendaryCollection.id) : Promise.resolve([]),
      everydayCollection ? fetchProductsByCollection(storeName, accessToken, everydayCollection.id) : Promise.resolve([]),
    ]);

    console.log(`Found ${legendaryProducts.length} products in Legendary collection`);
    console.log(`Found ${everydayProducts.length} products in Everyday collection`);

    // Transform all products first
    const transformedEntries: { product: ShopifyProduct; transformed: TransformedProduct }[] = [];

    for (const product of legendaryProducts) {
      const collectionIsCoffee = legendaryCollection!.title.toLowerCase().includes('coffee');
      const transformed = transformProduct(product, 'legendary', collectionIsCoffee);
      seenIds.add(transformed.id);
      transformedEntries.push({ product, transformed });
    }

    for (const product of everydayProducts) {
      if (!seenIds.has(String(product.id))) {
        const collectionIsCoffee = everydayCollection!.title.toLowerCase().includes('coffee');
        const transformed = transformProduct(product, 'everyday', collectionIsCoffee);
        transformedEntries.push({ product, transformed });
      }
    }

    // ============================================================
    // Fetch on_hand inventory via GraphQL for all variants
    // ============================================================
    const allVariantIds = transformedEntries.flatMap(e =>
      e.product.variants.map(v => `gid://shopify/ProductVariant/${v.id}`)
    );

    if (allVariantIds.length > 0) {
      try {
        // Batch in chunks of 50 to avoid query size limits
        const chunkSize = 50;
        for (let c = 0; c < allVariantIds.length; c += chunkSize) {
          const chunk = allVariantIds.slice(c, c + chunkSize);
          const nodeQueries = chunk.map((gid, i) =>
            `v${c + i}: node(id: "${gid}") { ... on ProductVariant { id inventoryItem { inventoryLevels(first: 1) { edges { node { quantities(names: ["available"]) { name quantity } } } } } } }`
          ).join('\n');

          const gqlRes = await fetch(`https://${storeName}.myshopify.com/admin/api/2025-04/graphql.json`, {
            method: 'POST',
            headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `{ ${nodeQueries} }` }),
          });

          if (gqlRes.ok) {
            const gqlData = await gqlRes.json();
            for (let i = 0; i < chunk.length; i++) {
              const node = gqlData.data?.[`v${c + i}`];
              const availableQty = node?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.quantities?.find(
                (q: any) => q.name === 'available'
              )?.quantity;
              if (availableQty !== undefined) {
                const numericId = chunk[i].replace('gid://shopify/ProductVariant/', '');
                for (const entry of transformedEntries) {
                  const variant = entry.transformed.variants.find(v => v.id === numericId);
                  if (variant) {
                    variant.inventory_quantity = Math.max(0, availableQty);
                    break;
                  }
                }
              }
            }
          } else {
            console.error('GraphQL on_hand query failed:', gqlRes.status, await gqlRes.text());
          }
        }
        console.log(`Updated available inventory for ${allVariantIds.length} variants`);
      } catch (e) {
        console.error('Error fetching on_hand inventory:', e);
        // Fall back to REST inventory_quantity values already set
      }
    }

    // Fetch all metafields in parallel for coffee products
    const coffeeEntries = transformedEntries.filter(e => e.transformed.coffee);
    const metafieldResults = await Promise.all(
      coffeeEntries.map(e => fetchProductMetafields(storeName, accessToken, e.product.id))
    );

    // Collect all GIDs that need resolving
    const allGids: string[] = [];
    const gidMap: { index: number; gids: string[]; rawValues: string[] }[] = [];

    coffeeEntries.forEach((entry, i) => {
      const metafields = metafieldResults[i];
      const flavorMeta = metafields.find(m => m.key.includes('flavor'));
      if (flavorMeta) {
        // Capture metafield identity so the frontend can round-trip writes
        entry.transformed.coffee!.flavor_metafield = {
          namespace: flavorMeta.namespace,
          key: flavorMeta.key,
          type: flavorMeta.type || 'list.metaobject_reference',
        };

        const rawValues = parseFlavorValue(flavorMeta.value);
        const gids = rawValues.filter(v => v.startsWith('gid://'));
        if (gids.length > 0) {
          gidMap.push({ index: i, gids, rawValues: [] });
          allGids.push(...gids);
        } else {
          entry.transformed.coffee!.flavor_notes = rawValues;
          console.log(`Flavor notes for "${entry.product.title}":`, rawValues);
        }
      }
    });

    // Resolve all metaobject GIDs in a single GraphQL call (also captures type)
    if (allGids.length > 0) {
      const resolved = await resolveMetaobjectsDetailed(storeName, accessToken, allGids);
      const byGid = new Map(resolved.map(r => [r.gid, r]));
      let offset = 0;
      for (const mapping of gidMap) {
        const slice = mapping.gids.map(g => byGid.get(g)).filter(Boolean) as Array<{ gid: string; name: string; type: string }>;
        offset += mapping.gids.length;
        const coffee = coffeeEntries[mapping.index].transformed.coffee!;
        coffee.flavor_notes = slice.map(s => s.name);
        coffee.flavor_refs = slice.map(s => ({ gid: s.gid, name: s.name }));
        const firstType = slice.find(s => s.type)?.type;
        if (firstType) coffee.flavor_metaobject_type = firstType;
        console.log(`Flavor notes for "${coffeeEntries[mapping.index].product.title}":`, coffee.flavor_notes);
      }
    }

    // ============================================================
    // Extract additional metafields: country, caffeine, roast, grind, producer
    // ============================================================
    const ptToEn: Record<string, string> = {
      // Roast
      'torra escura': 'Dark Roast', 'torra média': 'Medium Roast', 'torra clara': 'Light Roast',
      'torra média-escura': 'Medium-Dark Roast', 'torra média-clara': 'Medium-Light Roast',
      'escura': 'Dark', 'média': 'Medium', 'clara': 'Light',
      // Caffeine
      'descafeinado': 'Decaffeinated', 'cafeinado': 'Caffeinated', 'com cafeína': 'Caffeinated',
      'sem cafeína': 'Decaffeinated', 'baixa cafeína': 'Low Caffeine',
      // Grind
      'moagem fina': 'Fine Grind', 'moagem média': 'Medium Grind', 'moagem grossa': 'Coarse Grind',
      'grão inteiro': 'Whole Bean', 'grãos inteiros': 'Whole Bean',
      // Country
      'brasil': 'Brazil', 'colômbia': 'Colombia', 'etiópia': 'Ethiopia',
      'quénia': 'Kenya', 'guatemala': 'Guatemala', 'costa rica': 'Costa Rica',
    };

    function translateValue(val: string): string {
      const lower = val.trim().toLowerCase();
      return ptToEn[lower] || val.trim();
    }

    const metafieldKeyMap: Record<string, keyof CoffeeDetails> = {
      'country': 'country',
      'caffeine': 'caffeine_content',
      'roast': 'coffee_roast',
      'grind': 'grind_size',
      'producer': 'producer',
      'harvest': 'harvest',
    };

    // Collect all extra-metafield GIDs for batch resolution
    const extraGids: string[] = [];
    const extraGidAssignments: { entryIndex: number; field: keyof CoffeeDetails; gidIndex: number }[] = [];

    coffeeEntries.forEach((entry, i) => {
      const metafields = metafieldResults[i];
      for (const mf of metafields) {
        // Skip flavor metafields (already handled)
        if (mf.key.includes('flavor')) continue;

        for (const [keyword, field] of Object.entries(metafieldKeyMap)) {
          if (mf.key.toLowerCase().includes(keyword)) {
            const rawVal = String(mf.value).trim();
            if (rawVal.startsWith('gid://')) {
              extraGidAssignments.push({ entryIndex: i, field, gidIndex: extraGids.length });
              extraGids.push(rawVal);
            } else {
              // Try to parse JSON list references
              try {
                const parsed = JSON.parse(rawVal);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  if (String(parsed[0]).startsWith('gid://')) {
                    extraGidAssignments.push({ entryIndex: i, field, gidIndex: extraGids.length });
                    extraGids.push(String(parsed[0]));
                  } else {
                    (entry.transformed.coffee as any)[field] = translateValue(String(parsed[0]));
                  }
                } else {
                  (entry.transformed.coffee as any)[field] = translateValue(rawVal);
                }
              } catch {
                (entry.transformed.coffee as any)[field] = translateValue(rawVal);
              }
            }
            break; // matched keyword, move to next metafield
          }
        }
      }
    });

    // Resolve extra metaobject GIDs
    if (extraGids.length > 0) {
      const resolvedExtra = await resolveMetaobjectNames(storeName, accessToken, extraGids);
      for (const assignment of extraGidAssignments) {
        const resolved = resolvedExtra[assignment.gidIndex];
        if (resolved) {
          (coffeeEntries[assignment.entryIndex].transformed.coffee as any)[assignment.field] = translateValue(resolved);
        }
      }
    }

    // ============================================================
    // Override with explicit custom.* metafields (authoritative source)
    // These keys are exact and managed by the merchant in Shopify Admin.
    // Runs last so it overrides any value parsed from description regex
    // or from the substring metafield matching above.
    // ============================================================
    function assignCoffeeField(coffee: any, field: keyof CoffeeDetails, value: string) {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (field === 'elevation_m') {
        const m = trimmed.match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > 0) coffee[field] = n;
        }
        return;
      }
      coffee[field] = translateValue(trimmed);
    }

    const CUSTOM_NS = 'custom';
    const customFieldMap: Record<string, keyof CoffeeDetails> = {
      'origin':     'origin',
      'producer':   'producer',
      'harvest':    'harvest',
      'elevation':  'elevation_m',
      'variety':    'variety',
      'processing': 'process',
    };

    const customGids: string[] = [];
    const customGidAssignments: { entryIndex: number; field: keyof CoffeeDetails; gidIndex: number }[] = [];

    coffeeEntries.forEach((entry, i) => {
      const metafields = metafieldResults[i];
      for (const mf of metafields) {
        if (mf.namespace !== CUSTOM_NS) continue;
        const targetField = customFieldMap[mf.key];
        if (!targetField) continue;

        const rawVal = String(mf.value).trim();
        if (!rawVal) continue;

        if (rawVal.startsWith('gid://')) {
          customGidAssignments.push({ entryIndex: i, field: targetField, gidIndex: customGids.length });
          customGids.push(rawVal);
          continue;
        }

        try {
          const parsed = JSON.parse(rawVal);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = String(parsed[0]);
            if (first.startsWith('gid://')) {
              customGidAssignments.push({ entryIndex: i, field: targetField, gidIndex: customGids.length });
              customGids.push(first);
            } else {
              assignCoffeeField(entry.transformed.coffee!, targetField, first);
            }
            continue;
          }
        } catch { /* not JSON */ }

        assignCoffeeField(entry.transformed.coffee!, targetField, rawVal);
      }
    });

    if (customGids.length > 0) {
      const resolved = await resolveMetaobjectNames(storeName, accessToken, customGids);
      for (const a of customGidAssignments) {
        const r = resolved[a.gidIndex];
        if (r) {
          assignCoffeeField(coffeeEntries[a.entryIndex].transformed.coffee!, a.field, r);
        }
      }
    }

    for (const entry of transformedEntries) {
      allProducts.push(entry.transformed);
    }

    console.log(`Total products: ${allProducts.length}`);

    return new Response(
      JSON.stringify({ products: allProducts, count: allProducts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
