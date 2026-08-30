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
    console.log('Running webhook test and cleanup...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Sending test webhook...');
    
    const webhookResponse = await fetch("https://lwwelsxmkaomnbiykqpt.supabase.co/functions/v1/send-n8n-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ orderNumber: 'ORD-2025-001' }),
    });

    const webhookResult = await webhookResponse.json();
    console.log('Webhook result:', webhookResult);

    console.log('Waiting 3 seconds before deleting...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', 'cd3eb5fe-fae6-42ff-8767-505da71adccd');

    if (deleteItemsError) {
      console.error('Error deleting items:', deleteItemsError);
    } else {
      console.log('Order items deleted successfully');
    }

    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', 'cd3eb5fe-fae6-42ff-8767-505da71adccd');

    if (deleteOrderError) {
      console.error('Error deleting order:', deleteOrderError);
    } else {
      console.log('Order deleted successfully');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook sent and test order removed",
        webhook_result: webhookResult 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error running test:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
