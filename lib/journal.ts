// Types, listes et statistiques du journal de trading.
import { dayKey } from "./format";

export type Account = {
  id: string;
  name: string;
  type: "prop" | "reel" | "demo";
  currency: string;
  initial_balance: number;
  created_at?: string;
};

export type Trade = {
  id: string;
  account_id: string;
  market: string;
  side: "Long" | "Short";
  opened_at: string;
  closed_at: string | null;
  lot: number | null;
  entry: number | null;
  exit: number | null;
  sl: number | null;
  tp: number | null;
  pnl: number;
  fees: number;
  setup: string | null;
  mistakes: string[];
  emotion: string | null;
  rating: number | null;
  notes: string | null;
  screenshots: string[];
};

export const ACCOUNT_TYPES: Record<Account["type"], string> = { prop: "Prop firm", reel: "Réel", demo: "Démo" };

export const MISTAKES = [
  "Entrée trop tôt",
  "Entrée tardive (FOMO)",
  "Hors plan / pas de setup",
  "SL déplacé",
  "Pas de SL",
  "Taille trop grosse",
  "Sortie trop tôt",
  "Revenge trade",
  "News ignorée",
  "Contre le biais",
];

export const EMOTIONS = ["Calme", "Confiant", "Patient", "Impatient", "Stressé", "Peur", "Euphorique", "Frustré"];

export const tradeDay = (t: Trade) => dayKey(t.closed_at ?? t.opened_at);

const clamp = (x: number) => Math.max(0, Math.min(100, isFinite(x) ? x : 0));

export type Stats = ReturnType<typeof computeStats>;

export function computeStats(trades: Trade[], initialBalance: number) {
  const sorted = [...trades].sort((a, b) => Date.parse(a.closed_at ?? a.opened_at) - Date.parse(b.closed_at ?? b.opened_at));
  const n = sorted.length;
  const wins = sorted.filter((t) => t.pnl > 0);
  const losses = sorted.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = losses.reduce((s, t) => s + t.pnl, 0);
  const net = grossWin + grossLoss + sorted.filter((t) => t.pnl === 0).reduce((s, t) => s + t.pnl, 0);
  const fees = sorted.reduce((s, t) => s + (t.fees || 0), 0);
  const winRate = n ? (wins.length / n) * 100 : 0;
  const profitFactor = grossLoss < 0 ? grossWin / -grossLoss : grossWin > 0 ? Infinity : 0;
  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const winLossRatio = avgLoss < 0 ? avgWin / -avgLoss : avgWin > 0 ? Infinity : 0;
  const expectancy = n ? net / n : 0;

  // Par jour
  const byDay = new Map<string, { pnl: number; count: number }>();
  for (const t of sorted) {
    const k = tradeDay(t);
    const d = byDay.get(k) ?? { pnl: 0, count: 0 };
    d.pnl += t.pnl;
    d.count += 1;
    byDay.set(k, d);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const winDays = days.filter(([, d]) => d.pnl > 0).length;
  const dayWinRate = days.length ? (winDays / days.length) * 100 : 0;

  // Courbe d'équité et drawdown
  let eq = initialBalance;
  let peak = initialBalance;
  let maxDD = 0;
  const equity: { label: string; value: number }[] = [{ label: sorted[0] ? tradeDay(sorted[0]) : dayKey(new Date()), value: eq }];
  for (const t of sorted) {
    eq += t.pnl;
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, peak - eq);
    equity.push({ label: tradeDay(t), value: eq });
  }
  const ddBase = initialBalance > 0 ? initialBalance : Math.max(grossWin, 1);
  const maxDDPct = (maxDD / ddBase) * 100;

  const group = (key: (t: Trade) => string | null) => {
    const m = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const t of sorted) {
      const k = key(t) || "Sans setup";
      const g = m.get(k) ?? { pnl: 0, count: 0, wins: 0 };
      g.pnl += t.pnl;
      g.count += 1;
      if (t.pnl > 0) g.wins += 1;
      m.set(k, g);
    }
    return [...m.entries()].map(([label, g]) => ({ label, ...g })).sort((a, b) => b.pnl - a.pnl);
  };

  const mistakeMap = new Map<string, { pnl: number; count: number }>();
  for (const t of sorted)
    for (const mk of t.mistakes ?? []) {
      const g = mistakeMap.get(mk) ?? { pnl: 0, count: 0 };
      g.pnl += t.pnl;
      g.count += 1;
      mistakeMap.set(mk, g);
    }
  const mistakes = [...mistakeMap.entries()].map(([label, g]) => ({ label, ...g })).sort((a, b) => a.pnl - b.pnl);

  // Edge score : 6 critères notés de 0 à 100, puis moyenne
  const bestDay = days.reduce((m, [, d]) => Math.max(m, d.pnl), 0);
  const consistency = net > 0 ? clamp(100 - ((bestDay / net) * 100 - 20) * 1.25) : 0;
  const edgeAxes = [
    { label: "% gagnants", value: clamp((winRate / 60) * 100) },
    { label: "Profit factor", value: clamp((Math.min(profitFactor, 10) / 2.5) * 100) },
    { label: "Gain/perte moy.", value: clamp((Math.min(winLossRatio, 10) / 2.5) * 100) },
    { label: "% jours gagnants", value: clamp((dayWinRate / 60) * 100) },
    { label: "Drawdown", value: n ? clamp(100 - maxDDPct * 10) : 0 },
    { label: "Régularité", value: consistency },
  ];
  const edge = n ? edgeAxes.reduce((s, a) => s + a.value, 0) / edgeAxes.length : 0;

  return {
    n,
    net,
    fees,
    wins: wins.length,
    losses: losses.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    winLossRatio,
    expectancy,
    days,
    dayWinRate,
    equity,
    maxDD,
    maxDDPct,
    byMarket: group((t) => t.market),
    bySetup: group((t) => t.setup),
    mistakes,
    edgeAxes,
    edge,
  };
}
