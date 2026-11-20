import { NextResponse, type NextRequest } from "next/server";
import { readCache, writeCache } from "@/lib/cache";
import { fetchCalendar, type RawCalendar } from "@/lib/sources";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TTL = 3600 * 1000; // 1 h
const MIN_REFRESH = 5 * 60 * 1000; // ForexFactory bloque les appels trop fréquents

export async function GET(req: NextRequest) {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign-in required" }, { status: 401 });

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  let cal = await readCache<RawCalendar>(sb, "calendar");
  const age = cal ? Date.now() - Date.parse(cal.fetchedAt) : Infinity;
  // Nouvelle semaine ? (le fichier ForexFactory change le week-end)
  const stale = cal ? !cal.events.some((e) => Date.parse(e.date) > Date.now() - 6 * 86400000) : true;
  let error: string | null = null;

  if (age > TTL || stale || (refresh && age > MIN_REFRESH)) {
    try {
      cal = await fetchCalendar();
      error = await writeCache(sb, "calendar", cal);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  if (!cal) return NextResponse.json({ error: error ?? "Calendar unavailable" }, { status: 503 });
  return NextResponse.json({ ...cal, error });
}
