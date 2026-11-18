"use client";
import { useMemo, useState } from "react";
import type { Analysis, MarketRow } from "@/lib/analysis";
import { MONTHS_FR } from "@/lib/markets";
import { compact, dateFr, num, pct, signed } from "@/lib/format";
import { LineChart, ScoreBar, SERIES } from "@/components/charts";
import { BiasTag, SignalDot, Step } from "./ui";

// ---------- Étape 4 : COT ----------
export function CotSection({ a }: { a: Analysis }) {
  const [sel, setSel] = useState(a.cot[0]?.key ?? "EUR");
  const cur = a.cot.find((c) => c.key === sel);
  if (!a.cot.length)
    return (
      <section className="card">
        <Step n={4} title="Index COT" />
        <div className="empty">Rapport COT indisponible pour le moment.</div>
      </section>
    );
  return (
    <section className="card">
      <Step
        n={4}
        title="Index COT"
        sub="Index = (net actuel − plus bas) / (plus haut − plus bas) × 100. Commerciaux ≥ 70 = acheteurs extrêmes, ≤ 30 = vendeurs extrêmes."
        right={<span className="small muted">Rapport CFTC du {dateFr(a.meta.cotReport)}</span>}
      />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Marché</th>
              <th>Commerciaux 3 ans</th>
              <th className="r">Comm. 6 mois</th>
              <th className="r">Spéc. 3 ans</th>
              <th className="r">Net spéculateurs</th>
              <th className="r">Variation semaine</th>
            </tr>
          </thead>
          <tbody>
            {a.cot.map((c) => (
              <tr key={c.key} onClick={() => setSel(c.key)} style={{ cursor: "pointer" }} aria-selected={c.key === sel}>
                <td style={{ fontWeight: c.key === sel ? 600 : 400 }}>
                  {c.key === sel && <span style={{ color: "var(--accent)" }}>● </span>}
                  {c.label}
                </td>
                <td style={{ minWidth: 160 }}><ScoreBar value={c.comm3y} /></td>
                <td className={`r num ${(c.comm6m ?? 50) >= 70 ? "up" : (c.comm6m ?? 50) <= 30 ? "down" : ""}`}>{num(c.comm6m, 0)}</td>
                <td className="r num">{num(c.spec3y, 0)}</td>
                <td className={`r num ${c.specNet > 0 ? "up" : "down"}`}>{signed(c.specNet, 0)}</td>
                <td className={`r num ${c.specChange > 0 ? "up" : c.specChange < 0 ? "down" : ""}`}>{signed(c.specChange, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cur && (
        <div className="card-b" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h3>Positions nettes sur 52 semaines</h3>
              <div className="row small muted" style={{ marginTop: 4, gap: 14 }}>
                <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 3, background: SERIES[0], borderRadius: 2 }} />Commerciaux</span>
                <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 3, background: SERIES[1], borderRadius: 2 }} />Grands spéculateurs</span>
              </div>
            </div>
            <select id="cot-market" className="input" style={{ width: "auto" }} value={sel} onChange={(e) => setSel(e.target.value)}>
              {a.cot.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <LineChart
            labels={cur.history.map((h) => h.d)}
            series={[
              { name: "Commerciaux", data: cur.history.map((h) => h.comm), color: SERIES[0] },
              { name: "Grands spéculateurs", data: cur.history.map((h) => h.spec), color: SERIES[1] },
            ]}
            format={(v) => compact(v)}
            formatLabel={(d) => dateFr(d, { day: "numeric", month: "short", year: "2-digit" })}
            height={260}
          />
        </div>
      )}
    </section>
  );
}

// ---------- Étape 5 : saisonnalité ----------
function heatColor(p: number | null) {
  if (p == null) return { bg: "transparent", fg: "var(--faint)" };
  if (p >= 80) return { bg: "#12955A", fg: "#fff" };
  if (p >= 65) return { bg: "#BFE5D0", fg: "#0B5E39" };
  if (p <= 20) return { bg: "#D23C48", fg: "#fff" };
  if (p <= 35) return { bg: "#F5C9CD", fg: "#8E1F29" };
  return { bg: "var(--neutral-soft)", fg: "var(--muted)" };
}

export function SeasonSection({ a }: { a: Analysis }) {
  const [kind, setKind] = useState<"fx" | "index">("fx");
  const rows = a.seasonality.filter((s) => s.kind === kind);
  return (
    <section className="card">
      <Step
        n={5}
        title="Saisonnalité"
        sub="% des 10 dernières années où le mois a fini en hausse. Survole une case pour la variation moyenne."
        right={
          <div className="seg" role="group" aria-label="Filtre">
            <button className={kind === "fx" ? "on" : ""} onClick={() => setKind("fx")}>Forex</button>
            <button className={kind === "index" ? "on" : ""} onClick={() => setKind("index")}>Indices</button>
          </div>
        }
      />
      <div className="tbl-wrap">
        <table className="tbl" style={{ borderCollapse: "separate", borderSpacing: 2 }}>
          <thead>
            <tr>
              <th style={{ position: "sticky", left: 0 }}>Marché</th>
              {MONTHS_FR.map((mo, i) => (
                <th key={mo} className="c" style={i === a.currentMonth ? { color: "var(--accent)", fontWeight: 700 } : undefined}>{mo}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol}>
                <td className="mono" style={{ position: "sticky", left: 0, background: "var(--card)", fontWeight: 500, borderBottom: 0, padding: "4px 10px" }}>{r.symbol}</td>
                {r.months.map((m, i) => {
                  const c = heatColor(m.pct);
                  const cur = i === a.currentMonth;
                  return (
                    <td
                      key={i}
                      className="c num"
                      title={m.pct == null ? "Pas assez d’historique" : `${r.symbol} en ${MONTHS_FR[i]} : hausse ${num(m.pct, 0)} % du temps sur ${m.n} ans, variation moyenne ${pct(m.avg)}`}
                      style={{
                        background: c.bg, color: c.fg, padding: "5px 4px", minWidth: 44, borderRadius: 4, borderBottom: 0, fontSize: 12,
                        outline: cur ? "2px solid var(--text)" : undefined, outlineOffset: cur ? -2 : undefined,
                      }}
                    >
                      {m.pct == null ? "—" : num(m.pct, 0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b row small muted" style={{ gap: 14, borderTop: "1px solid var(--line)" }}>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, background: "#12955A", borderRadius: 3 }} />≥ 80 %</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, background: "#BFE5D0", borderRadius: 3 }} />≥ 65 % (haussier)</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, background: "#F5C9CD", borderRadius: 3 }} />≤ 35 % (baissier)</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, background: "#D23C48", borderRadius: 3 }} />≤ 20 %</span>
        <span>Case encadrée = mois en cours</span>
      </div>
    </section>
  );
}

// ---------- Étape 6 : watchlist ----------
type Filter = "all" | "fx" | "index" | "ab" | "usd";
type SortKey = "symbol" | "total" | "ch1w" | "opensAbove" | "seasonAvg" | "price" | "grade";

export function Watchlist({ a }: { a: Analysis }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "total", dir: -1 });

  const rows = useMemo(() => {
    const f = a.markets.filter((m) =>
      filter === "all" ? true
        : filter === "fx" ? m.kind === "fx"
        : filter === "index" ? m.kind === "index"
        : filter === "ab" ? m.grade === "A" || m.grade === "B"
        : m.usd,
    );
    const val = (m: MarketRow): number | string => {
      switch (sort.key) {
        case "symbol": return m.symbol;
        case "total": return Math.abs(m.total) * 10 + (m.total > 0 ? 0.5 : 0);
        case "grade": return m.grade ? 4 - "ABC".indexOf(m.grade) : 0;
        case "seasonAvg": return m.seasonAvg ?? -999;
        default: return m[sort.key] as number;
      }
    };
    return [...f].sort((x, y) => {
      const a1 = val(x), b1 = val(y);
      return (a1 < b1 ? -1 : a1 > b1 ? 1 : 0) * sort.dir;
    });
  }, [a.markets, filter, sort]);

  const th = (key: SortKey, label: string, cls = "") => (
    <th
      className={`sortable ${cls}`}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "symbol" ? 1 : -1 }))}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
    </th>
  );

  const FILTERS: [Filter, string][] = [["all", "Tout"], ["fx", "Forex"], ["index", "Indices"], ["ab", "A/B seulement"], ["usd", "Paires USD"]];
  return (
    <section className="card">
      <Step
        n={6}
        title="Watchlist complète"
        sub="Clique sur un en-tête pour trier. Points : F force · C COT · O open levels · S saisonnalité · M macro · T tendance."
        right={
          <div className="row">
            {FILTERS.map(([k, l]) => (
              <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        }
      />
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {th("symbol", "Marché")}
              <th>Biais</th>
              {th("grade", "Note", "c")}
              {th("total", "Score", "r")}
              <th>Signaux</th>
              <th className="c">NR</th>
              {th("opensAbove", "Open ↑", "c")}
              {th("seasonAvg", "Moy. mois", "r")}
              {th("ch1w", "1 sem.", "r")}
              {th("price", "Prix", "r")}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.symbol}>
                <td className="mono" style={{ fontWeight: 600 }}>{m.symbol}</td>
                <td><BiasTag bias={m.bias} /></td>
                <td className="c">{m.grade ? <span className={`grade grade-${m.grade}`}>{m.grade}</span> : <span className="faint">—</span>}</td>
                <td className={`r num ${m.total > 0 ? "up" : m.total < 0 ? "down" : ""}`} style={{ fontWeight: 600 }}>{signed(m.total, 0)}</td>
                <td><span style={{ display: "inline-flex", gap: 3 }}>{m.signals.map((s) => <SignalDot key={s.key} s={s} />)}</span></td>
                <td className="c">{m.nr ? <span className="tag tag-accent">{m.nr}</span> : <span className="faint">—</span>}</td>
                <td className="c num">{m.opensAbove}/4</td>
                <td className={`r num ${(m.seasonAvg ?? 0) > 0 ? "up" : (m.seasonAvg ?? 0) < 0 ? "down" : ""}`}>{pct(m.seasonAvg)}</td>
                <td className={`r num ${m.ch1w > 0 ? "up" : "down"}`}>{pct(m.ch1w)}</td>
                <td className="r num">{num(m.price, m.dec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <div className="empty">Aucun marché pour ce filtre.</div>}
      </div>
    </section>
  );
}
