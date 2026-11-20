"use client";
// Petits graphiques SVG faits maison (aucune librairie) : ligne, barres, radar, sparkline.
import { useEffect, useRef, useState } from "react";

export const SERIES = ["#0D7A5F", "#3A6BC4"]; // vert sapin, bleu (validés daltonisme)
const GRID = "#E2E7EC";
const INK = "#677480";
const UP = "#12955A";
const DOWN = "#D23C48";
const MARK = "#15202B"; // repères (retraits) : encre du texte, distincte des séries et des statuts

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? step0;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

// ---------- Sparkline ----------
export function Sparkline({ data, width = 110, height = 30, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => 2 + (i / (data.length - 1)) * (width - 6);
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const c = color ?? (data[data.length - 1] >= data[0] ? UP : DOWN);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${d}L${x(data.length - 1)},${height}L${x(0)},${height}Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block" }}>
      <path d={area} fill={c} opacity={0.08} />
      <path d={d} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.5} fill={c} />
    </svg>
  );
}

type Tip = { x: number; y: number; html: React.ReactNode } | null;
function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      style={{
        position: "absolute", left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 10px))",
        background: "#15202B", color: "#fff", fontSize: 12, padding: "6px 9px", borderRadius: 6,
        pointerEvents: "none", whiteSpace: "nowrap", zIndex: 5, boxShadow: "0 4px 12px rgba(0,0,0,.15)",
      }}
    >
      {tip.html}
    </div>
  );
}

