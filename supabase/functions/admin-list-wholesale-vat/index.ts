import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type VatResult = {
  vat_number: string | null;
  vat_exempt: boolean;
  source: "shopify" | "local" | "none";
};

const CONCURRENCY = 5;

async function runInChunks<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const results = await Promise.all(chunk.map(worker));
    out.push(...results);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: service_role token or admin/owner user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = claimsData.claims.role;
    if (role !== "service_role") {
      const userId = claimsData.claims.sub;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdminOrOwner = roles?.some(
        (r: { role: string }) => r.role === "admin" || r.role === "owner"
      );
      if (!isAdminOrOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let body: { emails?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const emails = Array.isArray(body.emails)
      ? Array.from(
          new Set(
            (body.emails as unknown[])
              .filter((e): e is string => typeof e === "string" && e.length > 0)
              .map((e) => e.toLowerCase())
          )
        )
      : [];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ results: {} }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shopifyStore = Deno.env.get("SHOPIFY_STORE_NAME");
    const shopifyToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const shopifyConfigured = Boolean(shopifyStore && shopifyToken);
    const shopifyBase = shopifyConfigured
      ? `https://${shopifyStore}.myshopify.com/admin/api/2025-04`
      : null;
    const shopifyHeaders = shopifyConfigured
      ? { "X-Shopify-Access-Token": shopifyToken! }
      : null;

    // Preload local DB entries for all emails in one query via auth.users lookup
    const { data: usersList } = await supabase
      .from("profiles")
      .select("id, email")
      .in("email", emails);

    const emailToUserId = new Map<string, string>();
    for (const u of usersList || []) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
    }

    const userIds = Array.from(emailToUserId.values());
    const localVatByUserId = new Map<
      string,
      { vat_number: string | null; vat_exempt: boolean }
    >();
    if (userIds.length > 0) {
      const { data: localVat } = await supabase
        .from("wholesale_vat_info")
        .select("user_id, vat_number, vat_exempt")
        .in("user_id", userIds);
      for (const row of localVat || []) {
        localVatByUserId.set(row.user_id, {
          vat_number: row.vat_number || null,
          vat_exempt: !!row.vat_exempt,
        });
      }
    }

    const fetchForEmail = async (email: string): Promise<[string, VatResult]> => {
      const userId = emailToUserId.get(email);
      const localRow = userId ? localVatByUserId.get(userId) : undefined;

      if (shopifyConfigured && shopifyBase && shopifyHeaders) {
        try {
          const searchRes = await fetch(
            `${shopifyBase}/customers/search.json?query=email:${encodeURIComponent(email)}`,
            { headers: shopifyHeaders }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const customer = (searchData.customers || []).find(
              (c: { email?: string }) =>
                c.email?.toLowerCase() === email.toLowerCase()
            );
            if (customer) {
              const metaRes = await fetch(
                `${shopifyBase}/customers/${customer.id}/metafields.json?namespace=custom`,
                { headers: shopifyHeaders }
              );
              if (metaRes.ok) {
                const metaData = await metaRes.json();
                const metafields: Array<{ key: string; value: string }> =
                  metaData.metafields || [];
                const vatNumberMeta = metafields.find(
                  (m) => m.key === "vat_number"
                );
                const vatExemptMeta = metafields.find(
                  (m) => m.key === "vat_exempt"
                );
                const vatNumber = vatNumberMeta?.value?.trim() || null;
                const vatExempt = vatExemptMeta?.value === "true";

                if (vatNumber || vatExempt) {
                  if (userId) {
                    await supabase.from("wholesale_vat_info").upsert(
                      {
                        user_id: userId,
                        vat_number: vatNumber && vatNumber !== "" ? vatNumber : null,
                        vat_exempt: vatExempt,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: "user_id" }
                    );
                  }
                  return [
                    email,
                    {
                      vat_number: vatNumber && vatNumber !== "" ? vatNumber : null,
                      vat_exempt: vatExempt,
                      source: "shopify",
                    },
                  ];
                }
              }
            }
          }
        } catch (err) {
          console.error(
            `Shopify lookup failed for ${email}:`,
            (err as Error).message
          );
        }
      }

      if (localRow && (localRow.vat_number || localRow.vat_exempt)) {
        return [
          email,
          {
            vat_number: localRow.vat_number,
            vat_exempt: localRow.vat_exempt,
            source: "local",
          },
        ];
      }

      return [email, { vat_number: null, vat_exempt: false, source: "none" }];
    };

    const entries = await runInChunks(emails, CONCURRENCY, fetchForEmail);
    const results: Record<string, VatResult> = {};
    for (const [email, result] of entries) {
      results[email] = result;
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-list-wholesale-vat error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
