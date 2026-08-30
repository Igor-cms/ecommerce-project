import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderNumber } = await req.json();
    
    console.log('Processing webhook for order:', orderNumber);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch order data
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items!inner(
          *,
          coffees!inner(name, code)
        )
      `)
      .eq("order_number", orderNumber)
      .single();

    if (orderError || !orderData) {
      console.error("Error fetching order:", orderError);
      throw new Error("Order not found");
    }

    console.log('Order data found:', {
      order_number: orderData.order_number,
      items_count: orderData.order_items?.length || 0,
      status: orderData.status
    });

    // Fetch profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, address, whatsapp")
      .eq("user_id", orderData.user_id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    }

    // Calculate total statistics (including paid and pending orders)
    const { data: allOrders } = await supabase
      .from("orders")
      .select(`
        *,
        order_items!inner(*, coffees!inner(name, code))
      `)
      .in("status", ["pago", "pending"]);

    const stats = calculateOrderStats(allOrders || []);

    // Format phone number to international format
    const formatPhoneToInternational = (phone: string | null) => {
      if (!phone) return null;
      
      let cleanPhone = phone.replace(/[^\d+]/g, '');
      
      if (cleanPhone.startsWith('+')) {
        return phone;
      }
      
      if (cleanPhone.length === 11) {
        return `+55 ${phone}`;
      }
      
      if (cleanPhone.length === 10) {
        return `+55 ${phone}`;
      }
      
      return `+55 ${phone}`;
    };

    // Prepare webhook data
    const webhookData = {
      order: {
        id: orderData.id,
        order_number: orderData.order_number,
        total_amount: orderData.total_amount,
        currency: orderData.currency,
        whatsapp_referral: orderData.whatsapp_referral,
        customer: {
          name: profileData?.full_name,
          address: profileData?.address,
          phone: formatPhoneToInternational(profileData?.whatsapp)
        },
        items: (orderData.order_items || []).map((item: any) => ({
          coffee_name: item.coffees?.name || 'N/A',
          coffee_code: item.coffees?.code || 'N/A',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          size: item.size,
          roast_option: item.roast_option
        }))
      },
      statistics: stats
    };

    console.log('Sending data to n8n:', JSON.stringify(webhookData, null, 2));

    // Send to n8n webhook
    const response = await fetch("https://primary-production-87e09.up.railway.app/webhook/630bbf0b-ad54-4c28-b0af-42c8edd374ac", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookData),
    });

    console.log('Response status:', response.status);
    console.log('Response statusText:', response.statusText);
    
    if (!response.ok) {
      const responseText = await response.text();
      console.log('Response body:', responseText);
      throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
    }

    console.log("Webhook sent to n8n successfully");

    return new Response(
      JSON.stringify({ success: true, message: "Webhook sent successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

function calculateOrderStats(allOrders: any[]) {
  const totalOrders = allOrders.length;
  const totalValue = allOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total_amount), 0);
  
  const coffeeStats: Record<string, number> = {};
  allOrders.forEach((order: any) => {
    order.order_items.forEach((item: any) => {
      const coffeeName = item.coffees.name;
      coffeeStats[coffeeName] = (coffeeStats[coffeeName] || 0) + item.quantity;
    });
  });

  const whatsappOrders = allOrders.filter((order: any) => order.whatsapp_referral);
  const whatsappTotalOrders = whatsappOrders.length;
  const whatsappTotalValue = whatsappOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total_amount), 0);
  
  const whatsappCoffeeStats: Record<string, number> = {};
  whatsappOrders.forEach((order: any) => {
    order.order_items.forEach((item: any) => {
      const coffeeName = item.coffees.name;
      whatsappCoffeeStats[coffeeName] = (whatsappCoffeeStats[coffeeName] || 0) + item.quantity;
    });
  });

  return {
    all_orders: { total_orders: totalOrders, total_value: totalValue, coffee_quantities: coffeeStats },
    whatsapp_orders: { total_orders: whatsappTotalOrders, total_value: whatsappTotalValue, coffee_quantities: whatsappCoffeeStats }
  };
}
