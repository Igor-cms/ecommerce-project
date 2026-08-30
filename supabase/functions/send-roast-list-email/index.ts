import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildRoastHtml(items: { title: string; totalKg: number }[], fridayDate: string, windowStart: string, windowEnd: string) {
  const totalKg = items.reduce((sum, i) => sum + i.totalKg, 0).toFixed(2);
  const tableRows = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e5e5;">
      <td style="padding: 10px 12px; font-weight: 500;">${item.title}</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${item.totalKg} kg</td>
    </tr>
  `).join('');

  return {
    subject: `🔥 Roast List — Friday ${fridayDate}`,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2B2B2B; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #DF7489; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">🔥 Roast List</h1>
          <p style="margin: 4px 0 0; font-size: 14px; color: #666;">Friday ${fridayDate} — Orders from ${windowStart} to ${windowEnd}</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #999;">${items.length} coffees · ${totalKg} kg total</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead><tr style="border-bottom: 2px solid #2B2B2B;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 700;">Coffee</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 700;">Total to Roast (kg)</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999;">Legendary Everyday — Roast List generated automatically</div>
      </body></html>
    `,
  };
}

function buildSeparationHtml(items: { title: string; variant: string; quantity: number }[], fridayDate: string, windowStart: string, windowEnd: string) {
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const tableRows = items.map(item => `
    <tr style="border-bottom: 1px solid #e5e5e5;">
      <td style="padding: 10px 12px; font-weight: 500;">${item.title}</td>
      <td style="padding: 10px 12px;">${item.variant}</td>
      <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${item.quantity}</td>
    </tr>
  `).join('');

  return {
    subject: `📦 Separation List — Friday ${fridayDate}`,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2B2B2B; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="border-bottom: 2px solid #DF7489; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700;">📦 Separation List</h1>
          <p style="margin: 4px 0 0; font-size: 14px; color: #666;">Friday ${fridayDate} — Orders from ${windowStart} to ${windowEnd}</p>
          <p style="margin: 4px 0 0; font-size: 12px; color: #999;">${items.length} items · ${totalUnits} units total</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead><tr style="border-bottom: 2px solid #2B2B2B;">
            <th style="padding: 10px 12px; text-align: left; font-weight: 700;">Coffee</th>
            <th style="padding: 10px 12px; text-align: left; font-weight: 700;">Variant</th>
            <th style="padding: 10px 12px; text-align: right; font-weight: 700;">Qty to Separate</th>
          </tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #999;">Legendary Everyday — Separation List generated automatically</div>
      </body></html>
    `,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { to, items, fridayDate, windowStart, windowEnd, type = "roast" } = body;

    if (!to || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subject, html } = type === "separation"
      ? buildSeparationHtml(items, fridayDate, windowStart, windowEnd)
      : buildRoastHtml(items, fridayDate, windowStart, windowEnd);

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Legendary Everyday <Support@legendaryeveryday.store>',
        to: [to],
        subject,
        html,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${type} list email sent to:`, to);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
