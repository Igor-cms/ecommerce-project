import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.8.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function calculateOrderStats(supabase: any) {
  const { data: allOrders, error: allOrdersError } = await supabase
    .from("orders")
    .select(`*, order_items(*, coffees(name, code))`)
    .eq("status", "pago");

  if (allOrdersError) {
    console.error("Error fetching statistics");
    return null;
  }

  const totalOrders = allOrders.length;
  const totalValue = allOrders.reduce((sum: number, order: any) => {
    return sum + (parseFloat(order.total_amount) || 0);
  }, 0);

  const coffeeStats: Record<string, number> = {};
  let totalItemsQuantity = 0;

  allOrders.forEach((order: any) => {
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        const coffeeName = item.coffees?.name || 'Unknown Coffee';
        const quantity = item.quantity || 0;
        coffeeStats[coffeeName] = (coffeeStats[coffeeName] || 0) + quantity;
        totalItemsQuantity += quantity;
      });
    }
  });

  const whatsappOrders = allOrders.filter((order: any) => order.whatsapp_referral === true);
  const whatsappTotalOrders = whatsappOrders.length;
  const whatsappTotalValue = whatsappOrders.reduce((sum: number, order: any) => {
    return sum + (parseFloat(order.total_amount) || 0);
  }, 0);

  const whatsappCoffeeStats: Record<string, number> = {};
  let whatsappTotalItemsQuantity = 0;

  whatsappOrders.forEach((order: any) => {
    if (order.order_items && Array.isArray(order.order_items)) {
      order.order_items.forEach((item: any) => {
        const coffeeName = item.coffees?.name || 'Unknown Coffee';
        const quantity = item.quantity || 0;
        whatsappCoffeeStats[coffeeName] = (whatsappCoffeeStats[coffeeName] || 0) + quantity;
        whatsappTotalItemsQuantity += quantity;
      });
    }
  });

  return {
    all_orders: {
      total_orders: totalOrders, total_value: totalValue,
      total_items_quantity: totalItemsQuantity, coffee_quantities: coffeeStats
    },
    whatsapp_orders: {
      total_orders: whatsappTotalOrders, total_value: whatsappTotalValue,
      total_items_quantity: whatsappTotalItemsQuantity, coffee_quantities: whatsappCoffeeStats
    }
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("Webhook signature missing");
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-06-20",
    });

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Signature verification failed");
      return new Response("Invalid webhook signature", { status: 400 });
    }

    console.log("Stripe event received:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderNumber = session?.metadata?.order_number;
      console.log("Processing checkout for order:", orderNumber);

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      const { data: updateData, error } = await supabase
        .from("orders")
        .update({ status: "pago", updated_at: new Date().toISOString() })
        .eq("order_number", orderNumber)
        .select();

      if (error) {
        console.error("Error updating order status");
        return new Response("Error updating order", { status: 500 });
      }

      console.log(`Order ${orderNumber} updated to 'pago'`);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(`*, profiles!user_id(full_name, address, phone, whatsapp), order_items(*, coffees(name, code))`)
        .eq("order_number", orderNumber)
        .single();

      if (orderError || !orderData) {
        console.error("Error fetching order data");
        return new Response("Error fetching order data", { status: 500 });
      }

      const stats = await calculateOrderStats(supabase);

      let formattedPhone = orderData.profiles?.whatsapp || orderData.profiles?.phone;
      if (formattedPhone && !formattedPhone.startsWith('+')) {
        formattedPhone = '+55' + formattedPhone.replace(/\D/g, '');
      }

      const orderItemsArray = orderData.order_items || [];
      const totalQuantity = orderItemsArray.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
      const itemsTotal = orderItemsArray.reduce((sum: number, item: any) => sum + (parseFloat(item.total_price) || 0), 0);

      const webhookData = {
        order: {
          id: orderData.id,
          order_number: orderData.order_number,
          total_amount: parseFloat(orderData.total_amount),
          currency: orderData.currency,
          whatsapp_referral: orderData.whatsapp_referral || false,
          total_items: orderItemsArray.length,
          total_quantity: totalQuantity,
          items_total: itemsTotal,
          customer: {
            name: orderData.profiles?.full_name || 'Customer',
            address: orderData.profiles?.address || '',
            phone: formattedPhone || '',
            whatsapp: orderData.profiles?.whatsapp || ''
          },
          items: orderItemsArray.map((item: any) => ({
            coffee_name: item.coffees?.name || 'Coffee',
            coffee_code: item.coffees?.code || '',
            quantity: item.quantity || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            total_price: parseFloat(item.total_price) || 0,
            size: item.size || '250g',
            roast_option: item.roast_option || 'Filter'
          }))
        },
        statistics: stats
      };

      try {
        const webhookResponse = await fetch("https://primary-production-87e09.up.railway.app/webhook/630bbf0b-ad54-4c28-b0af-42c8edd374ac", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookData),
        });

        if (!webhookResponse.ok) {
          console.error("Webhook forwarding failed, status:", webhookResponse.status);
        } else {
          console.log("Webhook sent successfully");
        }
      } catch (webhookError) {
        console.error("Error sending webhook notification");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error");
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
