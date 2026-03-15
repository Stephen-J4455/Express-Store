import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const bankListCache: Record<string, { expiresAt: number; data: any[] }> = {};
const BANK_LIST_TTL_MS = 1000 * 60 * 10;

const normalizeBanks = (banks: any[]): any[] => {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const b of banks || []) {
    if (!b) continue;
    if (b.active === false || b.is_deleted === true) continue;
    const code = String(b.code || "").trim();
    const name = String(b.name || "").trim();
    if (!code || !name) continue;
    const key = `${code}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...b, code, name });
  }
  return out;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!PAYSTACK_SECRET_KEY)
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");

    const body = await req.json();
    const action = body?.action ?? null;

    if (action === "list_banks") {
      const countryParam = "ghana";
      const now = Date.now();

      const cacheEntry = bankListCache[countryParam];
      if (cacheEntry && cacheEntry.expiresAt > now) {
        return new Response(
          JSON.stringify({ success: true, data: cacheEntry.data }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          },
        );
      }

      const banksRes = await fetch(
        "https://api.paystack.co/bank?country=" + countryParam,
        { headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY } },
      );
      const banksJson = await banksRes.json();

      if (!banksRes.ok || banksJson.status !== true) {
        throw new Error(banksJson.message || "failed_fetch_banks");
      }

      const banks = normalizeBanks(banksJson.data || []);
      bankListCache[countryParam] = {
        expiresAt: now + BANK_LIST_TTL_MS,
        data: banks,
      };

      return new Response(JSON.stringify({ success: true, data: banks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "get_subaccount") {
      const subaccountCode = String(body?.subaccount_code || "").trim();
      if (!subaccountCode) {
        throw new Error("subaccount_code is required for get_subaccount");
      }

      const detailsRes = await fetch(
        "https://api.paystack.co/subaccount/" +
          encodeURIComponent(subaccountCode),
        { headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY } },
      );
      const detailsJson = await detailsRes.json();

      if (!detailsRes.ok || detailsJson.status !== true) {
        throw new Error(detailsJson.message || "failed_fetch_subaccount");
      }

      return new Response(
        JSON.stringify({ success: true, data: detailsJson.data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const sellerId = body?.seller_id;
    const name = body?.name;
    const email = body?.email;
    const settlementBank = body?.settlement_bank;
    const accountNumber = body?.account_number;
    const incomingSubaccountCode = String(body?.subaccount_code || "").trim();
    const primaryContactPhone = body?.primary_contact_phone;
    const type = String(body?.type || "bank").toLowerCase();
    const currency = String(body?.currency || "GHS").toUpperCase();

    if (!sellerId) throw new Error("seller_id is required");

    let percentageCharge = 0;
    if (body?.percentage_charge != null) {
      percentageCharge = Number(body.percentage_charge);
    } else if (body?.percentage != null) {
      percentageCharge = Number(body.percentage);
    } else {
      const envDefault = Deno.env.get("PAYSTACK_DEFAULT_SUBACCOUNT_PERCENTAGE");
      percentageCharge = envDefault != null ? Number(envDefault) : 0;
    }

    const payload: Record<string, any> = {
      business_name: name || "Seller-" + String(sellerId).slice(0, 6),
      primary_contact_name: name || null,
      primary_contact_email: email || null,
      percentage_charge: percentageCharge,
      currency,
    };

    if (primaryContactPhone)
      payload.primary_contact_phone = primaryContactPhone;

    if (type === "bank" || type === "mobile_money") {
      if (!settlementBank) {
        throw new Error("settlement_bank is required");
      }

      const countryParam = "ghana";
      const now = Date.now();
      let banks: any[] = [];
      const cacheEntry = bankListCache[countryParam];
      if (cacheEntry && cacheEntry.expiresAt > now) {
        banks = cacheEntry.data || [];
      } else {
        const banksRes = await fetch(
          "https://api.paystack.co/bank?country=" + countryParam,
          { headers: { Authorization: "Bearer " + PAYSTACK_SECRET_KEY } },
        );
        const banksJson = await banksRes.json();
        if (!banksRes.ok || banksJson.status !== true) {
          throw new Error(banksJson.message || "failed_fetch_banks");
        }
        banks = normalizeBanks(banksJson.data || []);
        bankListCache[countryParam] = {
          expiresAt: now + BANK_LIST_TTL_MS,
          data: banks,
        };
      }

      const settlementInput = String(settlementBank).trim();
      let matchedBank: any = null;

      if (type === "bank") {
        const inputLower = settlementInput.toLowerCase();
        matchedBank = banks.find(
          (b: any) =>
            String(b.code || "").toLowerCase() === inputLower ||
            String(b.name || "").toLowerCase() === inputLower,
        );
        if (!matchedBank) {
          matchedBank = banks.find((b: any) =>
            String(b.name || "")
              .toLowerCase()
              .includes(inputLower),
          );
        }
      } else {
        // Map app/provider aliases to Paystack-facing keywords.
        const providerAliasMap: Record<string, string> = {
          mtn: "mtn",
          airteltigo: "airtel",
          telecel: "telecel",
          vodafone: "telecel",
          vod: "telecel",
        };
        const providerKey =
          providerAliasMap[settlementInput.toLowerCase()] ||
          settlementInput.toLowerCase();

        matchedBank = banks.find(
          (b: any) =>
            String(b.code || "").toLowerCase() === providerKey ||
            String(b.name || "")
              .toLowerCase()
              .includes(providerKey),
        );
      }

      if (!matchedBank || !matchedBank.code) {
        throw new Error("Settlement Bank is invalid");
      }

      payload.settlement_bank = String(matchedBank.code);
    }

    let normalizedPayoutAccount: string | null = null;
    if (accountNumber) {
      const acct = String(accountNumber).replace(/\D/g, "").trim();

      if (type === "mobile_money") {
        if (acct.length < 10 || acct.length > 13) {
          throw new Error(
            "account_number is invalid: expected 10 to 13 digits for mobile money",
          );
        }
      } else {
        // Bank account formats can vary by institution/currency.
        if (acct.length < 10 || acct.length > 13) {
          throw new Error(
            "account_number is invalid: expected 10 to 13 digits for bank accounts",
          );
        }
      }

      payload.account_number = acct;
      normalizedPayoutAccount = acct;
    }

    let existingSubaccountCode = incomingSubaccountCode || null;
    if (!existingSubaccountCode && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const writeClient = createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data: sellerRow } = await writeClient
          .from("express_sellers")
          .select("payment_account")
          .eq("id", sellerId)
          .maybeSingle();
        existingSubaccountCode =
          String(sellerRow?.payment_account || "").trim() || null;
      } catch (lookupErr) {
        console.warn("Failed to lookup existing subaccount code:", lookupErr);
      }
    }

    const method = existingSubaccountCode ? "PUT" : "POST";
    const endpoint = existingSubaccountCode
      ? "https://api.paystack.co/subaccount/" +
        encodeURIComponent(existingSubaccountCode)
      : "https://api.paystack.co/subaccount";

    const subRes = await fetch(endpoint, {
      method,
      headers: {
        Authorization: "Bearer " + PAYSTACK_SECRET_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const subJson = await subRes.json();
    if (!subRes.ok || subJson.status !== true) {
      throw new Error(subJson.message || "Paystack error creating subaccount");
    }

    const sub = subJson.data || {};
    const accountId =
      sub.subaccount_code || existingSubaccountCode || sub.id || null;

    const dbUpdate = {
      updated: false,
      skipped: false,
      error: null as string | null,
    };

    if (accountId) {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        dbUpdate.skipped = true;
      } else {
        const writeClient = createClient(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
        );
        const { error: updateErr } = await writeClient
          .from("express_sellers")
          .update({
            payment_platform: "paystack",
            payment_account: accountId,
            account_code: normalizedPayoutAccount,
            payment_provider: type,
            payment_currency: currency,
            account_verified: false,
          })
          .eq("id", sellerId);

        if (updateErr) {
          dbUpdate.error = String(updateErr);
        } else {
          dbUpdate.updated = true;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subaccount: sub,
          db_update: dbUpdate,
          mode: existingSubaccountCode ? "updated" : "created",
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
