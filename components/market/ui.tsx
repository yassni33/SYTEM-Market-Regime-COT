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

export function SignalDot({ s, withLabel = false }: { s: Signal; withLabel?: boolean }) {
  const bg = s.value > 0 ? "var(--up)" : s.value < 0 ? "var(--down)" : "var(--line-strong)";
  const sym = s.value > 0 ? "+" : s.value < 0 ? "−" : "0";
  return (
    <span title={`${s.label} : ${sym}1 · ${s.detail}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 16, height: 16, borderRadius: 4, background: bg, color: s.value ? "#fff" : "var(--muted)",
          display: "inline-grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
        }}
        aria-label={`${s.label} ${sym}`}
      >
        {s.label[0]}
      </span>
      {withLabel && <span className="small muted">{s.label}</span>}
    </span>
  );
}

export function BiasTag({ bias }: { bias: string }) {
  return <span className={`tag ${bias === "Long" ? "tag-up" : bias === "Short" ? "tag-down" : ""}`}>{bias}</span>;
}
