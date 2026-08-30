import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("XERO_CLIENT_ID");
    const redirectUri = Deno.env.get("XERO_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing XERO_CLIENT_ID or XERO_REDIRECT_URI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    const scopes = "offline_access accounting.invoices accounting.contacts";

    const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    // Redirect to Xero authorization page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: authUrl.toString(),
      },
    });
  } catch (error) {
    console.error("Error starting Xero OAuth:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start OAuth flow" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
