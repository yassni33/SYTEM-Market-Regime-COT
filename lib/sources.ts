// Téléchargement des données brutes (côté serveur uniquement).
import { COT_CODES, EXTRA_YAHOO, INDICES, USD_PAIRS } from "./markets";

export type Bar = { d: string; o: number; h: number; l: number; c: number };
export type MonthBar = { m: string; c: number };

export type RawPrices = {
  fetchedAt: string;
  // Clé = symbole Yahoo
  daily: Record<string, Bar[]>;
  monthly: Record<string, MonthBar[]>;
  // Date du jour dans le fuseau de la bourse, pour savoir si la dernière bougie est terminée
  today: Record<string, string>;
};

export type CotRow = { d: string; cl: number; cs: number; nl: number; ns: number; oi: number };
export type RawCot = { fetchedAt: string; latestReport: string; rows: Record<string, CotRow[]> };

export type FfEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};
export type RawCalendar = { fetchedAt: string; events: FfEvent[] };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const YAHOO_SYMBOLS: string[] = [
  ...USD_PAIRS.map((p) => p.yahoo),
  EXTRA_YAHOO.DXY,
  ...INDICES.map((i) => i.yahoo),
  EXTRA_YAHOO.VIX,
];

async function fetchOnce(url: string, ms: number, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

// Un essai de plus en cas de coupure réseau passagère ou d'erreur 5xx.
async function fetchWithTimeout(url: string, ms = 15000, init: RequestInit = {}) {
  try {
    const res = await fetchOnce(url, ms, init);
    if (res.status < 500) return res;
  } catch {}
  await new Promise((r) => setTimeout(r, 800));
  return fetchOnce(url, ms, init);
}

type YahooChart = {
  meta: { gmtoffset?: number; regularMarketTime?: number };
  timestamp?: number[];
  indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }[] };
};

async function yahooChart(symbol: string, range: string, interval: string): Promise<YahooChart> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  let lastErr: unknown;
  for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
    try {
      const res = await fetchWithTimeout(host + path, 15000, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Yahoo ${symbol} : HTTP ${res.status}`);
      const json = await res.json();
      const r = json?.chart?.result?.[0];
      if (!r) throw new Error(`Yahoo ${symbol} : réponse vide`);
      return r as YahooChart;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Yahoo ${symbol} : échec`);
}

function localDate(ts: number, offset: number): string {
  return new Date((ts + offset) * 1000).toISOString().slice(0, 10);
}

// Date d'une bougie. Yahoo place certaines bougies 1 h avant minuit (heure d'été) :
// on ajoute 3 h pour retomber sur le bon jour, sauf pour la cotation en cours.
function barDate(ts: number, r: YahooChart): string {
  const off = r.meta.gmtoffset ?? 0;
  const live = r.meta.regularMarketTime != null && Math.abs(ts - r.meta.regularMarketTime) < 60;
  return localDate(live ? ts : ts + 3 * 3600, off);
}

async function yahooDaily(symbol: string): Promise<{ bars: Bar[]; today: string }> {
  const r = await yahooChart(symbol, "6mo", "1d");
  const off = r.meta.gmtoffset ?? 0;
  const q = r.indicators.quote[0];
  const ts = r.timestamp ?? [];
  const map = new Map<string, Bar>();
  ts.forEach((t, i) => {
    const c = q.close[i];
    if (c == null || !isFinite(c)) return;
    const o = q.open[i] ?? c;
    const h = q.high[i] ?? Math.max(o, c);
    const l = q.low[i] ?? Math.min(o, c);
    const d = barDate(t, r);
    map.set(d, { d, o, h, l, c });
  });
  const bars = [...map.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  return { bars, today: localDate(Math.floor(Date.now() / 1000), off) };
}

async function yahooMonthly(symbol: string): Promise<MonthBar[]> {
  const r = await yahooChart(symbol, "15y", "1mo");
  const q = r.indicators.quote[0];
  const map = new Map<string, number>();
  (r.timestamp ?? []).forEach((t, i) => {
    const c = q.close[i];
    if (c == null || !isFinite(c)) return;
    // On garde la dernière valeur connue du mois (Yahoo ajoute parfois une ligne "en cours").
    map.set(barDate(t, r).slice(0, 7), c);
  });
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([m, c]) => ({ m, c }));
}

export async function fetchPrices(): Promise<RawPrices> {
  const daily: RawPrices["daily"] = {};
  const monthly: RawPrices["monthly"] = {};
  const today: RawPrices["today"] = {};
  const errors: string[] = [];
  await Promise.all(
    YAHOO_SYMBOLS.map(async (s) => {
      try {
        const [d, m] = await Promise.all([yahooDaily(s), yahooMonthly(s)]);
        daily[s] = d.bars;
        today[s] = d.today;
        monthly[s] = m;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }),
  );
  if (errors.length) throw new Error(errors.slice(0, 3).join(" · "));
  return { fetchedAt: new Date().toISOString(), daily, monthly, today };
}

export async function fetchCot(): Promise<RawCot> {
  const since = new Date(Date.now() - (3 * 365 + 30) * 86400000).toISOString().slice(0, 10);
  const codes = Object.values(COT_CODES)
    .map((c) => `'${c}'`)
    .join(",");
  const params = new URLSearchParams({
    $select:
      "cftc_contract_market_code,report_date_as_yyyy_mm_dd,comm_positions_long_all,comm_positions_short_all,noncomm_positions_long_all,noncomm_positions_short_all,open_interest_all",
    $where: `cftc_contract_market_code in(${codes}) AND report_date_as_yyyy_mm_dd >= '${since}T00:00:00'`,
    $order: "report_date_as_yyyy_mm_dd ASC",
    $limit: "10000",
  });
  const res = await fetchWithTimeout(`https://publicreporting.cftc.gov/resource/6dca-aqww.json?${params}`, 20000);
  if (!res.ok) throw new Error(`CFTC : HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, string>[];
  const byCode: Record<string, string> = {};
  for (const [k, v] of Object.entries(COT_CODES)) byCode[v] = k;
  const rows: RawCot["rows"] = {};
  let latest = "";
  for (const r of json) {
    const key = byCode[r.cftc_contract_market_code?.trim()];
    if (!key) continue;
    const d = r.report_date_as_yyyy_mm_dd.slice(0, 10);
    (rows[key] ??= []).push({
      d,
      cl: Number(r.comm_positions_long_all),
      cs: Number(r.comm_positions_short_all),
      nl: Number(r.noncomm_positions_long_all),
      ns: Number(r.noncomm_positions_short_all),
      oi: Number(r.open_interest_all),
    });
    if (d > latest) latest = d;
  }
  // Une seule ligne par date (sécurité)
  for (const k of Object.keys(rows)) {
    const m = new Map(rows[k].map((r) => [r.d, r]));
    rows[k] = [...m.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  }
  if (!latest) throw new Error("CFTC : aucune donnée reçue");
  return { fetchedAt: new Date().toISOString(), latestReport: latest, rows };
}

export async function fetchCalendar(): Promise<RawCalendar> {
  const res = await fetchWithTimeout("https://nfs.faireconomy.media/ff_calendar_thisweek.json", 15000, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`ForexFactory : HTTP ${res.status}`);
  const text = await res.text();
  let events: FfEvent[];
  try {
    events = JSON.parse(text);
  } catch {
    throw new Error("ForexFactory : réponse illisible (limite de requêtes atteinte ?)");
  }
  if (!Array.isArray(events)) throw new Error("ForexFactory : format inattendu");
  return { fetchedAt: new Date().toISOString(), events };
}