// ---------- Courbes (une ou plusieurs séries, un seul axe) ----------
export function LineChart({
  labels,
  series,
  height = 240,
  format = (v: number) => v.toLocaleString("fr-FR"),
  formatLabel = (s: string) => s,
  zeroLine = true,
  area = false,
  markers = [],
}: {
  labels: string[];
  series: { name: string; data: number[]; color: string }[];
  height?: number;
  format?: (v: number) => string;
  formatLabel?: (s: string) => string;
  zeroLine?: boolean;
  area?: boolean;
  // Petits repères posés sur la 1re série (ex. retraits sur la courbe d'équité)
  markers?: { index: number; label: string }[];
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  if (!n) return <div className="empty">Pas encore de données.</div>;
  const all = series.flatMap((s) => s.data);
  let min = Math.min(...all), max = Math.max(...all);
  if (zeroLine) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.06; min -= pad; max += pad;
  const L = 58, R = 12, T = 12, B = 26;
  const iw = w - L - R, ih = height - T - B;
  const x = (i: number) => L + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * ih;
  const ticks = niceTicks(min, max, 4);
  const xt = n <= 1 ? [0] : [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1];

  function move(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px) / iw) * (n - 1)))));
  }
  const tip: Tip =
    hover == null
      ? null
      : {
          x: x(hover),
          y: Math.min(...series.map((s) => y(s.data[hover]))),
          html: (
            <div>
              <div style={{ opacity: 0.7, marginBottom: 2 }}>{formatLabel(labels[hover])}</div>
              {series.map((s) => (
                <div key={s.name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  {series.length > 1 && <span>{s.name} :</span>}
                  <b className="num">{format(s.data[hover])}</b>
                </div>
              ))}
              {markers.filter((m) => m.index === hover).map((m, k) => (
                <div key={k} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                  <span style={{ fontSize: 9 }}>▼</span>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          ),
        };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width={w} height={height} role="img" aria-label={series.map((s) => s.name).join(", ")} style={{ display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK} className="num">{format(t)}</text>
          </g>
        ))}
        {xt.map((i) => (
          <text key={i} x={x(i)} y={height - 8} fontSize={11} fill={INK} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
            {formatLabel(labels[i])}
          </text>
        ))}
        {series.map((s) => {
          const d = s.data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
          return (
            <g key={s.name}>
              {area && <path d={`${d}L${x(n - 1)},${y(Math.max(min, 0))}L${x(0)},${y(Math.max(min, 0))}Z`} fill={s.color} opacity={0.08} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(n - 1)} cy={y(s.data[n - 1])} r={3.5} fill={s.color} stroke="#fff" strokeWidth={2} />
            </g>
          );
        })}
        {series[0] &&
          markers.map((m, k) => {
            if (m.index < 0 || m.index >= n) return null;
            const cx = x(m.index);
            const tip = Math.max(T + 8, y(series[0].data[m.index]) - 7);
            return (
              <path
                key={k}
                d={`M${cx - 5},${tip - 8}L${cx + 5},${tip - 8}L${cx},${tip}Z`}
                fill={MARK}
                stroke="#fff"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            );
          })}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke={INK} strokeWidth={1} opacity={0.4} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.data[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={L} y={T} width={iw} height={ih} fill="transparent" onPointerMove={move} onPointerLeave={() => setHover(null)} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- Barres verticales (positif vert / négatif rouge) ----------
export function BarChart({
  labels,
  data,
  height = 220,
  format = (v: number) => v.toLocaleString("fr-FR"),
  formatLabel = (s: string) => s,
}: {
  labels: string[];
  data: number[];
  height?: number;
  format?: (v: number) => string;
  formatLabel?: (s: string) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  if (!n) return <div className="empty">Pas encore de données.</div>;
  let min = Math.min(0, ...data), max = Math.max(0, ...data);
  if (min === max) max = 1;
  const L = 58, R = 8, T = 10, B = 26;
  const iw = w - L - R, ih = height - T - B;
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * ih;
  const slot = iw / n;
  const bw = Math.max(2, Math.min(28, slot - 2));
  const ticks = niceTicks(min, max, 4);
  const step = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));
  const tip: Tip =
    hover == null
      ? null
      : {
          x: L + slot * hover + slot / 2,
          y: y(Math.max(0, data[hover])),
          html: (
            <div>
              <div style={{ opacity: 0.7 }}>{formatLabel(labels[hover])}</div>
              <b className="num">{format(data[hover])}</b>
            </div>
          ),
        };
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg width={w} height={height} role="img" aria-label="Graphique en barres" style={{ display: "block" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t === 0 ? undefined : "3 3"} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK} className="num">{format(t)}</text>
          </g>
        ))}
        {data.map((v, i) => {
          const x0 = L + slot * i + (slot - bw) / 2;
          const top = y(Math.max(0, v)), bot = y(Math.min(0, v));
          const h = Math.max(1, bot - top);
          const r = Math.min(4, bw / 2, h);
          // Bout arrondi côté valeur, base carrée sur la ligne zéro
          const d =
            v >= 0
              ? `M${x0},${bot}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${bot}Z`
              : `M${x0},${top}V${bot - r}Q${x0},${bot} ${x0 + r},${bot}H${x0 + bw - r}Q${x0 + bw},${bot} ${x0 + bw},${bot - r}V${top}Z`;
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={L + slot * i} y={T} width={slot} height={ih} fill="transparent" />
              <path d={d} fill={v >= 0 ? UP : DOWN} opacity={hover == null || hover === i ? 1 : 0.55} />
            </g>
          );
        })}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={i} x={L + slot * i + slot / 2} y={height - 8} fontSize={11} fill={INK} textAnchor="middle">
              {formatLabel(l)}
            </text>
          ) : null,
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- Barres horizontales (classements) ----------
export function HBars({
  rows,
  format = (v: number) => v.toLocaleString("fr-FR"),
}: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (v: number) => string;
}) {
  if (!rows.length) return <div className="empty">Pas encore de données.</div>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  const hasNeg = rows.some((r) => r.value < 0);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r) => {
        const pctW = (Math.abs(r.value) / max) * (hasNeg ? 50 : 100);
        return (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "minmax(70px, 120px) minmax(0, 1fr) 90px", gap: 10, alignItems: "center" }} title={r.sub}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <div style={{ position: "relative", height: 10, background: "var(--neutral-soft)", borderRadius: 4 }}>
              {hasNeg && <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--line-strong)" }} />}
              <div
                style={{
                  position: "absolute", top: 0, bottom: 0, borderRadius: 4,
                  background: r.value >= 0 ? UP : DOWN,
                  left: hasNeg ? (r.value >= 0 ? "50%" : `${50 - pctW}%`) : 0,
                  width: `${pctW}%`,
                }}
              />
            </div>
            <span className={`num ${r.value > 0 ? "up" : r.value < 0 ? "down" : ""}`} style={{ textAlign: "right" }}>{format(r.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Radar (Edge score) ----------
export function Radar({ axes, size = 260 }: { axes: { label: string; value: number }[]; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  const poly = axes.map((a, i) => pt(i, Math.max(0, Math.min(100, a.value))).join(",")).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, display: "block", margin: "0 auto" }} role="img" aria-label="Radar du Edge score">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={axes.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke={GRID} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={GRID} />;
      })}
      <polygon points={poly} fill={SERIES[0]} fillOpacity={0.18} stroke={SERIES[0]} strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, Math.max(0, Math.min(100, a.value)));
        return <circle key={i} cx={x} cy={y} r={3.5} fill={SERIES[0]} stroke="#fff" strokeWidth={1.5}><title>{`${a.label} : ${Math.round(a.value)}/100`}</title></circle>;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 122);
        return (
          <text key={a.label} x={x} y={y} fontSize={10.5} fill={INK} textAnchor={Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end"} dominantBaseline="middle">
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// Barre 0-100 colorée selon des seuils (index COT, % saisonnier…)
export function ScoreBar({ value, hi = 70, lo = 30, max = 100 }: { value: number | null | undefined; hi?: number; lo?: number; max?: number }) {
  if (value == null || !isFinite(value)) return <span className="faint">—</span>;
  const cls = value >= hi ? "up" : value <= lo ? "down" : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
      <div className={`meter ${cls}`} style={{ flex: 1 }}>
        <i style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      <span className="num" style={{ width: 30, textAlign: "right" }}>{Math.round(value)}</span>
    </div>
  );
}
