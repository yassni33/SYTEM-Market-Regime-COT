import { NextResponse, type NextRequest } from "next/server";
import { analyze } from "@/lib/analysis";
import { readCache, writeCache } from "@/lib/cache";
import { fetchCot, fetchPrices, type RawCot, type RawPrices } from "@/lib/sources";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const H = 3600 * 1000;
const PRICE_TTL = 4 * H; // prix : rechargés après 4 h
const COT_MAX_AGE = 6.5 * 24 * H; // COT : rechargé si le rapport a plus de 6,5 jours
const COT_RETRY = 4 * H; // ...mais au plus une fois toutes les 4 h (le rapport sort le vendredi)

export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign-in required" }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const now = Date.now();
  const errors: string[] = [];

  let [prices, cot] = await Promise.all([readCache<RawPrices>(sb, "prices"), readCache<RawCot>(sb, "cot")]);

  const pricesAge = prices ? now - Date.parse(prices.fetchedAt) : Infinity;
  const cotReportAge = cot ? now - Date.parse(cot.latestReport + "T00:00:00Z") : Infinity;
  const cotFetchedAge = cot ? now - Date.parse(cot.fetchedAt) : Infinity;
  const needPrices = refresh || pricesAge > PRICE_TTL;
  const needCot = !cot || (cotReportAge > COT_MAX_AGE && (refresh || cotFetchedAge > COT_RETRY));

  await Promise.all([
    needPrices &&
      fetchPrices()
        .then(async (p) => {
          prices = p;
          const err = await writeCache(sb, "prices", p);
          if (err) errors.push(err);
        })
        .catch((e: Error) => errors.push(`Yahoo prices unavailable: ${e.message}`)),
    needCot &&
      fetchCot()
        .then(async (c) => {
          cot = c;
          const err = await writeCache(sb, "cot", c);
          if (err) errors.push(err);
        })
        .catch((e: Error) => errors.push(`COT unavailable: ${e.message}`)),
  ]);

  if (!prices) {
    return NextResponse.json(
      { error: errors.join(" · ") || "No price data available." },
      { status: 503 },
    );
  }
  const mode = now - Date.parse(prices.fetchedAt) <= PRICE_TTL ? "live" : "snapshot";
  try {
    return NextResponse.json(analyze(prices, cot, { mode, errors }));
  } catch (e) {
    return NextResponse.json(
      { error: `Calculation failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
