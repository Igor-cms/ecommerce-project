import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const FRONTEND_URL = "https://legendary-everyday.lovable.app";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${FRONTEND_URL}/manage?xero=error&reason=no_code` },
      });
    }

    const clientId = Deno.env.get("XERO_CLIENT_ID")!;
    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("XERO_REDIRECT_URI")!;

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response(null, {
        status: 302,
        headers: { Location: `${FRONTEND_URL}/manage?xero=error&reason=token_exchange` },
      });
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Fetch tenant ID from Xero connections
    let tenantId: string | null = null;
    try {
      const connectionsRes = await fetch("https://api.xero.com/connections", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (connectionsRes.ok) {
        const connections = await connectionsRes.json();
        if (connections.length > 0) {
          tenantId = connections[0].tenantId;
        }
      }
    } catch (e) {
      console.error("Failed to fetch Xero connections:", e);
    }

    // Save tokens using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Upsert: delete existing tokens and insert new ones (single-tenant setup)
    await supabase.from("xero_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: insertError } = await supabase.from("xero_tokens").insert({
      access_token,
      refresh_token,
      expires_at: expiresAt,
      tenant_id: tenantId,
    });

    if (insertError) {
      console.error("Failed to save tokens:", insertError);
      return new Response(null, {
        status: 302,
        headers: { Location: `${FRONTEND_URL}/manage?xero=error&reason=save_tokens` },
      });
    }

    console.log("Xero OAuth completed successfully. Tenant:", tenantId);

    return new Response(null, {
      status: 302,
      headers: { Location: `${FRONTEND_URL}/manage?xero=success` },
    });
  } catch (error) {
    console.error("Xero OAuth callback error:", error);
    return new Response(null, {
      status: 302,
      headers: { Location: `${FRONTEND_URL}/manage?xero=error&reason=unknown` },
    });
  }
});
