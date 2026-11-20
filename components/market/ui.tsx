"use client";
import type { Signal } from "@/lib/analysis";

export function Step({ n, title, sub, right }: { n: number; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="card-h">
      <div>
        <h2 className="step"><span className="step-n">{n}</span>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// Short code shown in each signal square (Strength and Seasonality both start with "S").
const CODES: Record<string, string> = { force: "St", cot: "C", open: "O", saison: "Se", macro: "M", tendance: "T" };

export function SignalDot({ s, withLabel = false }: { s: Signal; withLabel?: boolean }) {
  const bg = s.value > 0 ? "var(--up)" : s.value < 0 ? "var(--down)" : "var(--line-strong)";
  const sym = s.value > 0 ? "+" : s.value < 0 ? "−" : "0";
  return (
    <span title={`${s.label}: ${sym}1 · ${s.detail}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          minWidth: 16, height: 16, padding: "0 3px", borderRadius: 4, background: bg, color: s.value ? "var(--on-status)" : "var(--muted)",
          display: "inline-grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
        }}
        aria-label={`${s.label} ${sym}`}
      >
        {CODES[s.key] ?? s.label[0]}
      </span>
      {withLabel && <span className="small muted">{s.label}</span>}
    </span>
  );
}

export function BiasTag({ bias }: { bias: string }) {
  return <span className={`tag ${bias === "Long" ? "tag-up" : bias === "Short" ? "tag-down" : ""}`}>{bias}</span>;
}
