import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use service role client for DB access (this function is admin-only)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth check: accept service_role or admin/owner JWT
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } =
        await supabase.auth.getClaims(token);
      
      if (!claimsError && claimsData?.claims) {
        const role = claimsData.claims.role;
        if (role !== "service_role") {
          const userId = claimsData.claims.sub;
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const isAdminOrOwner = roles?.some(
            (r: { role: string }) => r.role === "admin" || r.role === "owner"
          );
          if (!isAdminOrOwner) {
            return new Response(JSON.stringify({ error: "Forbidden" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shopify config
    const shopifyStore = Deno.env.get("SHOPIFY_STORE_NAME");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    if (!shopifyStore || !shopifyToken) {
      return new Response(
        JSON.stringify({ error: "Shopify credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const shopifyBase = `https://${shopifyStore}.myshopify.com/admin/api/2025-04`;
    const shopifyHeaders = {
      "X-Shopify-Access-Token": shopifyToken,
      "Content-Type": "application/json",
    };

    // Parse optional filter
    let emailFilter: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.emails && Array.isArray(body.emails)) {
        emailFilter = body.emails;
      }
    } catch { /* no body */ }

    // Fetch wholesale applications
    let query = supabase.from("wholesale_applications").select("*");
    if (emailFilter && emailFilter.length > 0) {
      query = query.in("email", emailFilter);
    }
    const { data: applications, error: appError } = await query;

    if (appError) throw new Error(`Failed to fetch applications: ${appError.message}`);
    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ created: [], skipped: [], failed: [], total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch VAT info for all users with wholesale apps
    const userIds = applications
      .map((a: any) => a.user_id)
      .filter(Boolean);
    
    let vatMap: Record<string, { vat_number: string | null; vat_exempt: boolean }> = {};
    if (userIds.length > 0) {
      const { data: vatRecords } = await supabase
        .from("wholesale_vat_info")
        .select("user_id, vat_number, vat_exempt")
        .in("user_id", userIds);
      
      if (vatRecords) {
        for (const v of vatRecords) {
          vatMap[v.user_id] = { vat_number: v.vat_number, vat_exempt: v.vat_exempt };
        }
      }
    }

    const created: string[] = [];
    const skipped: string[] = [];
    const failed: { email: string; reason: string }[] = [];

    for (const app of applications) {
      const email = app.email;
      try {
        // Search Shopify for existing customer
        const searchRes = await fetch(
          `${shopifyBase}/customers/search.json?query=email:${encodeURIComponent(email)}`,
          { headers: shopifyHeaders }
        );

        if (!searchRes.ok) {
          failed.push({ email, reason: `Search failed: ${searchRes.status}` });
          await delay(200);
          continue;
        }

        const searchData = await searchRes.json();
        if (searchData.customers && searchData.customers.length > 0) {
          skipped.push(email);
          await delay(150);
          continue;
        }

        // Split contact_name
        const nameParts = (app.contact_name || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Build metafields
        const metafields: any[] = [];
        const vatInfo = app.user_id ? vatMap[app.user_id] : null;
        if (vatInfo) {
          if (vatInfo.vat_number) {
            metafields.push({
              namespace: "tax",
              key: "vat_number",
              value: vatInfo.vat_number,
              type: "single_line_text_field",
            });
          }
          metafields.push({
            namespace: "tax",
            key: "vat_exempt",
            value: String(vatInfo.vat_exempt),
            type: "boolean",
          });
        }

        // Create customer
        const createBody: any = {
          customer: {
            first_name: firstName,
            last_name: lastName,
            email,
            tags: "wholesale",
            verified_email: true,
            send_email_invite: false,
          },
        };

        if (app.phone) {
          createBody.customer.phone = app.phone;
        }
        if (metafields.length > 0) {
          createBody.customer.metafields = metafields;
        }

        let createRes = await fetch(`${shopifyBase}/customers.json`, {
          method: "POST",
          headers: shopifyHeaders,
          body: JSON.stringify(createBody),
        });

        let finalErrBody = "";

        if (!createRes.ok) {
          finalErrBody = await createRes.text();
          // If phone is invalid, retry without it
          if (app.phone && finalErrBody.includes('"phone"')) {
            delete createBody.customer.phone;
            createRes = await fetch(`${shopifyBase}/customers.json`, {
              method: "POST",
              headers: shopifyHeaders,
              body: JSON.stringify(createBody),
            });
            if (!createRes.ok) {
              finalErrBody = await createRes.text();
            } else {
              finalErrBody = "";
            }
          }
        }

        if (createRes.ok) {
          created.push(email);
        } else {
          failed.push({ email, reason: `Create failed [${createRes.status}]: ${finalErrBody.slice(0, 200)}` });
        }

        await delay(500);
      } catch (err) {
        failed.push({
          email,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        total: applications.length,
        created,
        skipped,
        failed,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Backfill error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
