import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending invoice for order ID: ${orderId}`);

    const mutation = `
      mutation orderInvoiceSend($id: ID!) {
        orderInvoiceSend(id: $id) {
          order { id name }
          userErrors { message field }
        }
      }
    `;

    const variables = {
      id: `gid://shopify/Order/${orderId}`,
    };

    const response = await fetch(
      `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const result = await response.json();
    console.log("Shopify response status:", response.status);

    if (result.errors) {
      console.error("GraphQL errors:", JSON.stringify(result.errors));
      return new Response(JSON.stringify({ error: result.errors[0]?.message || "GraphQL error" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderInvoiceSend } = result.data || {};
    if (orderInvoiceSend?.userErrors?.length > 0) {
      const errMsg = orderInvoiceSend.userErrors.map((e: any) => e.message).join(", ");
      console.error("User errors:", errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderName = orderInvoiceSend?.order?.name || `#${orderId}`;
    console.log(`Invoice sent successfully for order ${orderName}`);

    return new Response(JSON.stringify({ success: true, orderName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending invoice:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
