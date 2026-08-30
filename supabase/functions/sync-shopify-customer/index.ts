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

    const userEmail = user.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ error: "No email in token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { first_name, last_name, phone } = body;

    if (first_name && typeof first_name !== "string") {
      return new Response(JSON.stringify({ error: "Invalid first_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (last_name && typeof last_name !== "string") {
      return new Response(JSON.stringify({ error: "Invalid last_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shopifyStore = Deno.env.get("SHOPIFY_STORE_NAME");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    if (!shopifyStore || !shopifyToken) {
      return new Response(JSON.stringify({ error: "Shopify not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shopifyHeaders = {
      "X-Shopify-Access-Token": shopifyToken,
      "Content-Type": "application/json",
    };

    // Search for customer by email
    const searchRes = await fetch(
      `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/search.json?query=email:${encodeURIComponent(userEmail)}`,
      { headers: { "X-Shopify-Access-Token": shopifyToken } }
    );
    const searchData = await searchRes.json();
    // Exact email match to avoid Shopify fuzzy search issues
    const customer = searchData.customers?.find(
      (c: any) => c.email?.toLowerCase() === userEmail.toLowerCase()
    ) || null;

    const customerData: Record<string, unknown> = {};
    if (first_name !== undefined) customerData.first_name = first_name || "";
    if (last_name !== undefined) customerData.last_name = last_name || "";
    if (phone !== undefined) customerData.phone = phone || undefined;

    if (customer) {
      // Update existing customer
      const updateRes = await fetch(
        `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers/${customer.id}.json`,
        {
          method: "PUT",
          headers: shopifyHeaders,
          body: JSON.stringify({ customer: { id: customer.id, ...customerData } }),
        }
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error("Shopify customer update failed:", errText);
        return new Response(JSON.stringify({ error: "Failed to update Shopify customer" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Shopify customer updated:", customer.id);
    } else {
      // Create new customer
      const createRes = await fetch(
        `https://${shopifyStore}.myshopify.com/admin/api/2025-04/customers.json`,
        {
          method: "POST",
          headers: shopifyHeaders,
          body: JSON.stringify({
            customer: {
              email: userEmail,
              ...customerData,
              verified_email: true,
              send_email_invite: false,
            },
          }),
        }
      );

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Shopify customer create failed:", errText);
        return new Response(JSON.stringify({ error: "Failed to create Shopify customer" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createData = await createRes.json();
      console.log("Shopify customer created:", createData.customer?.id);
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
