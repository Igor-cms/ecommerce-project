import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const shopifyStore = Deno.env.get("SHOPIFY_STORE_NAME");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    // Helper: read from local DB
    const readLocalDb = async () => {
      const { data: localVat } = await serviceClient
        .from("wholesale_vat_info")
        .select("vat_number, vat_exempt")
        .eq("user_id", user.id)
        .single();
      if (localVat && (localVat.vat_number || localVat.vat_exempt)) {
        return { vat_number: localVat.vat_number || null, vat_exempt: localVat.vat_exempt || false };
      }
      return null;
    };

    // Try Shopify first
    if (shopifyStore && shopifyToken && user.email) {
      try {
        const searchRes = await fetch(
          `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/search.json?query=email:${encodeURIComponent(user.email)}`,
          { headers: { "X-Shopify-Access-Token": shopifyToken } }
        );

        if (!searchRes.ok) throw new Error(`Shopify search failed: ${searchRes.status}`);

        const searchData = await searchRes.json();
        const customer = searchData.customers?.find(
          (c: any) => c.email?.toLowerCase() === user.email!.toLowerCase()
        ) || null;

        if (customer) {
          const metaRes = await fetch(
            `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/${customer.id}/metafields.json?namespace=custom`,
            { headers: { "X-Shopify-Access-Token": shopifyToken } }
          );

          if (!metaRes.ok) throw new Error(`Shopify metafields failed: ${metaRes.status}`);

          const metaData = await metaRes.json();
          const metafields = metaData.metafields || [];

          const vatNumberMeta = metafields.find((m: any) => m.key === "vat_number");
          const vatExemptMeta = metafields.find((m: any) => m.key === "vat_exempt");

          const vatNumber = vatNumberMeta?.value?.trim() || null;
          const vatExempt = vatExemptMeta?.value === "true";

          // Shopify has data → sync to local DB and return
          if (vatNumber || vatExempt) {
            await serviceClient.from("wholesale_vat_info").upsert({
              user_id: user.id,
              vat_number: vatNumber && vatNumber !== "" ? vatNumber : null,
              vat_exempt: vatExempt,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

            return new Response(JSON.stringify({
              vat_number: vatNumber && vatNumber !== "" ? vatNumber : null,
              vat_exempt: vatExempt,
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Shopify customer exists but no VAT metafields → fallback to local DB
          console.log("Shopify customer found but no VAT metafields, checking local DB");
          const localResult = await readLocalDb();
          if (localResult) {
            return new Response(JSON.stringify(localResult), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Neither Shopify nor local DB have data
          return new Response(JSON.stringify({ vat_number: null, vat_exempt: false }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Customer not found in Shopify → fallback to local DB
        console.log("No Shopify customer found, checking local DB");
        const localResult = await readLocalDb();
        if (localResult) {
          return new Response(JSON.stringify(localResult), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ vat_number: null, vat_exempt: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (shopifyErr) {
        console.error("Shopify API failed, falling back to local DB:", (shopifyErr as Error).message);
      }
    }

    // Fallback: read from local DB
    const localResult = await readLocalDb();
    return new Response(JSON.stringify(localResult || { vat_number: null, vat_exempt: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-shopify-vat error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
