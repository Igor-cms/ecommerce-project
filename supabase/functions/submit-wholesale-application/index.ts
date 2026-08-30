import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, business_name, contact_name, email, phone, business_type, expected_volume, additional_info } = await req.json();

    if (!business_name || !contact_name || !email || !business_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase.from("wholesale_applications").insert({
      user_id,
      business_name,
      contact_name,
      email,
      phone: phone || null,
      business_type,
      expected_volume: expected_volume || null,
      additional_info: additional_info || null,
    });

    if (error) throw error;

    // Fire-and-forget notification emails
    try {
      const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wholesale-notification`;
      await fetch(notificationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          type: "submitted",
          email,
          contact_name,
          business_name,
          business_type,
          phone: phone || null,
          expected_volume: expected_volume || null,
          additional_info: additional_info || null,
        }),
      });
    } catch (emailErr) {
      console.error("Failed to send notification email:", emailErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
