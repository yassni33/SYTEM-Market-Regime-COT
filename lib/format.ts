// Formats en français (virgule décimale, espace pour les milliers).

export function num(x: number | null | undefined, d = 2): string {
  if (x == null || !isFinite(x)) return "—";
  return x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function signed(x: number | null | undefined, d = 2): string {
  if (x == null || !isFinite(x)) return "—";
  return (x > 0 ? "+" : "") + num(x, d);
}

export function pct(x: number | null | undefined, d = 2): string {
  if (x == null || !isFinite(x)) return "—";
  return signed(x, d) + " %";
}

export function money(x: number | null | undefined, ccy = "USD", d = 2): string {
  if (x == null || !isFinite(x)) return "—";
  try {
    return x.toLocaleString("fr-FR", { style: "currency", currency: ccy, minimumFractionDigits: d, maximumFractionDigits: d });
  } catch {
    return num(x, d) + " " + ccy;
  }
}

export function signedMoney(x: number, ccy = "USD", d = 2): string {
  return (x > 0 ? "+" : "") + money(x, ccy, d);
}

export function compact(x: number): string {
  const a = Math.abs(x);
  if (a >= 1e6) return num(x / 1e6, 2) + " M";
  if (a >= 1e3) return num(x / 1e3, 1) + " k";
  return num(x, 0);
}

export function tone(x: number | null | undefined): "up" | "down" | "" {
  if (x == null || !isFinite(x) || x === 0) return "";
  return x > 0 ? "up" : "down";
}

export function dateFr(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("fr-FR", opts);
}

export function timeFr(iso: string | null | undefined, tz?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
}

export function ageText(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "à l’instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} jours`;
}

// Date locale AAAA-MM-JJ (fuseau du navigateur)
export function dayKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
