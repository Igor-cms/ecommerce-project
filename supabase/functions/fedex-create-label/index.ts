import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// FedEx API base — switch to apis-sandbox.fedex.com for testing
const FEDEX_BASE = Deno.env.get('FEDEX_API_BASE') ?? 'https://apis.fedex.com';

// Default shipper (Portugal). Can be overridden via env vars later.
const SHIPPER = {
  contact: {
    personName: Deno.env.get('FEDEX_SHIPPER_NAME') ?? 'Legendary Everyday',
    companyName: Deno.env.get('FEDEX_SHIPPER_COMPANY') ?? 'Legendary Everyday',
    phoneNumber: Deno.env.get('FEDEX_SHIPPER_PHONE') ?? '351000000000',
    emailAddress: Deno.env.get('FEDEX_SHIPPER_EMAIL') ?? 'support@legendaryeveryday.store',
  },
  address: {
    streetLines: [Deno.env.get('FEDEX_SHIPPER_STREET') ?? 'Rua da Torrefação, 1'],
    city: Deno.env.get('FEDEX_SHIPPER_CITY') ?? 'Lisboa',
    stateOrProvinceCode: Deno.env.get('FEDEX_SHIPPER_STATE') ?? '',
    postalCode: Deno.env.get('FEDEX_SHIPPER_POSTAL') ?? '1000-001',
    countryCode: Deno.env.get('FEDEX_SHIPPER_COUNTRY') ?? 'PT',
  },
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getFedexToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const apiKey = Deno.env.get('FEDEX_API_KEY')!;
  const secret = Deno.env.get('FEDEX_SECRET_KEY')!;
  const res = await fetch(`${FEDEX_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secret)}`,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`FedEx OAuth failed (${res.status}): ${text}`);
  const data = JSON.parse(text);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const token = authHeader.replace('Bearer ', '');
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
  const userId = claims.claims.sub as string;

  const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', userId);
  const isAdmin = roles?.some((r: any) => r.role === 'admin' || r.role === 'owner');
  if (!isAdmin) return json({ error: 'Forbidden' }, 403);

  const storeName = Deno.env.get('SHOPIFY_STORE_NAME');
  const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  if (!storeName || !shopifyToken) return json({ error: 'Shopify not configured' }, 500);
  const shopifyBase = `https://${storeName}.myshopify.com/admin/api/2025-04`;
  const shopifyHeaders = { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' };

  try {
    const body = await req.json();
    const { orderId, serviceType: requestedService, weightKg: overrideWeight } = body ?? {};
    if (!orderId) return json({ error: 'orderId is required' }, 400);

    // 1. Fetch order
    const orderRes = await fetch(`${shopifyBase}/orders/${orderId}.json`, { headers: shopifyHeaders });
    if (!orderRes.ok) return json({ error: 'Failed to fetch order', details: await orderRes.text() }, orderRes.status);
    const { order } = await orderRes.json();

    const ship = order.shipping_address;
    if (!ship) return json({ error: 'Order has no shipping address' }, 400);

    // Compute weight from line items (grams parsed from variant title) + 200g packaging
    let grams = 0;
    for (const li of order.line_items ?? []) {
      if (li.grams && li.grams > 0) {
        grams += li.grams * li.quantity;
      } else {
        const m = String(li.variant_title ?? li.title ?? '').match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i);
        if (m) {
          const v = parseFloat(m[1].replace(',', '.'));
          grams += (m[2].toLowerCase() === 'kg' ? v * 1000 : v) * li.quantity;
        }
      }
    }
    grams += 200;
    const weightKg = overrideWeight && overrideWeight > 0 ? overrideWeight : Math.max(0.5, grams / 1000);

    const destCountry = (ship.country_code || '').toUpperCase();
    const isInternational = destCountry !== SHIPPER.address.countryCode;
    const isExtraEU = isInternational && !(EU_COUNTRIES.has(destCountry) && EU_COUNTRIES.has(SHIPPER.address.countryCode));
    const serviceType = requestedService || (isInternational ? 'INTERNATIONAL_PRIORITY' : 'FEDEX_REGIONAL_ECONOMY');

    // 2. FedEx token
    const fedexToken = await getFedexToken();

    // 3. Build ship request
    const accountNumber = Deno.env.get('FEDEX_ACCOUNT_NUMBER')!;
    const totalValue = parseFloat(order.total_price ?? '0') || (order.line_items ?? []).reduce((s: number, li: any) => s + parseFloat(li.price ?? '0') * li.quantity, 0);
    const currency = order.currency ?? 'EUR';

    const recipient = {
      contact: {
        personName: `${ship.first_name ?? ''} ${ship.last_name ?? ''}`.trim() || ship.name,
        phoneNumber: (ship.phone || order.phone || order.customer?.phone || '0000000000').replace(/[^\d+]/g, '').slice(0, 15),
        companyName: ship.company || undefined,
      },
      address: {
        streetLines: [ship.address1, ship.address2].filter(Boolean),
        city: ship.city,
        stateOrProvinceCode: ship.province_code || '',
        postalCode: ship.zip,
        countryCode: destCountry,
        residential: !ship.company,
      },
    };

    const shipPayload: any = {
      labelResponseOptions: 'LABEL',
      requestedShipment: {
        shipper: SHIPPER,
        recipients: [recipient],
        shipDatestamp: new Date().toISOString().slice(0, 10),
        serviceType,
        packagingType: 'YOUR_PACKAGING',
        pickupType: 'USE_SCHEDULED_PICKUP',
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: { responsibleParty: { accountNumber: { value: accountNumber } } },
        },
        labelSpecification: {
          imageType: 'PDF',
          labelStockType: 'PAPER_4X6',
        },
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: Number(weightKg.toFixed(2)) },
          },
        ],
      },
      accountNumber: { value: accountNumber },
    };

    if (isExtraEU) {
      shipPayload.requestedShipment.customsClearanceDetail = {
        dutiesPayment: { paymentType: 'RECIPIENT' },
        commodities: [
          {
            description: 'Roasted coffee beans',
            countryOfManufacture: SHIPPER.address.countryCode,
            quantity: 1,
            quantityUnits: 'PCS',
            unitPrice: { amount: totalValue, currency },
            customsValue: { amount: totalValue, currency },
            weight: { units: 'KG', value: Number(weightKg.toFixed(2)) },
            harmonizedCode: '090121',
            numberOfPieces: 1,
          },
        ],
      };
    }

    // 4. Call FedEx Ship API
    const shipRes = await fetch(`${FEDEX_BASE}/ship/v1/shipments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${fedexToken}`,
        'Content-Type': 'application/json',
        'X-locale': 'en_US',
      },
      body: JSON.stringify(shipPayload),
    });
    const shipText = await shipRes.text();
    if (!shipRes.ok) {
      console.error(`FedEx Ship API failed: ${shipRes.status} :: ${shipText.slice(0, 2000)}`);
      let parsed: any = shipText;
      try { parsed = JSON.parse(shipText); } catch {}
      return json({ error: 'FedEx API rejected the shipment', status: shipRes.status, details: parsed }, 200);
    }
    const shipData = JSON.parse(shipText);

    const completed = shipData.output?.transactionShipments?.[0];
    const piece = completed?.pieceResponses?.[0];
    const trackingNumber = piece?.trackingNumber || completed?.masterTrackingNumber;
    const masterTracking = completed?.masterTrackingNumber;
    const labelB64 = piece?.packageDocuments?.[0]?.encodedLabel;

    if (!trackingNumber || !labelB64) {
      return json({ error: 'FedEx response missing label/tracking', details: shipData }, 502);
    }

    // 5. Upload PDF to storage
    const pdfBytes = Uint8Array.from(atob(labelB64), (c) => c.charCodeAt(0));
    const labelPath = `${orderId}/${trackingNumber}.pdf`;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { error: uploadErr } = await adminClient.storage
      .from('shipping-labels')
      .upload(labelPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) {
      console.error('Storage upload failed:', uploadErr.message);
      return json({ error: 'Failed to save label PDF', details: uploadErr.message }, 500);
    }

    // 6. Insert tracking record
    await adminClient.from('shipping_labels').insert({
      shopify_order_id: String(orderId),
      tracking_number: trackingNumber,
      master_tracking_number: masterTracking,
      carrier: 'FEDEX',
      service_type: serviceType,
      label_path: labelPath,
      weight_kg: weightKg,
      created_by: userId,
    });

    // 7. Create Shopify fulfillment with tracking
    let fulfillmentResult: any = null;
    try {
      const foRes = await fetch(`${shopifyBase}/orders/${orderId}/fulfillment_orders.json`, { headers: shopifyHeaders });
      if (foRes.ok) {
        const { fulfillment_orders } = await foRes.json();
        const openFOs = (fulfillment_orders ?? []).filter((fo: any) => fo.status === 'open' || fo.status === 'in_progress');
        if (openFOs.length > 0) {
          const fRes = await fetch(`${shopifyBase}/fulfillments.json`, {
            method: 'POST',
            headers: shopifyHeaders,
            body: JSON.stringify({
              fulfillment: {
                line_items_by_fulfillment_order: openFOs.map((fo: any) => ({ fulfillment_order_id: fo.id })),
                tracking_info: {
                  number: trackingNumber,
                  url: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
                  company: 'FedEx',
                },
                notify_customer: true,
              },
            }),
          });
          fulfillmentResult = { status: fRes.status, ok: fRes.ok };
          if (!fRes.ok) console.error('Shopify fulfillment failed:', await fRes.text());
        }
      }
    } catch (e) {
      console.error('Fulfillment step error:', (e as Error).message);
    }

    // 8. Signed URL for immediate download
    const { data: signed } = await adminClient.storage
      .from('shipping-labels')
      .createSignedUrl(labelPath, 3600);

    return json({
      success: true,
      trackingNumber,
      masterTracking,
      serviceType,
      weightKg,
      labelPath,
      pdfDownloadUrl: signed?.signedUrl,
      trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      fulfillment: fulfillmentResult,
    });
  } catch (err) {
    console.error('fedex-create-label error:', (err as Error).message);
    return json({ error: 'Internal error', message: (err as Error).message }, 500);
  }
});
