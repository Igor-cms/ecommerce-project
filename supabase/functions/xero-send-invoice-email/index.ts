import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const respond = (status: number, body?: Record<string, unknown>) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function verifyXeroSignature(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return computed === signatureHeader;
}

async function getXeroAccessToken(): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Try to use existing token from xero_tokens table
  const { data: tokenRow } = await supabase
    .from("xero_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (tokenRow) {
    const expiresAt = new Date(tokenRow.expires_at);
    // If token is still valid (with 60s buffer), use it
    if (expiresAt.getTime() - Date.now() > 60_000) {
      return tokenRow.access_token;
    }

    // Token expired — refresh it
    const clientId = Deno.env.get("XERO_CLIENT_ID")!;
    const clientSecret = Deno.env.get("XERO_CLIENT_SECRET")!;

    const refreshRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokenRow.refresh_token,
      }),
    });

    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      throw new Error(`Xero token refresh failed: ${errText}`);
    }

    const tokenData = await refreshRes.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update stored tokens
    await supabase
      .from("xero_tokens")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: newExpiresAt,
      })
      .eq("id", tokenRow.id ?? undefined);

    // If no id available, upsert approach
    if (!tokenRow.id) {
      await supabase.from("xero_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("xero_tokens").insert({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: newExpiresAt,
        tenant_id: Deno.env.get("XERO_TENANT_ID") ?? null,
      });
    }

    return tokenData.access_token;
  }

  throw new Error("No Xero tokens found in database. Complete OAuth flow first.");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const webhookKey = Deno.env.get("XERO_WEBHOOK_KEY");
  if (!webhookKey) {
    console.error("XERO_WEBHOOK_KEY not configured");
    return respond(500, { error: "Webhook key not configured" });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-xero-signature") ?? "";

  // Validate HMAC signature
  const valid = await verifyXeroSignature(rawBody, signature, webhookKey);
  if (!valid) {
    console.error("Invalid Xero webhook signature");
    return respond(401);
  }

  // Intent To Receive (ITR) handshake — empty body
  if (!rawBody || rawBody.trim() === "" || rawBody.trim() === "{}") {
    console.log("Xero ITR handshake — responding 200");
    return respond(200);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("Failed to parse webhook body");
    return respond(400, { error: "Invalid JSON" });
  }

  const events = payload.events;
  if (!events || !Array.isArray(events) || events.length === 0) {
    console.log("No events in payload, returning 200");
    return respond(200);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  for (const event of events) {
    const { eventCategory, eventType, resourceId } = event;

    // Only process INVOICE CREATE or UPDATE
    if (eventCategory !== "INVOICE" || (eventType !== "CREATE" && eventType !== "UPDATE")) {
      console.log(`Skipping event: ${eventCategory}/${eventType}`);
      continue;
    }

    console.log(`Processing invoice event: ${eventType} — ${resourceId}`);

    // Check for duplicates
    const { data: existing } = await supabase
      .from("xero_emails_sent")
      .select("id")
      .eq("invoice_id", resourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Invoice ${resourceId} email already sent, skipping`);
      continue;
    }

    try {
      const accessToken = await getXeroAccessToken();

      // Read tenant_id from DB or env
      let tenantId = Deno.env.get("XERO_TENANT_ID");
      if (!tenantId) {
        const { data: tokenRow } = await supabase
          .from("xero_tokens")
          .select("tenant_id")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        tenantId = tokenRow?.tenant_id ?? undefined;
      }

      if (!tenantId) {
        console.error("No Xero tenant ID available");
        continue;
      }

      const xeroHeaders = {
        Authorization: `Bearer ${accessToken}`,
        "xero-tenant-id": tenantId,
        Accept: "application/json",
      };

      // Fetch invoice to check status
      const invoiceRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices/${resourceId}`,
        { headers: xeroHeaders },
      );

      if (!invoiceRes.ok) {
        console.error(`Failed to fetch invoice ${resourceId}: ${invoiceRes.status}`);
        continue;
      }

      const invoiceData = await invoiceRes.json();
      const invoice = invoiceData.Invoices?.[0];

      if (!invoice) {
        console.error(`Invoice ${resourceId} not found in response`);
        continue;
      }

      if (invoice.Status !== "PAID") {
        console.log(`Invoice ${resourceId} status is ${invoice.Status}, not PAID — skipping email`);
        continue;
      }

      // Send email via Xero
      const emailRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices/${resourceId}/Email`,
        {
          method: "POST",
          headers: { ...xeroHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error(`Failed to send email for invoice ${resourceId}: ${emailRes.status} — ${errText}`);
        continue;
      }

      // Record successful send
      await supabase.from("xero_emails_sent").insert({
        invoice_id: resourceId,
      });

      console.log(`Email sent for invoice ${resourceId}`);
    } catch (err) {
      console.error(`Error processing invoice ${resourceId}:`, err);
    }
  }

  return respond(200);
});
