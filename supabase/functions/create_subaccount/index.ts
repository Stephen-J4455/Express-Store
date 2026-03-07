import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Simple in-memory cache for Paystack bank lists per function instance.
// TTL is short because bank lists can change; cache reduces repeated API calls.
const bankListCache: Record<string, { expiresAt: number; data: any[] }> = {};
const BANK_LIST_TTL_MS = 1000 * 60 * 10; // 10 minutes

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!PAYSTACK_SECRET_KEY)
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");

    const body = await req.json();
    const action = body?.action ?? null;

    // If caller only wants the Paystack bank list, return it here (reuses cache).
    if (action === "list_banks") {
      const countryParam = "ghana";
      console.log("list_banks forced country ->", countryParam);
      const now = Date.now();
      if (
        bankListCache[countryParam] &&
        bankListCache[countryParam].expiresAt > now
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            data: bankListCache[countryParam].data,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      const banksRes = await fetch(
        `https://api.paystack.co/bank?country=${countryParam}`,
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        },
      );
      const banksJson = await banksRes.json();
      console.log(
        "Paystack list_banks response status:",
        banksRes.status,
        "payload status flag:",
        banksJson.status,
        "items:",
        (banksJson.data || []).length,
      );
      if (!banksRes.ok || banksJson.status !== true) {
        console.error("Failed fetching banks from Paystack:", banksJson);
        throw new Error(banksJson.message || "failed_fetch_banks");
      }

      const banks = banksJson.data || [];
      bankListCache[countryParam] = {
        expiresAt: now + BANK_LIST_TTL_MS,
        data: banks,
      };
      return new Response(JSON.stringify({ success: true, data: banks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    const {
      seller_id,
      name,
      email,
      settlement_bank,
      account_number,
      primary_contact_phone,
      type: incomingType,
      currency: incomingCurrency,
    } = body || {};

    const type = String(incomingType || "bank").toLowerCase();
    const currency = String(incomingCurrency || "NGN").toUpperCase();

    // Paystack requires a percentage_charge for subaccounts; allow caller to set it or fall back to env/default 0
    let percentage_charge = undefined;
    if (body && body.percentage_charge != null) {
      percentage_charge = Number(body.percentage_charge);
    } else if (body && body.percentage != null) {
      percentage_charge = Number(body.percentage);
    } else {
      const envDefault = Deno.env.get("PAYSTACK_DEFAULT_SUBACCOUNT_PERCENTAGE");
      percentage_charge = envDefault != null ? Number(envDefault) : 0;
    }

    if (!seller_id) throw new Error("seller_id is required");

    // Build Paystack subaccount payload. Keep fields minimal so function can run at signup.
    const payload: Record<string, any> = {
      business_name: name || `Seller-${seller_id.slice(0, 6)}`,
      primary_contact_name: name || null,
      primary_contact_email: email || null,
    };

    // Optionally include contact phone
    if (primary_contact_phone)
      payload.primary_contact_phone = primary_contact_phone;

    // Validate settlement_bank when required (use Paystack List Banks API to verify codes/names)
    if (type === "bank") {
      if (!settlement_bank)
        throw new Error(
          "settlement_bank is required for bank type and must be a Paystack bank code or bank name",
        );
      const countryParam = "ghana";
      console.log("validate bank against country ->", countryParam);

      try {
        // Use cached bank list when available
        let banks: any[] | undefined;
        const now = Date.now();
        const cacheEntry = bankListCache[countryParam];
        if (cacheEntry && cacheEntry.expiresAt > now) {
          banks = cacheEntry.data;
        } else {
          const banksRes = await fetch(
            `https://api.paystack.co/bank?country=${countryParam}`,
            {
              headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
            },
          );
          const banksJson = await banksRes.json();
          console.log(
            "Paystack validate-banks response status:",
            banksRes.status,
            "payload status flag:",
            banksJson.status,
            "items:",
            (banksJson.data || []).length,
          );
          if (!banksRes.ok || banksJson.status !== true) {
            throw new Error("failed_fetch_banks");
          }
          banks = banksJson.data || [];
          bankListCache[countryParam] = {
            expiresAt: now + BANK_LIST_TTL_MS,
            data: banks,
          };
        }
        const bankDigits = String(settlement_bank).replace(/\D/g, "").trim();
        let matched = null;
        if (bankDigits)
          matched = banks.find((b: any) => String(b.code) === bankDigits);
        if (!matched) {
          const nameLower = String(settlement_bank).toLowerCase();
          matched = banks.find(
            (b: any) => b.name && b.name.toLowerCase().includes(nameLower),
          );
        }

        if (!matched) {
          const samples = (banks || [])
            .slice(0, 6)
            .map((b: any) => `${b.name}:${b.code}`)
            .join(", ");
          throw new Error(
            `Settlement Bank is invalid for ${countryParam}. Examples: ${samples}. Use GET https://api.paystack.co/bank?country=${countryParam} to retrieve the full list.`,
          );
        }

        payload.settlement_bank = String(matched.code);
      } catch (e) {
        // If Paystack bank list validation fails (network/permission), fall back to a basic length check
        console.error(
          "Bank list validation failed, falling back to length validation:",
          e,
        );
        const bankDigits = String(settlement_bank).replace(/\D/g, "").trim();
        const expectedBankLen = currency === "GHS" ? 6 : 3;
        if (bankDigits.length !== expectedBankLen) {
          throw new Error(
            `Settlement Bank is invalid: expected a ${expectedBankLen}-digit code for currency ${currency}.`,
          );
        }
        payload.settlement_bank = bankDigits;
      }
    } else if (settlement_bank) {
      payload.settlement_bank = settlement_bank;
    }

    // Sanitize and validate account number depending on currency
    if (account_number) {
      const acct = String(account_number).replace(/\D/g, "").trim();
      const expectedLen = currency === "GHS" ? 13 : 10;
      if (acct.length !== expectedLen) {
        throw new Error(
          `account_number is invalid: expected ${expectedLen} digits for currency ${currency}`,
        );
      }
      payload.account_number = acct;
    }
    // Include currency if provided
    if (incomingCurrency) payload.currency = currency;
    // Include percentage charge (required by Paystack)
    payload.percentage_charge = percentage_charge;

    // Create subaccount at Paystack
    const res = await fetch("https://api.paystack.co/subaccount", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.status !== true) {
      console.error("Paystack subaccount creation failed:", data);
      throw new Error(data.message || "Paystack error creating subaccount");
    }

    const sub = data.data;

    // Update seller record with payment platform/account.
    // Only perform this update when a SUPABASE_SERVICE_ROLE_KEY is configured to
    // ensure a privileged, minimal operation against `express_sellers` only.
    const accountId = sub.subaccount_code ?? sub.id ?? null;
    // db_update status object to inform callers whether we updated the DB
    const db_update: {
      updated: boolean;
      skipped: boolean;
      error: string | null;
    } = {
      updated: false,
      skipped: false,
      error: null,
    };

    if (accountId) {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        db_update.skipped = true;
        console.warn(
          "SUPABASE_SERVICE_ROLE_KEY not configured — skipping DB update. The subaccount was created at Paystack but seller record will not be updated.",
        );
      } else {
        const writeClient = createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        );
        try {
          const { error: updateErr } = await writeClient
            .from("express_sellers")
            .update({
              payment_platform: "paystack",
              payment_account: accountId,
              account_code: sub.account_code ?? null,
            })
            .eq("id", seller_id);

          if (updateErr) {
            console.error("Failed updating seller with subaccount:", updateErr);
            db_update.error = String(updateErr);
            return new Response(
              JSON.stringify({
                ok: true,
                warning: "updatedb_failed",
                details: updateErr,
                data: { subaccount: sub, db_update },
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              },
            );
          }

          db_update.updated = true;
        } catch (dbErr) {
          console.error("DB update attempt failed:", dbErr);
          db_update.error = String(dbErr);
          return new Response(
            JSON.stringify({
              ok: true,
              warning: "updatedb_failed",
              details: String(dbErr),
              data: { subaccount: sub, db_update },
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            },
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, data: { subaccount: sub, db_update } }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("create_subaccount error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
