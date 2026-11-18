"use client";
import { useMemo, useState } from "react";
import { AccountSelect } from "@/components/journal/AccountBar";
import TradeForm from "@/components/journal/TradeForm";
import { useJournal } from "@/components/journal/useJournal";
import { BarChart, HBars, LineChart, Radar, SERIES } from "@/components/charts";
import { computeStats } from "@/lib/journal";
import { compact, dateFr, money, num, signedMoney } from "@/lib/format";

export default function JournalDashboard() {
  const j = useJournal();
  const [adding, setAdding] = useState(false);
  const s = useMemo(() => computeStats(j.filtered, j.initialBalance), [j.filtered, j.initialBalance]);
  const ccy = j.currency;
  const setups = [...new Set(j.trades.map((t) => t.setup).filter(Boolean) as string[])];
  const lastDays = s.days.slice(-30);

  const kpis: { label: string; value: string; tone?: string; sub?: string }[] = [
    { label: "P&L net", value: signedMoney(s.net, ccy), tone: s.net >= 0 ? "up" : "down", sub: `${s.n} trades · frais ${money(s.fees, ccy)}` },
    { label: "% gagnants", value: `${num(s.winRate, 1)} %`, sub: `${s.wins} gagnants / ${s.losses} perdants` },
    { label: "Profit factor", value: isFinite(s.profitFactor) ? num(s.profitFactor, 2) : "∞", tone: s.profitFactor >= 1 ? "up" : "down" },
    { label: "% jours gagnants", value: `${num(s.dayWinRate, 1)} %`, sub: `${s.days.length} jours tradés` },
    { label: "Gain moyen / perte moyenne", value: isFinite(s.winLossRatio) ? num(s.winLossRatio, 2) : "∞", sub: `${money(s.avgWin, ccy)} / ${money(s.avgLoss, ccy)}` },
    { label: "Espérance par trade", value: signedMoney(s.expectancy, ccy), tone: s.expectancy >= 0 ? "up" : "down" },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Journal · Dashboard</h1>
          <p>Tes statistiques de trading, par compte ou tous comptes confondus.</p>
        </div>
        <div className="row">
          <AccountSelect j={j} />
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Ajouter un trade</button>
        </div>
      </div>

      {j.error && <div className="notice err">{j.error}</div>}
      {!j.loading && j.accounts.length === 0 && (
        <div className="notice ok">Bienvenue ! Commence par créer un compte (bouton « Comptes »), puis ajoute ton premier trade.</div>
      )}

      <div className="grid g3">
        {kpis.map((k) => (
          <div key={k.label} className="card card-b">
            <div className="label">{k.label}</div>
            <div className={`num ${k.tone ?? ""}`} style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{j.loading ? "…" : k.value}</div>
            {k.sub && <div className="small muted">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid g12">
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Edge score</h2>
              <p>Moyenne de 6 critères notés sur 100.</p>
            </div>
            <span className="num" style={{ fontSize: 28, fontWeight: 600, color: s.edge >= 60 ? "var(--up)" : s.edge >= 40 ? "var(--warn)" : "var(--down)" }}>
              {num(s.edge, 0)}<span className="muted" style={{ fontSize: 14 }}> /100</span>
            </span>
          </div>
          <div className="card-b">
            <Radar axes={s.edgeAxes} />
            <div className="grid g2 small" style={{ gap: 4, marginTop: 8 }}>
              {s.edgeAxes.map((a) => (
                <div key={a.label} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">{a.label}</span>
                  <span className="num">{num(a.value, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Courbe d’équité</h2>
              <p>Solde après chaque trade · drawdown max {money(s.maxDD, ccy)} ({num(s.maxDDPct, 1)} %)</p>
            </div>
          </div>
          <div className="card-b">
            <LineChart
              labels={s.equity.map((e) => e.label)}
              series={[{ name: "Solde", data: s.equity.map((e) => e.value), color: SERIES[0] }]}
              format={(v) => compact(v)}
              formatLabel={(d) => dateFr(d, { day: "numeric", month: "short" })}
              zeroLine={false}
              area
              height={280}
            />
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><div><h2>P&L par jour</h2><p>30 derniers jours tradés</p></div></div>
        <div className="card-b">
          <BarChart
            labels={lastDays.map(([d]) => d)}
            data={lastDays.map(([, d]) => d.pnl)}
            format={(v) => compact(v)}
            formatLabel={(d) => dateFr(d, { day: "numeric", month: "short" })}
          />
        </div>
      </section>

      <div className="grid g3">
        <section className="card">
          <div className="card-h"><h2>P&L par marché</h2></div>
          <div className="card-b"><HBars rows={s.byMarket.slice(0, 10).map((g) => ({ label: g.label, value: g.pnl, sub: `${g.count} trades` }))} format={(v) => compact(v)} /></div>
        </section>
        <section className="card">
          <div className="card-h"><h2>P&L par setup</h2></div>
          <div className="card-b"><HBars rows={s.bySetup.slice(0, 10).map((g) => ({ label: g.label, value: g.pnl, sub: `${g.count} trades, ${num((g.wins / g.count) * 100, 0)} % gagnants` }))} format={(v) => compact(v)} /></div>
        </section>
        <section className="card">
          <div className="card-h"><div><h2>Coût des erreurs</h2><p>P&L total des trades avec cette erreur</p></div></div>
          <div className="card-b">
            {s.mistakes.length ? (
              <HBars rows={s.mistakes.map((g) => ({ label: g.label, value: g.pnl, sub: `${g.count} trades` }))} format={(v) => compact(v)} />
            ) : (
              <div className="empty">Aucune erreur notée. Coche-les dans tes trades pour voir ce qu’elles te coûtent.</div>
            )}
          </div>
        </section>
      </div>

      {adding && (
        <TradeForm
          accounts={j.accounts}
          defaultAccountId={j.accountId}
          setups={setups}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            j.reload();
          }}
        />
      )}
    </div>
  );
}
