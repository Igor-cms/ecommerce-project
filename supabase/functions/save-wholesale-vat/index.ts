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
    console.log(`[save-wholesale-vat] auth header: ${authHeader ? "present" : "missing"}`);
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
    console.log(
      `[save-wholesale-vat] getUser -> user_id=${user?.id ?? "null"} error=${authError?.message ?? "none"}`
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", reason: authError?.message || "no user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { vat_number, vat_exempt, target_email } = body;

    if (typeof vat_exempt !== "boolean") {
      return new Response(JSON.stringify({ error: "vat_exempt must be a boolean" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vat_exempt && (typeof vat_number !== "string" || vat_number.trim().length === 0)) {
      return new Response(JSON.stringify({ error: "vat_number is required when not exempt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (vat_number && vat_number.length > 50) {
      return new Response(JSON.stringify({ error: "vat_number too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalVatNumber = vat_exempt ? null : vat_number.trim();

    // Resolve target user/email: default is self-service, admin path uses target_email
    let targetUserId: string | null = user.id;
    let targetEmail: string | null | undefined = user.email;

    if (target_email) {
      // Admin path: validate admin/owner role
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "owner");
      console.log(
        `[save-wholesale-vat] admin path: target_email_present=true roles_count=${roles?.length ?? 0} isAdmin=${isAdmin} rolesError=${rolesError?.message ?? "none"}`
      );
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden", reason: "user lacks admin/owner role" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve user_id from target_email via service role client
      const serviceClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("email", target_email)
        .maybeSingle();

      targetUserId = profile?.id || null;
      targetEmail = target_email;
    }

    // Save to local DB only if we have a user_id (skip if profile doesn't exist but email does)
    if (targetUserId) {
      const { error: dbError } = await supabase
        .from("wholesale_vat_info")
        .upsert({
          user_id: targetUserId,
          vat_number: finalVatNumber,
          vat_exempt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (dbError) {
        console.error("DB save error:", dbError.message);
        return new Response(JSON.stringify({ error: "Failed to save VAT information" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Save to Shopify customer metafield
    const shopifyStore = Deno.env.get("SHOPIFY_STORE_NAME");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    if (shopifyStore && shopifyToken && targetEmail) {
      try {
        // Find Shopify customer
        const searchRes = await fetch(
          `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/search.json?query=email:${encodeURIComponent(targetEmail)}`,
          { headers: { "X-Shopify-Access-Token": shopifyToken } }
        );
        const searchData = await searchRes.json();
        const customer = searchData.customers?.find(
          (c: any) => c.email?.toLowerCase() === targetEmail!.toLowerCase()
        ) || null;

        if (customer) {
          // Fetch existing metafields in "custom" namespace
          const metaRes = await fetch(
            `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/${customer.id}/metafields.json?namespace=custom`,
            { headers: { "X-Shopify-Access-Token": shopifyToken } }
          );
          const metaData = await metaRes.json();
          const existingMetafields = metaData.metafields || [];

          const vatNumberMeta = existingMetafields.find((m: any) => m.key === "vat_number");
          const vatExemptMeta = existingMetafields.find((m: any) => m.key === "vat_exempt");

          const metafieldsToWrite = [
            {
              key: "vat_number",
              value: finalVatNumber || "",
              existingId: vatNumberMeta?.id,
            },
            {
              key: "vat_exempt",
              value: vat_exempt ? "true" : "false",
              existingId: vatExemptMeta?.id,
            },
          ];

          for (const mf of metafieldsToWrite) {
            if (mf.existingId) {
              const updateRes = await fetch(
                `https://${shopifyStore}.myshopify.com/admin/api/2025-04/metafields/${mf.existingId}.json`,
                {
                  method: "PUT",
                  headers: {
                    "X-Shopify-Access-Token": shopifyToken,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    metafield: {
                      id: mf.existingId,
                      value: mf.value,
                      type: "single_line_text_field",
                    },
                  }),
                }
              );
              if (!updateRes.ok) {
                const errText = await updateRes.text();
                console.error(`Shopify metafield update failed for ${mf.key}:`, errText);
              } else {
                await updateRes.text();
                console.log(`Shopify metafield ${mf.key} updated for customer ${customer.id}`);
              }
            } else {
              const createRes = await fetch(
                `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/${customer.id}/metafields.json`,
                {
                  method: "POST",
                  headers: {
                    "X-Shopify-Access-Token": shopifyToken,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    metafield: {
                      namespace: "custom",
                      key: mf.key,
                      value: mf.value,
                      type: "single_line_text_field",
                    },
                  }),
                }
              );
              if (!createRes.ok) {
                const errText = await createRes.text();
                console.error(`Shopify metafield create failed for ${mf.key}:`, errText);
              } else {
                await createRes.text();
                console.log(`Shopify metafield ${mf.key} created for customer ${customer.id}`);
              }
            }
          }

          // Clean up old "tax" namespace metafields if they exist
          try {
            const oldMetaRes = await fetch(
              `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/${customer.id}/metafields.json?namespace=tax`,
              { headers: { "X-Shopify-Access-Token": shopifyToken } }
            );
            const oldMetaData = await oldMetaRes.json();
            const oldMetafields = oldMetaData.metafields || [];
            for (const oldMf of oldMetafields) {
              if (oldMf.key === "vat_number" || oldMf.key === "vat_exempt") {
                const delRes = await fetch(
                  `https://${shopifyStore}.myshopify.com/admin/api/2025-04/metafields/${oldMf.id}.json`,
                  {
                    method: "DELETE",
                    headers: { "X-Shopify-Access-Token": shopifyToken },
                  }
                );
                console.log(`Deleted old tax.${oldMf.key} metafield: ${delRes.ok}`);
              }
            }
          } catch (cleanupErr) {
            console.error("Cleanup old tax metafields error:", (cleanupErr as Error).message);
          }
        } else {
          // Customer not found — create in Shopify
          console.log("No Shopify customer found, creating new customer");

          const serviceClient = createClient(
            supabaseUrl,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          let profileData: { first_name: string | null; last_name: string | null; phone: string | null } | null = null;
          if (targetUserId) {
            const { data } = await serviceClient
              .from("profiles")
              .select("first_name, last_name, phone")
              .eq("id", targetUserId)
              .single();
            profileData = data;
          }

          const createRes = await fetch(
            `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers.json`,
            {
              method: "POST",
              headers: {
                "X-Shopify-Access-Token": shopifyToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customer: {
                  email: targetEmail,
                  first_name: profileData?.first_name || "",
                  last_name: profileData?.last_name || "",
                  phone: profileData?.phone || undefined,
                  tags: "wholesale",
                  verified_email: true,
                  send_email_invite: false,
                  metafields: [
                    { namespace: "custom", key: "vat_number", value: finalVatNumber || "", type: "single_line_text_field" },
                    { namespace: "custom", key: "vat_exempt", value: vat_exempt ? "true" : "false", type: "single_line_text_field" },
                  ],
                },
              }),
            }
          );

          if (!createRes.ok) {
            const errText = await createRes.text();
            console.error("Shopify customer create failed:", errText);
          } else {
            const createData = await createRes.json();
            console.log("Shopify customer created:", createData.customer?.id);
          }
        }
      } catch (shopifyErr) {
        console.error("Shopify API error:", (shopifyErr as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
