import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getXeroAccessToken(supabase: any): Promise<{ accessToken: string; tenantId: string }> {
  const { data: tokenRow, error } = await supabase
    .from("xero_tokens")
    .select("id, access_token, refresh_token, expires_at, tenant_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !tokenRow) {
    throw new Error("No Xero tokens found. Complete the Xero OAuth flow first.");
  }

  let accessToken = tokenRow.access_token;
  const expiresAt = new Date(tokenRow.expires_at);

  if (expiresAt.getTime() - Date.now() < 60_000) {
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
      throw new Error(`Xero token refresh failed: ${await refreshRes.text()}`);
    }

    const tokenData = await refreshRes.json();
    accessToken = tokenData.access_token;

    await supabase
      .from("xero_tokens")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      })
      .eq("id", tokenRow.id);
  }

  const tenantId = Deno.env.get("XERO_TENANT_ID") || tokenRow.tenant_id;
  if (!tenantId) throw new Error("No Xero tenant ID available");

  return { accessToken, tenantId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const SHOPIFY_STORE_NAME = Deno.env.get("SHOPIFY_STORE_NAME");
    if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_NAME) {
      throw new Error("Missing Shopify configuration");
    }

    const { orderId } = await req.json();
    if (!orderId) return json(400, { error: "orderId is required" });

    // 1. Fetch the Shopify order
    const orderRes = await fetch(
      `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-01/orders/${orderId}.json`,
      { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } },
    );
    if (!orderRes.ok) {
      throw new Error(`Failed to fetch Shopify order: ${orderRes.status}`);
    }
    const { order } = await orderRes.json();

    // 2. Get Xero access token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { accessToken, tenantId } = await getXeroAccessToken(supabase);

    const xeroHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // 3. Find or create the Xero contact
    const customer = order.customer || {};
    const contactName =
      `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
      order.email ||
      `Shopify Order ${order.name}`;
    const contactEmail = order.email || customer.email || "";

    // Always CC the Legendary mailbox on every invoice email sent by Xero.
    // ContactPersons with IncludeInEmails=true receive automatic copies.
    const ALWAYS_CC_EMAILS = ["legendaryeveryday1@gmail.com"];
    const secondaryEmails = ALWAYS_CC_EMAILS.filter(
      (email) => email.toLowerCase() !== contactEmail.toLowerCase().trim(),
    );
    const contactPersons = secondaryEmails.map((email) => ({
      FirstName: "Legendary",
      LastName: "Everyday",
      EmailAddress: email,
      IncludeInEmails: true,
    }));

    let contactId: string | null = null;
    if (contactEmail) {
      const where = encodeURIComponent(`EmailAddress=="${contactEmail}"`);
      const lookupRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Contacts?where=${where}`,
        { headers: xeroHeaders },
      );
      if (lookupRes.ok) {
        const lookup = await lookupRes.json();
        contactId = lookup.Contacts?.[0]?.ContactID ?? null;
      }
    }

    if (!contactId) {
      const createContactRes = await fetch(
        "https://api.xero.com/api.xro/2.0/Contacts",
        {
          method: "POST",
          headers: xeroHeaders,
          body: JSON.stringify({
            Name: `${contactName}${contactEmail ? ` (${contactEmail})` : ""}`,
            EmailAddress: contactEmail || undefined,
            FirstName: customer.first_name || undefined,
            LastName: customer.last_name || undefined,
            ContactPersons: contactPersons.length ? contactPersons : undefined,
          }),
        },
      );
      if (!createContactRes.ok) {
        const errText = await createContactRes.text();
        throw new Error(`Failed to create Xero contact: ${errText}`);
      }
      const created = await createContactRes.json();
      contactId = created.Contacts?.[0]?.ContactID;
    } else if (contactPersons.length) {
      // Existing contact: update it to ensure ContactPersons are present
      await fetch(`https://api.xero.com/api.xro/2.0/Contacts/${contactId}`, {
        method: "POST",
        headers: xeroHeaders,
        body: JSON.stringify({ ContactPersons: contactPersons }),
      });
    }

    if (!contactId) throw new Error("Could not resolve Xero contact ID");

    // 4. Build LineItems from Shopify line_items
    // AUTHORISED invoices require AccountCode and TaxType on each line.
    const accountCode = Deno.env.get("XERO_SALES_ACCOUNT_CODE") || "200";
    const taxType = Deno.env.get("XERO_TAX_TYPE") || "NONE";

    const lineItems = (order.line_items || []).map((li: any) => {
      const description = [li.title, li.variant_title].filter(Boolean).join(" — ");
      return {
        Description: description || li.name || "Item",
        Quantity: li.quantity,
        UnitAmount: parseFloat(li.price),
        AccountCode: accountCode,
        TaxType: taxType,
      };
    });

    // Add shipping as a separate line if present
    const shippingTotal = parseFloat(order.total_shipping_price_set?.shop_money?.amount ?? "0");
    if (shippingTotal > 0) {
      lineItems.push({
        Description: "Shipping",
        Quantity: 1,
        UnitAmount: shippingTotal,
        AccountCode: accountCode,
        TaxType: taxType,
      });
    }

    // 5. Create the invoice (DRAFT, so it can be reviewed before sending)
    const invoicePayload = {
      Type: "ACCREC",
      Contact: { ContactID: contactId },
      Date: order.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      DueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      Reference: order.name,
      Status: "AUTHORISED",
      CurrencyCode: order.currency,
      LineAmountTypes: "Inclusive",
      LineItems: lineItems,
    };

    const invoiceRes = await fetch(
      "https://api.xero.com/api.xro/2.0/Invoices",
      {
        method: "POST",
        headers: xeroHeaders,
        body: JSON.stringify(invoicePayload),
      },
    );

    const invoiceResult = await invoiceRes.json();
    if (!invoiceRes.ok) {
      console.error("Xero invoice create error:", JSON.stringify(invoiceResult));
      const msg =
        invoiceResult?.Elements?.[0]?.ValidationErrors?.[0]?.Message ||
        invoiceResult?.Message ||
        `Xero responded ${invoiceRes.status}`;
      throw new Error(msg);
    }

    const invoice = invoiceResult.Invoices?.[0];
    if (!invoice) throw new Error("Xero did not return an invoice");

    // 5b. Fetch OnlineInvoiceUrl (the same link Xero's "View Invoice" email button uses).
    // Only available for AUTHORISED/PAID invoices, so safe to fetch here.
    let onlineInvoiceUrl: string | null = null;
    try {
      const onlineRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices/${invoice.InvoiceID}/OnlineInvoice`,
        { headers: xeroHeaders },
      );
      if (onlineRes.ok) {
        const onlineData = await onlineRes.json();
        onlineInvoiceUrl = onlineData?.OnlineInvoices?.[0]?.OnlineInvoiceUrl ?? null;
      } else {
        console.error("Failed to fetch OnlineInvoiceUrl:", onlineRes.status, await onlineRes.text());
      }
    } catch (onlineErr) {
      console.error("OnlineInvoiceUrl fetch error:", onlineErr);
    }

    // 6. Fetch the invoice PDF
    let pdfBase64: string | null = null;
    try {
      const pdfRes = await fetch(
        `https://api.xero.com/api.xro/2.0/Invoices/${invoice.InvoiceID}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "xero-tenant-id": tenantId,
            Accept: "application/pdf",
          },
        },
      );
      if (pdfRes.ok) {
        const buf = new Uint8Array(await pdfRes.arrayBuffer());
        // Encode to base64 in chunks (avoid call-stack overflow)
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          binary += String.fromCharCode(...buf.subarray(i, i + chunk));
        }
        pdfBase64 = btoa(binary);
      } else {
        console.error("Failed to fetch invoice PDF:", pdfRes.status, await pdfRes.text());
      }
    } catch (pdfErr) {
      console.error("PDF fetch error:", pdfErr);
    }

    return json(200, {
      success: true,
      invoiceId: invoice.InvoiceID,
      invoiceNumber: invoice.InvoiceNumber,
      status: invoice.Status,
      orderName: order.name,
      pdf: pdfBase64,
      onlineInvoiceUrl,
    });
  } catch (err) {
    console.error("xero-create-invoice error:", err);
    return json(500, { error: (err as Error).message });
  }
});
