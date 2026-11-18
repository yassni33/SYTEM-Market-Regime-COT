// Moteur d'analyse : régime, force des devises, setups, COT, saisonnalité.
// Fonctions pures, utilisées côté serveur par /api/market.
import {
  COT_LABELS,
  CURRENCIES,
  type Currency,
  EXTRA_YAHOO,
  FX_PAIRS,
  INDICES,
  RISK_BETA,
  USD_PAIRS,
  priceDecimals,
} from "./markets";
import type { MonthBar, RawCot, RawPrices } from "./sources";

export type SignalValue = -1 | 0 | 1;
export type Signal = { key: string; label: string; value: SignalValue; detail: string };
export type Grade = "A" | "B" | "C" | null;
export type Bias = "Long" | "Short" | "Neutre";

export type MarketRow = {
  symbol: string;
  name: string;
  kind: "fx" | "index";
  usd: boolean;
  base?: Currency;
  quote?: Currency;
  price: number;
  dec: number;
  ch1w: number;
  signals: Signal[];
  total: number;
  bias: Bias;
  grade: Grade;
  nr: "NR7" | "NR4" | null;
  opensAbove: number;
  opens: { w: number | null; m: number | null; q: number | null; y: number | null };
  seasonAvg: number | null;
  seasonPct: number | null;
  strengthBase?: number;
  strengthQuote?: number;
  cotIndex?: number | null;
  spark: number[];
};

export type CotSummary = {
  key: string;
  label: string;
  date: string;
  comm3y: number | null;
  comm6m: number | null;
  spec3y: number | null;
  commNet: number;
  specNet: number;
  specChange: number;
  commChange: number;
  history: { d: string; comm: number; spec: number }[];
};

export type Analysis = {
  meta: {
    mode: "live" | "snapshot";
    pricesAt: string | null;
    cotReport: string | null;
    cotFetchedAt: string | null;
    errors: string[];
    generatedAt: string;
  };
  summary: string;
  regime: {
    label: "RISK-ON" | "RISK-OFF" | "MIXTE";
    value: SignalValue;
    yes: number;
    tests: { label: string; ok: boolean; detail: string }[];
  };
  intermarket: { symbol: string; name: string; last: number; ch5: number; ch20: number; spark: number[]; dec: number }[];
  strength: { ccy: Currency; score: number; raw: number; w: number; m: number; q: number }[];
  strongPairs: { symbol: string; buy: Currency; sell: Currency; gap: number; direction: "Long" | "Short" }[];
  markets: MarketRow[];
  cot: CotSummary[];
  seasonality: { symbol: string; kind: "fx" | "index"; months: { pct: number | null; avg: number | null; n: number }[] }[];
  currentMonth: number; // 0-11
};

// ---------- Outils ----------
const last = <T,>(a: T[]) => a[a.length - 1];
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const pct = (a: number, b: number) => (a / b - 1) * 100;
const sign = (x: number, up: number, down: number): SignalValue => (x > up ? 1 : x < down ? -1 : 0);
const fmt = (x: number, d = 2) =>
  x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtSigned = (x: number, d = 2) => (x > 0 ? "+" : "") + fmt(x, d);

