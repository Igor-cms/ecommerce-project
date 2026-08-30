const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  type: "submitted" | "approved" | "rejected";
  email: string;
  contact_name: string;
  business_name: string;
  business_type?: string;
  phone?: string;
  expected_volume?: string;
  additional_info?: string;
}

const FROM = "Legendary Everyday <Support@legendaryeveryday.store>";
const SUPPORT_EMAIL = "Support@legendaryeveryday.store";
const LOGO_URL = "https://legendary-everyday.lovable.app/favicon.png";

function baseLayout(content: string, preview: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <img src="${LOGO_URL}" width="48" height="48" alt="LGD EDY" style="border-radius:12px;"/>
        </td></tr>
        <tr><td>${content}</td></tr>
        <tr><td style="padding-top:32px;font-size:12px;color:#999999;">
          © Legendary Everyday · legendaryeveryday.store
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function submittedApplicantEmail(data: NotificationPayload) {
  const subject = "We received your wholesale application ☕";
  const html = baseLayout(
    `<h1 style="font-family:'Oswald',Arial,sans-serif;font-size:24px;font-weight:bold;color:#2B2B2B;margin:0 0 20px;">
      Application received!
    </h1>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      Hey ${data.contact_name},
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      We received your wholesale application for <strong>${data.business_name}</strong>. 
      We'll review it quickly and get back to you — expect to hear from us soon.
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      In the meantime, feel free to reach out if you have any questions.
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0;">
      — The Legendary Everyday Team
    </p>`,
    "We received your wholesale application"
  );
  return { subject, html };
}

function submittedAdminEmail(data: NotificationPayload) {
  const subject = `New wholesale application — ${data.business_name}`;
  const details = [
    `<strong>Business:</strong> ${data.business_name}`,
    `<strong>Contact:</strong> ${data.contact_name}`,
    `<strong>Email:</strong> ${data.email}`,
    data.phone ? `<strong>Phone:</strong> ${data.phone}` : null,
    `<strong>Type:</strong> ${data.business_type || "—"}`,
    data.expected_volume ? `<strong>Volume:</strong> ${data.expected_volume}` : null,
    data.additional_info ? `<strong>Notes:</strong> ${data.additional_info}` : null,
  ]
    .filter(Boolean)
    .map((d) => `<p style="font-size:14px;color:#4C3F3E;line-height:1.6;margin:0 0 8px;">${d}</p>`)
    .join("");

  const html = baseLayout(
    `<h1 style="font-family:'Oswald',Arial,sans-serif;font-size:24px;font-weight:bold;color:#2B2B2B;margin:0 0 20px;">
      New wholesale application
    </h1>
    <div style="background:#F6F1E9;border-radius:12px;padding:20px;margin-bottom:20px;">
      ${details}
    </div>
    <p style="font-size:14px;color:#999;">Review it in the admin dashboard.</p>`,
    `New wholesale application from ${data.business_name}`
  );
  return { subject, html };
}

function approvedEmail(data: NotificationPayload) {
  const subject = "Your wholesale account has been approved! 🎉";
  const html = baseLayout(
    `<h1 style="font-family:'Oswald',Arial,sans-serif;font-size:24px;font-weight:bold;color:#2B2B2B;margin:0 0 20px;">
      You're in! 🎉
    </h1>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      Hey ${data.contact_name},
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      Great news — your wholesale account for <strong>${data.business_name}</strong> has been approved! 
      You now have access to wholesale pricing.
    </p>
    <a href="https://legendaryeveryday.store/wholesale" 
       style="display:inline-block;background:#DF7489;color:#F6F1E9;font-size:15px;font-weight:600;border-radius:16px;padding:14px 28px;text-decoration:none;margin-bottom:20px;">
      View Wholesale Store
    </a>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:20px 0 0;">
      — The Legendary Everyday Team
    </p>`,
    "Your wholesale account has been approved"
  );
  return { subject, html };
}

function rejectedEmail(data: NotificationPayload) {
  const subject = "Update on your wholesale application";
  const html = baseLayout(
    `<h1 style="font-family:'Oswald',Arial,sans-serif;font-size:24px;font-weight:bold;color:#2B2B2B;margin:0 0 20px;">
      Application update
    </h1>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      Hey ${data.contact_name},
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      Unfortunately, we weren't able to approve your wholesale application for 
      <strong>${data.business_name}</strong> at this time.
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0 0 20px;">
      If you have questions or think this was a mistake, feel free to reach out to us at 
      <a href="mailto:Support@legendaryeveryday.store" style="color:#DF7489;">Support@legendaryeveryday.store</a>.
    </p>
    <p style="font-size:15px;color:#4C3F3E;line-height:1.6;margin:0;">
      — The Legendary Everyday Team
    </p>`,
    "Update on your wholesale application"
  );
  return { subject, html };
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error (${res.status}): ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const data: NotificationPayload = await req.json();

    if (!data.type || !data.email || !data.contact_name || !data.business_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ to: string; status: string }> = [];

    if (data.type === "submitted") {
      const applicant = submittedApplicantEmail(data);
      await sendEmail(apiKey, data.email, applicant.subject, applicant.html);
      results.push({ to: data.email, status: "sent" });

      const admin = submittedAdminEmail(data);
      await sendEmail(apiKey, SUPPORT_EMAIL, admin.subject, admin.html);
      results.push({ to: SUPPORT_EMAIL, status: "sent" });
    } else if (data.type === "approved") {
      const email = approvedEmail(data);
      await sendEmail(apiKey, data.email, email.subject, email.html);
      results.push({ to: data.email, status: "sent" });
    } else if (data.type === "rejected") {
      const email = rejectedEmail(data);
      await sendEmail(apiKey, data.email, email.subject, email.html);
      results.push({ to: data.email, status: "sent" });
    } else {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("wholesale-notification error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
