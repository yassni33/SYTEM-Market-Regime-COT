"use client";
import { useCallback, useEffect, useState } from "react";
import type { Analysis, MarketRow } from "@/lib/analysis";
import { ageText, dateFr, num, pct, signed } from "@/lib/format";
import { Sparkline } from "@/components/charts";
import { CotSection, SeasonSection, Watchlist } from "./Sections";
import { BiasTag, SignalDot, Step } from "./ui";

export default function MarketPage() {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Erreur ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const m = data?.meta;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Market Regime & COT</h1>
          <p>Le biais de la semaine : quels marchés regarder à l’achat ou à la vente, et pourquoi.</p>
        </div>
        <div className="row">
          {m && (
            <span className={`pill ${m.mode === "live" ? "pill-live" : "pill-snap"}`} title={m.mode === "live" ? "Prix de moins de 4 h" : "Dernières données enregistrées dans le cloud"}>
              <span className="dot" />
              {m.mode === "live" ? "Live" : "Snapshot"}
            </span>
          )}
          {m && (
            <span className="small muted">
              Prix : {new Date(m.pricesAt!).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })} ({ageText(m.pricesAt)}) · COT du {dateFr(m.cotReport)}
            </span>
          )}
          <button className="btn" onClick={() => load(true)} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={loading ? { animation: "spin 1s linear infinite" } : undefined}>
              <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {loading ? "Mise à jour…" : "Refresh"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {error && <div className="notice err">{error}</div>}
      {m?.errors?.length ? (
        <div className="notice">
          <span>
            {m.errors.join(" · ")}
            {m.mode === "snapshot" && " Les données affichées sont les dernières enregistrées."}
          </span>
        </div>
      ) : null}

      {!data && loading && <LoadingState />}

      {data && (
        <>
          <div className="card" style={{ borderLeft: "4px solid var(--accent)" }}>
            <div className="card-b" style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <RegimeBadge label={data.regime.label} />
              <p style={{ flex: "1 1 320px", fontSize: 15, lineHeight: 1.55 }}>{data.summary}</p>
            </div>
          </div>

          <RegimeSection a={data} />
          <StrengthSection a={data} />
          <SetupsSection a={data} />
          <CotSection a={data} />
          <SeasonSection a={data} />
          <Watchlist a={data} />

          <p className="small muted" style={{ textAlign: "center", maxWidth: 640, margin: "8px auto 0" }}>
            Ces notes sont un filtre pour ton analyse, pas un signal pour trader à l’aveugle. Vérifie toujours ton plan
            (structure, niveaux, news) avant d’entrer.
          </p>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="stack">
      <div className="card card-b"><div className="skeleton" style={{ height: 40 }} /></div>
      <div className="grid g2">
        <div className="card card-b"><div className="skeleton" style={{ height: 220 }} /></div>
        <div className="card card-b"><div className="skeleton" style={{ height: 220 }} /></div>
      </div>
      <p className="muted small" style={{ textAlign: "center" }}>Chargement des prix Yahoo et du rapport COT…</p>
    </div>
  );
}

function RegimeBadge({ label }: { label: string }) {
  const cls = label === "RISK-ON" ? "tag-up" : label === "RISK-OFF" ? "tag-down" : "tag-warn";
  return (
    <span className={`tag ${cls}`} style={{ fontSize: 13, padding: "5px 10px", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
      {label}
    </span>
  );
}

// ---------- Étape 1 ----------
function RegimeSection({ a }: { a: Analysis }) {
  const r = a.regime;
  return (
    <section className="card">
      <Step n={1} title="Régime de marché" sub="6 tests : 4 « oui » ou plus = risk-on, 2 ou moins = risk-off, sinon mixte." right={<RegimeBadge label={r.label} />} />
      <div className="grid g2" style={{ gap: 0 }}>
        <div className="card-b" style={{ borderRight: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span className="num" style={{ fontSize: 28, fontWeight: 600 }}>{r.yes}</span>
            <span className="muted">/ 6 tests positifs</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {r.tests.map((t) => (
              <div key={t.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  className={`tag ${t.ok ? "tag-up" : "tag-down"}`}
                  style={{ width: 38, justifyContent: "center", flex: "none" }}
                >
                  {t.ok ? "OUI" : "NON"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div>{t.label}</div>
                  <div className="small muted num">{t.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Intermarché</th>
                <th className="r">Dernier</th>
                <th className="r">5 j</th>
                <th className="r">20 j</th>
                <th>40 jours</th>
              </tr>
            </thead>
            <tbody>
              {a.intermarket.map((x) => (
                <tr key={x.symbol}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{x.name}</div>
                  </td>
                  <td className="r num">{num(x.last, x.dec)}</td>
                  <td className={`r num ${x.ch5 > 0 ? "up" : "down"}`}>{pct(x.ch5)}</td>
                  <td className={`r num ${x.ch20 > 0 ? "up" : "down"}`}>{pct(x.ch20)}</td>
                  <td><Sparkline data={x.spark} width={96} height={26} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------- Étape 2 ----------
function StrengthSection({ a }: { a: Analysis }) {
  return (
    <section className="card">
      <Step n={2} title="Force des devises" sub="Variation moyenne contre les 7 autres devises : 50 % × 1 semaine + 30 % × 1 mois + 20 % × 3 mois, ramenée de 0 à 10." />
      <div className="grid g2" style={{ gap: 0 }}>
        <div className="card-b stack" style={{ gap: 10, borderRight: "1px solid var(--line)" }}>
          {a.strength.map((s) => {
            const cls = s.score >= 6.5 ? "up" : s.score <= 3.5 ? "down" : "";
            return (
              <div
                key={s.ccy}
                style={{ display: "grid", gridTemplateColumns: "42px minmax(0,1fr) 40px", gap: 10, alignItems: "center" }}
                title={`1 sem. ${pct(s.w)} · 1 mois ${pct(s.m)} · 3 mois ${pct(s.q)}`}
              >
                <b className="mono">{s.ccy}</b>
                <div className={`meter ${cls}`} style={{ height: 12 }}>
                  <i style={{ width: `${Math.max(2, s.score * 10)}%` }} />
                </div>
                <span className={`num ${cls}`} style={{ textAlign: "right", fontWeight: 600 }}>{num(s.score, 1)}</span>
              </div>
            );
          })}
          <div className="tbl-wrap" style={{ marginTop: 6 }}>
            <table className="tbl small">
              <thead>
                <tr><th>Devise</th><th className="r">1 sem.</th><th className="r">1 mois</th><th className="r">3 mois</th></tr>
              </thead>
              <tbody>
                {a.strength.map((s) => (
                  <tr key={s.ccy}>
                    <td className="mono">{s.ccy}</td>
                    <td className={`r num ${s.w > 0 ? "up" : "down"}`}>{pct(s.w)}</td>
                    <td className={`r num ${s.m > 0 ? "up" : "down"}`}>{pct(s.m)}</td>
                    <td className={`r num ${s.q > 0 ? "up" : "down"}`}>{pct(s.q)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-b">
          <div className="label" style={{ marginBottom: 10 }}>Les 8 plus grands écarts de force</div>
          <div className="stack" style={{ gap: 8 }}>
            {a.strongPairs.map((p, i) => (
              <div
                key={p.symbol}
                style={{
                  display: "grid", gridTemplateColumns: "20px minmax(0,1fr) auto", gap: 10, alignItems: "center",
                  padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8,
                }}
              >
                <span className="num faint">{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div>
                    <b className="mono">{p.symbol}</b> <BiasTag bias={p.direction} />
                  </div>
                  <div className="small muted">
                    Acheter <b className="up">{p.buy}</b> / vendre <b className="down">{p.sell}</b>
                  </div>
                </div>
                <span className="num" style={{ fontWeight: 600 }}>{num(p.gap, 1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Étape 3 ----------
function SetupsSection({ a }: { a: Analysis }) {
  const setups = a.markets
    .filter((m) => m.grade === "A" || m.grade === "B")
    .sort((x, y) => Math.abs(y.total) - Math.abs(x.total) || x.symbol.localeCompare(y.symbol));
  const nC = a.markets.filter((m) => m.grade === "C").length;
  return (
    <section className="card">
      <Step
        n={3}
        title="Meilleurs setups de la semaine"
        sub="5 signaux par marché (+1, 0, −1). Note A = 4 ou 5 signaux alignés, B = 3, C = 2. NR4/NR7 = indication en plus, hors score."
        right={<span className="small muted">{setups.length} setups A/B · {nC} en C (voir la watchlist)</span>}
      />
      <div className="card-b">
        {setups.length === 0 ? (
          <div className="empty">Aucun marché n’a 3 signaux alignés ou plus en ce moment. Patience : pas de setup, pas de trade.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))" }}>
            {setups.map((m) => <SetupCard key={m.symbol} m={m} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function SetupCard({ m }: { m: MarketRow }) {
  const long = m.bias === "Long";
  return (
    <article style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", background: long ? "var(--up-soft)" : "var(--down-soft)" }}>
        <span className={`grade grade-${m.grade}`}>{m.grade}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }} className="mono">{m.symbol}</div>
          <div className="small muted">{m.kind === "fx" ? "Forex" : m.name}</div>
        </div>
        {m.nr && <span className="tag tag-accent" title="Dernier jour complet au plus petit range : compression, mouvement possible">{m.nr}</span>}
        <span className={`tag ${long ? "tag-up" : "tag-down"}`} style={{ fontSize: 12, padding: "3px 9px" }}>{m.bias}</span>
      </div>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <div>
            <div className="num" style={{ fontSize: 18, fontWeight: 600 }}>{num(m.price, m.dec)}</div>
            <div className={`small num ${m.ch1w > 0 ? "up" : "down"}`}>{pct(m.ch1w)} sur 1 semaine</div>
          </div>
          <Sparkline data={m.spark} width={100} height={32} />
        </div>
        {m.kind === "fx" ? (
          <div className="stack" style={{ gap: 4 }}>
            <div className="small muted">Force {m.base} contre {m.quote}</div>
            <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 30px", gap: 8, alignItems: "center" }}>
              <span className="mono small">{m.base}</span>
              <div className="meter up"><i style={{ width: `${(m.strengthBase ?? 0) * 10}%` }} /></div>
              <span className="num small">{num(m.strengthBase, 1)}</span>
              <span className="mono small">{m.quote}</span>
              <div className="meter down"><i style={{ width: `${(m.strengthQuote ?? 0) * 10}%` }} /></div>
              <span className="num small">{num(m.strengthQuote, 1)}</span>
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            <div className="small muted">Index COT commerciaux (3 ans)</div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 30px", gap: 8, alignItems: "center" }}>
              <div className={`meter ${(m.cotIndex ?? 50) >= 70 ? "up" : (m.cotIndex ?? 50) <= 30 ? "down" : ""}`}>
                <i style={{ width: `${m.cotIndex ?? 0}%` }} />
              </div>
              <span className="num small">{num(m.cotIndex, 0)}</span>
            </div>
          </div>
        )}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {m.signals.map((s) => (
            <li key={s.key} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr) 22px", gap: 8, alignItems: "start" }}>
              <SignalDot s={s} />
              <div style={{ minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 500 }}>{s.label}</div>
                <div className="small muted" style={{ whiteSpace: "normal" }}>{s.detail}</div>
              </div>
              <span className={`num small ${s.value > 0 ? "up" : s.value < 0 ? "down" : "faint"}`} style={{ textAlign: "right" }}>
                {signed(s.value, 0) === "0" ? "0" : signed(s.value, 0)}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}>
          <span className="muted small">Score total</span>
          <b className={`num ${m.total > 0 ? "up" : "down"}`}>{signed(m.total, 0)} / 5</b>
        </div>
      </div>
    </article>
  );
}
