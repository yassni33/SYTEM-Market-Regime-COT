"use client";
import { useEffect, useMemo, useState } from "react";
import { AccountSelect } from "@/components/journal/AccountBar";
import Movements from "@/components/journal/Movements";
import TradeForm from "@/components/journal/TradeForm";
import TransactionForm from "@/components/journal/TransactionForm";
import { useJournal } from "@/components/journal/useJournal";
import { BarChart, HBars, LineChart, Radar, SERIES } from "@/components/charts";
import { computeCashflow, computeStats, isOutflow, mistakeLabel, TX_TYPES, type Transaction } from "@/lib/journal";
import { compact, dateFr, money, num, pct, signedMoney } from "@/lib/format";

type Tab = "dashboard" | "mouvements";

export default function JournalDashboard() {
  const j = useJournal();
  const [adding, setAdding] = useState(false);
  const [txForm, setTxForm] = useState<Transaction | "new" | null>(null);
  const [tab, setTabState] = useState<Tab>("dashboard");
  // Les stats ne voient que les trades : les retraits et dépôts n'y entrent jamais.
  const s = useMemo(() => computeStats(j.filtered, j.initialBalance), [j.filtered, j.initialBalance]);
  const cash = useMemo(() => computeCashflow(j.initialBalance, j.filtered, j.filteredTx), [j.initialBalance, j.filtered, j.filteredTx]);

  // Onglet gardé dans l'adresse (#mouvements) pour pouvoir y revenir directement
  useEffect(() => {
    const read = () => setTabState(window.location.hash === "#mouvements" ? "mouvements" : "dashboard");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    history.replaceState(null, "", t === "mouvements" ? "#mouvements" : window.location.pathname);
  };

  // Retraits et payouts posés sur la courbe d'équité, au dernier point avant leur date
  const markers = useMemo(() => {
    const labels = s.equity.map((e) => e.label);
    return j.filteredTx.filter(isOutflow).map((t) => {
      let index = 0;
      for (let i = 0; i < labels.length; i++) if (labels[i] <= t.date) index = i;
      const acc = j.accounts.find((a) => a.id === t.account_id);
      return { index, label: `${TX_TYPES[t.type]} ${money(-t.amount, acc?.currency ?? ccy)} on ${dateFr(t.date, { month: "short", day: "numeric" })}` };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.equity, j.filteredTx, j.accounts]);
  const ccy = j.currency;
  const setups = [...new Set(j.trades.map((t) => t.setup).filter(Boolean) as string[])];
  const lastDays = s.days.slice(-30);

  const kpis: { label: string; value: string; tone?: string; sub?: string }[] = [
    { label: "Net P&L", value: signedMoney(s.net, ccy), tone: s.net >= 0 ? "up" : "down", sub: `${s.n} trades · fees ${money(s.fees, ccy)}` },
    { label: "Win rate", value: `${num(s.winRate, 1)}%`, sub: `${s.wins} wins / ${s.losses} losses` },
    { label: "Profit factor", value: isFinite(s.profitFactor) ? num(s.profitFactor, 2) : "∞", tone: s.profitFactor >= 1 ? "up" : "down" },
    { label: "Day win rate", value: `${num(s.dayWinRate, 1)}%`, sub: `${s.days.length} days traded` },
    { label: "Avg win / avg loss", value: isFinite(s.winLossRatio) ? num(s.winLossRatio, 2) : "∞", sub: `${money(s.avgWin, ccy)} / ${money(s.avgLoss, ccy)}` },
    { label: "Expectancy per trade", value: signedMoney(s.expectancy, ccy), tone: s.expectancy >= 0 ? "up" : "down" },
    {
      label: "Current balance",
      value: money(cash.balance, ccy),
      sub: `Starting ${money(cash.initial, ccy, 0)}${cash.deposits ? ` · deposits ${money(cash.deposits, ccy, 0)}` : ""}`,
    },
    {
      label: "Total withdrawn",
      value: money(cash.totalWithdrawn, ccy),
      tone: cash.totalWithdrawn > 0 ? "up" : undefined,
      sub: cash.totalWithdrawn
        ? `Withdrawals ${money(cash.withdrawals, ccy, 0)} · payouts ${money(cash.payouts, ccy, 0)}`
        : "What you have actually cashed out",
    },
    {
      label: "Return",
      value: pct(cash.returnPct),
      tone: (cash.returnPct ?? 0) >= 0 ? "up" : "down",
      sub: "Trade P&L ÷ (starting balance + deposits)",
    },
  ];

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Journal · Dashboard</h1>
          <p>Your trading stats, per account or across all accounts.</p>
        </div>
        <div className="row">
          <AccountSelect j={j} />
          <button className="btn" onClick={() => setTxForm("new")}>+ Withdrawal / Deposit</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add trade</button>
        </div>
      </div>

      <div className="seg" role="tablist" aria-label="Journal view" style={{ alignSelf: "flex-start" }}>
        <button role="tab" aria-selected={tab === "dashboard"} className={tab === "dashboard" ? "on" : ""} onClick={() => setTab("dashboard")}>
          Dashboard
        </button>
        <button role="tab" aria-selected={tab === "mouvements"} className={tab === "mouvements" ? "on" : ""} onClick={() => setTab("mouvements")}>
          Transactions{j.filteredTx.length ? ` (${j.filteredTx.length})` : ""}
        </button>
      </div>

      {j.error && <div className="notice err">{j.error}</div>}
      {!j.loading && j.accounts.length === 0 && (
        <div className="notice ok">Welcome! Start by creating an account (Accounts button), then add your first trade.</div>
      )}

      {tab === "mouvements" ? (
        <Movements j={j} onEdit={(t) => setTxForm(t)} />
      ) : (
      <>
      <div className="grid g3 kpis">
        {kpis.map((k) => (
          <div key={k.label} className="card card-b">
            <div className="label">{k.label}</div>
            <div className={`num kpi-value ${k.tone ?? ""}`}>{j.loading ? "…" : k.value}</div>
            {k.sub && <div className="small muted">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid g12">
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Edge score</h2>
              <p>Average of 6 criteria scored out of 100.</p>
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
              <h2>Equity curve</h2>
              <p>Starting balance + trade P&L · max drawdown {money(s.maxDD, ccy)} ({num(s.maxDDPct, 1)}%)</p>
            </div>
          </div>
          <div className="card-b">
            <LineChart
              labels={s.equity.map((e) => e.label)}
              series={[{ name: "Balance", data: s.equity.map((e) => e.value), color: SERIES[0] }]}
              format={(v) => compact(v)}
              formatLabel={(d) => dateFr(d, { day: "numeric", month: "short" })}
              zeroLine={false}
              area
              height={280}
              markers={markers}
            />
            {markers.length > 0 && (
              <div className="small muted" style={{ marginTop: 6 }}>
                <span style={{ color: "var(--text)", fontSize: 10 }}>▼</span> Withdrawal or payout ({markers.length}). The curve does not drop: cash taken out is not a loss.
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><div><h2>P&L by day</h2><p>Last 30 trading days</p></div></div>
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
          <div className="card-h"><h2>P&L by market</h2></div>
          <div className="card-b"><HBars rows={s.byMarket.slice(0, 10).map((g) => ({ label: g.label, value: g.pnl, sub: `${g.count} trades` }))} format={(v) => compact(v)} /></div>
        </section>
        <section className="card">
          <div className="card-h"><h2>P&L by setup</h2></div>
          <div className="card-b"><HBars rows={s.bySetup.slice(0, 10).map((g) => ({ label: g.label, value: g.pnl, sub: `${g.count} trades, ${num((g.wins / g.count) * 100, 0)}% win rate` }))} format={(v) => compact(v)} /></div>
        </section>
        <section className="card">
          <div className="card-h"><div><h2>Cost of mistakes</h2><p>Total P&L of trades with this mistake</p></div></div>
          <div className="card-b">
            {s.mistakes.length ? (
              <HBars rows={s.mistakes.map((g) => ({ label: mistakeLabel(g.label), value: g.pnl, sub: `${g.count} trades` }))} format={(v) => compact(v)} />
            ) : (
              <div className="empty">No mistakes logged. Tag them on your trades to see what they cost you.</div>
            )}
          </div>
        </section>
      </div>
      </>
      )}

      {txForm && (
        <TransactionForm
          accounts={j.accounts}
          tx={txForm === "new" ? null : txForm}
          defaultAccountId={j.accountId}
          onClose={() => setTxForm(null)}
          onSaved={() => {
            setTxForm(null);
            j.reload();
          }}
        />
      )}

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
