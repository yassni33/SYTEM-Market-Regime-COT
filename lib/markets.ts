// Définition des marchés suivis par YASSNI.edge.

export const CURRENCIES = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

// Ordre de priorité standard pour nommer une paire (BASE avant QUOTE).
const PRIORITY: Currency[] = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"];

export type FxPair = { symbol: string; base: Currency; quote: Currency };

export const FX_PAIRS: FxPair[] = (() => {
  const out: FxPair[] = [];
  for (let i = 0; i < PRIORITY.length; i++)
    for (let j = i + 1; j < PRIORITY.length; j++)
      out.push({ symbol: PRIORITY[i] + PRIORITY[j], base: PRIORITY[i], quote: PRIORITY[j] });
  return out;
})();

// Paires USD téléchargées sur Yahoo. "inverse" = la devise est la QUOTE (USDJPY → JPY).
export const USD_PAIRS: { ccy: Exclude<Currency, "USD">; yahoo: string; inverse: boolean }[] = [
  { ccy: "EUR", yahoo: "EURUSD=X", inverse: false },
  { ccy: "GBP", yahoo: "GBPUSD=X", inverse: false },
  { ccy: "AUD", yahoo: "AUDUSD=X", inverse: false },
  { ccy: "NZD", yahoo: "NZDUSD=X", inverse: false },
  { ccy: "JPY", yahoo: "USDJPY=X", inverse: true },
  { ccy: "CAD", yahoo: "USDCAD=X", inverse: true },
  { ccy: "CHF", yahoo: "USDCHF=X", inverse: true },
];

export type IndexDef = { symbol: string; name: string; yahoo: string; cot: string };

export const INDICES: IndexDef[] = [
  { symbol: "ES", name: "S&P 500", yahoo: "ES=F", cot: "13874A" },
  { symbol: "NQ", name: "Nasdaq 100", yahoo: "NQ=F", cot: "209742" },
  { symbol: "YM", name: "Dow Jones", yahoo: "YM=F", cot: "124603" },
  { symbol: "RTY", name: "Russell 2000", yahoo: "RTY=F", cot: "239742" },
];

export const EXTRA_YAHOO = { DXY: "DX-Y.NYB", VIX: "^VIX" };

export const COT_CODES: Record<string, string> = {
  EUR: "099741",
  GBP: "096742",
  JPY: "097741",
  AUD: "232741",
  NZD: "112741",
  CAD: "090741",
  CHF: "092741",
  USD: "098662",
  ES: "13874A",
  NQ: "209742",
  YM: "124603",
  RTY: "239742",
};

export const COT_LABELS: Record<string, string> = {
  EUR: "Euro (EUR)",
  GBP: "Livre (GBP)",
  JPY: "Yen (JPY)",
  AUD: "Dollar australien (AUD)",
  NZD: "Dollar néo-zélandais (NZD)",
  CAD: "Dollar canadien (CAD)",
  CHF: "Franc suisse (CHF)",
  USD: "Dollar index (USD)",
  ES: "S&P 500 (ES)",
  NQ: "Nasdaq (NQ)",
  YM: "Dow (YM)",
  RTY: "Russell (RTY)",
};

// Bêta "risque" de chaque devise : positive = monte quand le marché est risk-on.
export const RISK_BETA: Record<Currency, number> = {
  AUD: 1,
  NZD: 1,
  CAD: 0.5,
  GBP: 0.5,
  EUR: 0.3,
  USD: -0.5,
  CHF: -0.7,
  JPY: -1,
};

export function pipSize(symbol: string): number {
  return symbol.endsWith("JPY") ? 0.01 : 0.0001;
}

export function priceDecimals(symbol: string): number {
  if (symbol.endsWith("JPY")) return 3;
  if (["ES", "NQ", "YM", "RTY", "VIX", "DXY"].includes(symbol)) return 2;
  return 5;
}

export const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const MONTHS_FR_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
