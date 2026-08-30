import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.8.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("Edge Function create-checkout-session called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Body received:", JSON.stringify(requestBody));
    
    const { cart, whatsapp_referral } = requestBody;
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      console.error("Invalid cart:", cart);
      throw new Error("Invalid or empty cart");
    }

    console.log("Valid cart:", cart);
    console.log("WhatsApp referral:", whatsapp_referral);

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      throw new Error("Stripe not configured");
    }
    console.log("Stripe key found");
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
    });

    // Initialize Supabase with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("User not authenticated");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      console.error("Authentication error:", userError);
      throw new Error("User authentication failed");
    }
    
    console.log("User authenticated:", userData.user.id);

    // Calculate total amount (handle both old and new cart formats)
    const totalAmount = cart.reduce((total: number, item: any) => {
      const price = item.price;
      const quantity = item.quantity || item.qty;
      return total + (price * quantity);
    }, 0);

    // Create order number first
    const orderNumber = `ORD-${Date.now()}`;

    // Prepare line items for Stripe (handle both old and new formats)
    const lineItems = cart.map((item: any) => {
      const name = item.name || item.title;
      const quantity = item.quantity || item.qty;
      return {
        price_data: {
          currency: "eur",
          product_data: { name: name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: quantity,
      };
    });

    // Create order record in Supabase first
    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userData.user.id,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: "pending",
        whatsapp_referral: whatsapp_referral || false,
      })
      .select()
       .single();

    if (orderError || !orderData) {
      console.error("Error creating order:", orderError);
      throw new Error("Failed to create order");
    }

    console.log("Order created:", orderData.id);

    // Normalize and validate cart data before processing
    console.log("=== CART VALIDATION AND NORMALIZATION ===");
    const normalizedCart = [];
    
    for (const item of cart) {
      const validationErrors = [];
      
      const normalizedItem = {
        name: item.name || item.title,
        quantity: item.quantity || item.qty,
        price: item.price,
        size: item.size || item.package_size || "250g",
        roastOption: item.roastOption || item.roast_option || item.roast || null
      };
      
      if (!normalizedItem.name) validationErrors.push("Product name missing");
      if (!normalizedItem.quantity) validationErrors.push("Quantity missing");
      if (!normalizedItem.price) validationErrors.push("Price missing");
      
      if (validationErrors.length > 0) {
        console.error("❌ Validation error on item:", { originalItem: item, errors: validationErrors });
        throw new Error(`Invalid cart data: ${validationErrors.join(", ")}`);
      }
      
      if (!item.size && !item.package_size) {
        console.warn("⚠️ WARNING: Size not specified, using default (250g) for item:", normalizedItem.name);
      }
      if (!normalizedItem.roastOption) {
        console.warn("⚠️ WARNING: Roast option not specified for item:", normalizedItem.name);
      }
      
      normalizedCart.push(normalizedItem);
      console.log("✅ Item normalized:", { original: item, normalized: normalizedItem });
    }
    
    console.log("✅ Cart validation and normalization completed successfully");

    // Create order items for each normalized cart item
    console.log("Creating order_items for", normalizedCart.length, "normalized cart items");
    
    try {
      for (const normalizedItem of normalizedCart) {
        console.log("Processing normalized item:", normalizedItem);
        
        let coffee_id = 1; // default fallback
        try {
          console.log("Looking up coffee by name:", normalizedItem.name);
          
          let { data: coffeeData } = await supabase
            .from("coffees")
            .select("id, name, code")
            .eq("name", normalizedItem.name)
            .maybeSingle();
          
          if (!coffeeData) {
            console.log("Not found by name, trying by code:", normalizedItem.name);
            const { data: coffeeByCode } = await supabase
              .from("coffees")
              .select("id, name, code")
              .eq("code", normalizedItem.name)
              .maybeSingle();
            coffeeData = coffeeByCode;
          }
          
          if (coffeeData) {
            coffee_id = coffeeData.id;
            console.log("Coffee found:", coffeeData);
          } else {
            console.log("Coffee not found, using default ID 1 for:", normalizedItem.name);
          }
        } catch (error) {
          console.error("Error looking up coffee:", error);
          console.log("Using default ID 1 for:", normalizedItem.name);
        }

        const orderItem = {
          order_id: orderData.id,
          coffee_id: coffee_id,
          quantity: normalizedItem.quantity,
          unit_price: normalizedItem.price,
          total_price: normalizedItem.price * normalizedItem.quantity,
          size: normalizedItem.size,
          roast_option: normalizedItem.roastOption
        };
        
        console.log("Inserting order item:", orderItem);
        
        const { data: insertedItem, error: itemError } = await supabase
          .from("order_items")
          .insert(orderItem)
          .select()
          .single();

        if (itemError) {
          console.error("Error creating order item:", itemError);
          console.error("Item that caused error:", orderItem);
        } else {
          console.log("Order item created successfully:", insertedItem);
        }
      }
    } catch (error) {
      console.error("General error creating order_items:", error);
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${req.headers.get("origin")}/success?order_id=${orderNumber}`,
      cancel_url: `${req.headers.get("origin")}/catalogue`,
      metadata: {
        user_id: userData.user.id,
        order_number: orderNumber,
        total_amount: totalAmount.toString(),
        whatsapp_referral: (whatsapp_referral || false).toString(),
      },
    });

    // Update order with Stripe session ID
    await supabase
      .from("orders")
      .update({ notes: `Stripe Session: ${session.id}` })
      .eq("id", orderData.id);

    console.log("Stripe session created:", session.id);
    console.log("Checkout URL:", session.url);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Detailed error in session creation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