function addDays(iso: string, n: number) {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function mondayOf(iso: string) {
  const day = new Date(iso + "T00:00:00Z").getUTCDay(); // 0 = dimanche
  return addDays(iso, -((day + 6) % 7));
}
function lastCloseBefore(dates: string[], closes: number[], before: string): number | null {
  for (let i = dates.length - 1; i >= 0; i--) if (dates[i] < before) return closes[i];
  return null;
}
function prevMonthKey(key: string) {
  let [y, m] = key.split("-").map(Number);
  m -= 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

type Series = {
  dates: string[];
  closes: number[];
  ranges: number[]; // range relatif (plus haut − plus bas) / clôture
  complete: number; // nombre de bougies terminées
  monthly: MonthBar[];
};

// ---------- Construction des séries ----------
function buildSeries(p: RawPrices) {
  const ref = p.daily["EURUSD=X"] ?? [];
  const dates = ref.map((b) => b.d);
  const n = dates.length;

  // Valeur de chaque devise exprimée en USD, alignée sur les dates d'EURUSD.
  const val: Record<string, number[]> = { USD: new Array(n).fill(1) };
  const rr: Record<string, number[]> = { USD: new Array(n).fill(0) };
  const mval: Record<string, Map<string, number>> = {};

  for (const up of USD_PAIRS) {
    const bars = p.daily[up.yahoo] ?? [];
    const map = new Map(bars.map((b) => [b.d, b]));
    let prev = bars[0];
    val[up.ccy] = [];
    rr[up.ccy] = [];
    for (const d of dates) {
      const b = map.get(d) ?? prev;
      prev = b;
      val[up.ccy].push(up.inverse ? 1 / b.c : b.c);
      rr[up.ccy].push((b.h - b.l) / b.c);
    }
    mval[up.ccy] = new Map((p.monthly[up.yahoo] ?? []).map((m) => [m.m, up.inverse ? 1 / m.c : m.c]));
  }

  const fxToday = p.today["EURUSD=X"];
  const fxComplete = n > 0 && last(dates) === fxToday ? n - 1 : n;

  const fx: Record<string, Series> = {};
  for (const pair of FX_PAIRS) {
    const a = val[pair.base];
    const b = val[pair.quote];
    const closes = dates.map((_, i) => a[i] / b[i]);
    const ranges = dates.map((_, i) => rr[pair.base][i] + rr[pair.quote][i]);
    const keys = pair.base === "USD" ? [...mval[pair.quote].keys()] : [...mval[pair.base].keys()];
    const monthly: MonthBar[] = [];
    for (const k of keys.sort()) {
      const va = pair.base === "USD" ? 1 : mval[pair.base].get(k);
      const vb = pair.quote === "USD" ? 1 : mval[pair.quote].get(k);
      if (va != null && vb != null) monthly.push({ m: k, c: va / vb });
    }
    fx[pair.symbol] = { dates, closes, ranges, complete: fxComplete, monthly };
  }

  const idx = (yahoo: string): Series => {
    const bars = p.daily[yahoo] ?? [];
    const ds = bars.map((b) => b.d);
    const complete = bars.length > 0 && last(ds) === p.today[yahoo] ? bars.length - 1 : bars.length;
    return {
      dates: ds,
      closes: bars.map((b) => b.c),
      ranges: bars.map((b) => (b.h - b.l) / b.c),
      complete,
      monthly: p.monthly[yahoo] ?? [],
    };
  };

  const indices: Record<string, Series> = {};
  for (const i of INDICES) indices[i.symbol] = idx(i.yahoo);
  return { dates, val, fx, indices, dxy: idx(EXTRA_YAHOO.DXY), vix: idx(EXTRA_YAHOO.VIX) };
}

// ---------- Calculs par marché ----------
function sma(closes: number[], len: number) {
  return mean(closes.slice(-len));
}

function nrTest(s: Series): "NR7" | "NR4" | null {
  const r = s.ranges.slice(0, s.complete);
  if (r.length < 7) return null;
  const lastR = last(r);
  const prev = (k: number) => r.slice(-k, -1);
  if (lastR <= Math.min(...prev(7))) return "NR7";
  if (lastR <= Math.min(...prev(4))) return "NR4";
  return null;
}

function opens(s: Series) {
  const d = last(s.dates);
  const price = last(s.closes);
  const monthStart = d.slice(0, 7) + "-01";
  const mo = Number(d.slice(5, 7));
  const qStartMonth = Math.floor((mo - 1) / 3) * 3 + 1;
  const quarterStart = `${d.slice(0, 4)}-${String(qStartMonth).padStart(2, "0")}-01`;
  const w = lastCloseBefore(s.dates, s.closes, mondayOf(d));
  const m = lastCloseBefore(s.dates, s.closes, monthStart);
  const q = lastCloseBefore(s.dates, s.closes, quarterStart);
  const prevDec = `${Number(d.slice(0, 4)) - 1}-12`;
  const y = s.monthly.find((x) => x.m === prevDec)?.c ?? lastCloseBefore(s.dates, s.closes, d.slice(0, 4) + "-01-01");
  const list = [w, m, q, y];
  const above = list.filter((x) => x != null && price > x).length;
  const known = list.filter((x) => x != null).length;
  return { opens: { w, m, q, y }, above, known };
}

function seasonality(monthly: MonthBar[], currentKey: string) {
  const map = new Map(monthly.map((x) => [x.m, x.c]));
  const months: { pct: number | null; avg: number | null; n: number }[] = [];
  for (let mo = 1; mo <= 12; mo++) {
    const rets: number[] = [];
    const keys = monthly
      .map((x) => x.m)
      .filter((k) => Number(k.slice(5, 7)) === mo && k < currentKey)
      .sort()
      .reverse();
    for (const k of keys) {
      const prev = map.get(prevMonthKey(k));
      const cur = map.get(k);
      if (prev != null && cur != null) rets.push(pct(cur, prev));
      if (rets.length === 10) break;
    }
    months.push(
      rets.length
        ? { pct: (rets.filter((r) => r > 0).length / rets.length) * 100, avg: mean(rets), n: rets.length }
        : { pct: null, avg: null, n: 0 },
    );
  }
  return months;
}

function cotIndex(values: number[]): number | null {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return 50;
  return ((last(values) - lo) / (hi - lo)) * 100;
}

function summarizeCot(cot: RawCot | null): CotSummary[] {
  if (!cot) return [];
  const out: CotSummary[] = [];
  for (const key of Object.keys(COT_LABELS)) {
    const rows = cot.rows[key];
    if (!rows?.length) continue;
    const comm = rows.map((r) => r.cl - r.cs);
    const spec = rows.map((r) => r.nl - r.ns);
    const n = rows.length;
    out.push({
      key,
      label: COT_LABELS[key],
      date: rows[n - 1].d,
      comm3y: cotIndex(comm.slice(-156)),
      comm6m: cotIndex(comm.slice(-26)),
      spec3y: cotIndex(spec.slice(-156)),
      commNet: comm[n - 1],
      specNet: spec[n - 1],
      specChange: n > 1 ? spec[n - 1] - spec[n - 2] : 0,
      commChange: n > 1 ? comm[n - 1] - comm[n - 2] : 0,
      history: rows.slice(-52).map((r) => ({ d: r.d, comm: r.cl - r.cs, spec: r.nl - r.ns })),
    });
  }
  return out;
}

function gradeOf(total: number): Grade {
  const a = Math.abs(total);
  return a >= 4 ? "A" : a === 3 ? "B" : a === 2 ? "C" : null;
}

// ---------- Analyse complète ----------
export function analyze(
  p: RawPrices,
  cot: RawCot | null,
  meta: { mode: "live" | "snapshot"; errors: string[] },
): Analysis {
  const S = buildSeries(p);
  const n = S.dates.length;
  const lastDate = last(S.dates);
  const currentKey = lastDate.slice(0, 7);
  const currentMonth = Number(lastDate.slice(5, 7)) - 1;

  // --- Étape 1 : régime ---
  const es = S.indices.ES, nq = S.indices.NQ, aj = S.fx.AUDJPY, vix = S.vix, dxy = S.dxy;
  const dec = (x: number, d: number) => fmt(x, d);
  const vixNow = last(vix.closes);
  const vix5 = vix.closes[vix.closes.length - 6];
  const dxyNow = last(dxy.closes);
  const dxy20 = dxy.closes[dxy.closes.length - 21];
  const tests = [
    { label: "S&P 500 au-dessus de sa moyenne 20 jours", ok: last(es.closes) > sma(es.closes, 20), detail: `${dec(last(es.closes), 2)} contre ${dec(sma(es.closes, 20), 2)}` },
    { label: "Nasdaq au-dessus de sa moyenne 20 jours", ok: last(nq.closes) > sma(nq.closes, 20), detail: `${dec(last(nq.closes), 2)} contre ${dec(sma(nq.closes, 20), 2)}` },
    { label: "AUD/JPY au-dessus de sa moyenne 20 jours", ok: last(aj.closes) > sma(aj.closes, 20), detail: `${dec(last(aj.closes), 3)} contre ${dec(sma(aj.closes, 20), 3)}` },
    { label: "VIX sous 20", ok: vixNow < 20, detail: `VIX à ${dec(vixNow, 2)}` },
    { label: "VIX en baisse sur 5 jours", ok: vixNow < vix5, detail: `${dec(vix5, 2)} → ${dec(vixNow, 2)}` },
    { label: "Dollar index en baisse sur 20 jours", ok: dxyNow < dxy20, detail: `${dec(dxy20, 2)} → ${dec(dxyNow, 2)}` },
  ];
  const yes = tests.filter((t) => t.ok).length;
  const regimeValue: SignalValue = yes >= 4 ? 1 : yes <= 2 ? -1 : 0;
  const regimeLabel = regimeValue === 1 ? "RISK-ON" : regimeValue === -1 ? "RISK-OFF" : "MIXTE";

  const inter = (symbol: string, name: string, s: Series, d: number) => {
    const c = s.closes;
    return {
      symbol,
      name,
      last: last(c),
      ch5: pct(last(c), c[c.length - 6]),
      ch20: pct(last(c), c[c.length - 21]),
      spark: c.slice(-40),
      dec: d,
    };
  };
  const intermarket = [
    inter("DXY", "Dollar index", dxy, 2),
    inter("ES", "S&P 500", es, 2),
    inter("NQ", "Nasdaq 100", nq, 2),
    inter("VIX", "VIX (peur)", vix, 2),
    inter("AUDJPY", "AUD/JPY", aj, 3),
    inter("EURUSD", "EUR/USD", S.fx.EURUSD, 5),
    inter("USDJPY", "USD/JPY", S.fx.USDJPY, 3),
  ];

  // --- Étape 2 : force des devises ---
  const t = n - 1;
  const change = (c: Currency, N: number) => {
    const others = CURRENCIES.filter((k) => k !== c);
    return mean(
      others.map((k) => pct(S.val[c][t] / S.val[k][t], S.val[c][t - N] / S.val[k][t - N])),
    );
  };
  const rawStrength = CURRENCIES.map((c) => {
    const w = change(c, 5), m = change(c, 21), q = change(c, 63);
    return { ccy: c, w, m, q, raw: 0.5 * w + 0.3 * m + 0.2 * q };
  });
  const lo = Math.min(...rawStrength.map((s) => s.raw));
  const hi = Math.max(...rawStrength.map((s) => s.raw));
  const strength = rawStrength
    .map((s) => ({ ...s, score: hi === lo ? 5 : ((s.raw - lo) / (hi - lo)) * 10 }))
    .sort((a, b) => b.score - a.score);
  const st = Object.fromEntries(strength.map((s) => [s.ccy, s])) as Record<Currency, (typeof strength)[number]>;

  const strongPairs = FX_PAIRS.map((pp) => {
    const gap = st[pp.base].score - st[pp.quote].score;
    const buy = gap >= 0 ? pp.base : pp.quote;
    const sell = gap >= 0 ? pp.quote : pp.base;
    return { symbol: pp.symbol, buy, sell, gap: Math.abs(gap), direction: (gap >= 0 ? "Long" : "Short") as "Long" | "Short" };
  })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  // --- Étape 4 : COT ---
  const cotList = summarizeCot(cot);
  const cotMap = Object.fromEntries(cotList.map((c) => [c.key, c]));

  // --- Étape 3 + 6 : signaux par marché ---
  const regimeTxt = regimeLabel.toLowerCase();
  const openSignal = (above: number, known: number): Signal => ({
    key: "open",
    label: "Open levels",
    value: above >= 3 ? 1 : above <= 1 ? -1 : 0,
    detail: `Au-dessus de ${above}/${known} ouvertures (semaine, mois, trimestre, année)`,
  });
  const seasonSignal = (pctUp: number | null, avg: number | null, n: number): Signal => ({
    key: "saison",
    label: "Saisonnalité",
    value: pctUp == null ? 0 : pctUp >= 65 ? 1 : pctUp <= 35 ? -1 : 0,
    detail:
      pctUp == null
        ? "Historique insuffisant"
        : `Mois en hausse ${fmt(pctUp, 0)} % du temps sur ${n} ans (moy. ${fmtSigned(avg ?? 0)} %)`,
  });

  const markets: MarketRow[] = [];

  for (const pp of FX_PAIRS) {
    const s = S.fx[pp.symbol];
    const price = last(s.closes);
    const sDiff = st[pp.base].raw - st[pp.quote].raw;
    const cb = cotMap[pp.base]?.comm3y, cq = cotMap[pp.quote]?.comm3y;
    const cotDiff = cb != null && cq != null ? cb - cq : null;
    const op = opens(s);
    const seas = seasonality(s.monthly, currentKey);
    const cm = seas[currentMonth];
    const macroVal = (RISK_BETA[pp.base] - RISK_BETA[pp.quote]) * regimeValue;
    const signals: Signal[] = [
      {
        key: "force",
        label: "Force",
        value: sign(sDiff, 0.15, -0.15),
        detail: `${pp.base} ${fmt(st[pp.base].score, 1)}/10 contre ${pp.quote} ${fmt(st[pp.quote].score, 1)}/10 (écart ${fmtSigned(sDiff)} %)`,
      },
      {
        key: "cot",
        label: "COT",
        value: cotDiff == null ? 0 : sign(cotDiff, 25, -25),
        detail:
          cotDiff == null
            ? "COT indisponible"
            : `Commerciaux 3 ans : ${pp.base} ${fmt(cb!, 0)} − ${pp.quote} ${fmt(cq!, 0)} = ${fmtSigned(cotDiff, 0)}`,
      },
      openSignal(op.above, op.known),
      seasonSignal(cm.pct, cm.avg, cm.n),
      {
        key: "macro",
        label: "Macro",
        value: sign(macroVal, 0.4, -0.4),
        detail: `Bêta ${fmtSigned(RISK_BETA[pp.base] - RISK_BETA[pp.quote], 1)} × régime ${regimeTxt} = ${fmtSigned(macroVal, 1)}`,
      },
    ];
    const total = signals.reduce((a, x) => a + x.value, 0);
    markets.push({
      symbol: pp.symbol,
      name: `${pp.base}/${pp.quote}`,
      kind: "fx",
      usd: pp.base === "USD" || pp.quote === "USD",
      base: pp.base,
      quote: pp.quote,
      price,
      dec: priceDecimals(pp.symbol),
      ch1w: pct(price, s.closes[s.closes.length - 6]),
      signals,
      total,
      bias: total > 0 ? "Long" : total < 0 ? "Short" : "Neutre",
      grade: gradeOf(total),
      nr: nrTest(s),
      opensAbove: op.above,
      opens: op.opens,
      seasonAvg: cm.avg,
      seasonPct: cm.pct,
      strengthBase: st[pp.base].score,
      strengthQuote: st[pp.quote].score,
      cotIndex: cotDiff,
      spark: s.closes.slice(-40),
    });
  }

  for (const ix of INDICES) {
    const s = S.indices[ix.symbol];
    const price = last(s.closes);
    const ci = cotMap[ix.symbol]?.comm3y ?? null;
    const op = opens(s);
    const seas = seasonality(s.monthly, currentKey);
    const cm = seas[currentMonth];
    const ma = sma(s.closes, 20);
    const signals: Signal[] = [
      {
        key: "cot",
        label: "COT",
        value: ci == null ? 0 : ci >= 70 ? 1 : ci <= 30 ? -1 : 0,
        detail: ci == null ? "COT indisponible" : `Index commerciaux 3 ans : ${fmt(ci, 0)}`,
      },
      openSignal(op.above, op.known),
      seasonSignal(cm.pct, cm.avg, cm.n),
      { key: "macro", label: "Macro", value: regimeValue, detail: `Régime ${regimeTxt}` },
      {
        key: "tendance",
        label: "Tendance",
        value: price > ma ? 1 : price < ma ? -1 : 0,
        detail: `Prix ${price > ma ? "au-dessus" : "en dessous"} de la moyenne 20 jours (${fmt(ma, 2)})`,
      },
    ];
    const total = signals.reduce((a, x) => a + x.value, 0);
    markets.push({
      symbol: ix.symbol,
      name: ix.name,
      kind: "index",
      usd: false,
      price,
      dec: 2,
      ch1w: pct(price, s.closes[s.closes.length - 6]),
      signals,
      total,
      bias: total > 0 ? "Long" : total < 0 ? "Short" : "Neutre",
      grade: gradeOf(total),
      nr: nrTest(s),
      opensAbove: op.above,
      opens: op.opens,
      seasonAvg: cm.avg,
      seasonPct: cm.pct,
      cotIndex: ci,
      spark: s.closes.slice(-40),
    });
  }

  // --- Étape 5 : saisonnalité ---
  const seasonalityList = [
    ...FX_PAIRS.map((pp) => ({ symbol: pp.symbol, kind: "fx" as const, months: seasonality(S.fx[pp.symbol].monthly, currentKey) })),
    ...INDICES.map((ix) => ({ symbol: ix.symbol, kind: "index" as const, months: seasonality(S.indices[ix.symbol].monthly, currentKey) })),
  ];

  // --- Résumé ---
  const strongest = strength[0];
  const weakest = last(strength);
  const best = [...markets]
    .filter((m) => m.grade === "A" || m.grade === "B")
    .sort(
      (a, b) =>
        Math.abs(b.total) - Math.abs(a.total) ||
        Math.abs((b.strengthBase ?? 5) - (b.strengthQuote ?? 5)) - Math.abs((a.strengthBase ?? 5) - (a.strengthQuote ?? 5)),
    )[0];
  const summary =
    `Régime ${regimeLabel} (${yes}/6 tests positifs). ` +
    `Devise la plus forte : ${strongest.ccy} (${fmt(strongest.score, 1)}), la plus faible : ${weakest.ccy} (${fmt(weakest.score, 1)}). ` +
    (best
      ? `Meilleur setup : ${best.symbol} ${best.bias} (note ${best.grade}, score ${fmtSigned(best.total, 0)}).`
      : "Aucun setup A ou B en ce moment.");

  return {
    meta: {
      mode: meta.mode,
      pricesAt: p.fetchedAt,
      cotReport: cot?.latestReport ?? null,
      cotFetchedAt: cot?.fetchedAt ?? null,
      errors: meta.errors,
      generatedAt: new Date().toISOString(),
    },
    summary,
    regime: { label: regimeLabel, value: regimeValue, yes, tests },
    intermarket,
    strength: strength.map(({ ccy, score, raw, w, m, q }) => ({ ccy, score, raw, w, m, q })),
    strongPairs,
    markets,
    cot: cotList,
    seasonality: seasonalityList,
    currentMonth,
  };
}
