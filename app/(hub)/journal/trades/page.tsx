"use client";
import { useMemo, useState } from "react";
import { AccountSelect } from "@/components/journal/AccountBar";
import TradeForm from "@/components/journal/TradeForm";
import { useJournal } from "@/components/journal/useJournal";
import { ACCOUNT_TYPES, MISTAKES, emotionLabel, mistakeLabel, tradeDay, type Trade } from "@/lib/journal";
import { dateFr, money, num, signedMoney } from "@/lib/format";

export default function TradesList() {
  const j = useJournal();
  const [editing, setEditing] = useState<Trade | null | "new">(null);
  const [q, setQ] = useState({ market: "", side: "", setup: "", result: "", mistake: "", from: "", to: "" });
  const set = (k: keyof typeof q, v: string) => setQ((s) => ({ ...s, [k]: v }));

  const markets = [...new Set(j.trades.map((t) => t.market))].sort();
  const setups = [...new Set(j.trades.map((t) => t.setup).filter(Boolean) as string[])].sort();
  const accName = (id: string) => j.accounts.find((a) => a.id === id);

  const rows = useMemo(
    () =>
      j.filtered.filter((t) => {
        const d = tradeDay(t);
        return (
          (!q.market || t.market === q.market) &&
          (!q.side || t.side === q.side) &&
          (!q.setup || t.setup === q.setup) &&
          (!q.mistake || t.mistakes.includes(q.mistake)) &&
          (!q.result || (q.result === "win" ? t.pnl > 0 : q.result === "loss" ? t.pnl < 0 : t.pnl === 0)) &&
          (!q.from || d >= q.from) &&
          (!q.to || d <= q.to)
        );
      }),
    [j.filtered, q],
  );
  const total = rows.reduce((s, t) => s + t.pnl, 0);
  const wins = rows.filter((t) => t.pnl > 0).length;
  const sel = (k: keyof typeof q, label: string, opts: [string, string][]) => (
    <label className="field">
      <span>{label}</span>
      <select id={`f-${k}`} className="input" value={q[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">All</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Trade list</h1>
          <p>Click a trade to edit it, see its screenshots or delete it.</p>
        </div>
        <div className="row">
          <AccountSelect j={j} />
          <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Add trade</button>
        </div>
      </div>

      <div className="card card-b">
        <div className="form-grid">
          {sel("market", "Market", markets.map((m) => [m, m]))}
          {sel("side", "Side", [["Long", "Long"], ["Short", "Short"]])}
          {sel("setup", "Setup", setups.map((s) => [s, s]))}
          {sel("result", "Result", [["win", "Winners"], ["loss", "Losers"], ["be", "Break-even"]])}
          {sel("mistake", "Mistake", MISTAKES.map((m) => [m, mistakeLabel(m)]))}
          <label className="field"><span>From</span><input id="f-from" className="input" type="date" value={q.from} onChange={(e) => set("from", e.target.value)} /></label>
          <label className="field"><span>To</span><input id="f-to" className="input" type="date" value={q.to} onChange={(e) => set("to", e.target.value)} /></label>
          <div className="field" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setQ({ market: "", side: "", setup: "", result: "", mistake: "", from: "", to: "" })}>Clear filters</button>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="card-h">
          <span className="muted">{rows.length} trades · {rows.length ? num((wins / rows.length) * 100, 0) : 0}% win rate</span>
          <b className={`num ${total >= 0 ? "up" : "down"}`}>{signedMoney(total, j.currency)}</b>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Market</th>
                <th>Side</th>
                <th className="r">Lot size</th>
                <th className="r">Entry</th>
                <th className="r">Exit</th>
                <th className="r">Net P&L</th>
                <th>Setup</th>
                <th>Mistakes</th>
                <th>Emotion</th>
                <th className="c">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const a = accName(t.account_id);
                return (
                  <tr key={t.id} onClick={() => setEditing(t)} style={{ cursor: "pointer" }}>
                    <td className="num">{dateFr(t.closed_at ?? t.opened_at, { day: "2-digit", month: "short", year: "2-digit" })}</td>
                    <td>{a ? <span title={ACCOUNT_TYPES[a.type]}>{a.name}</span> : "—"}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {t.market} {t.screenshots.length > 0 && <span title="Screenshots" className="faint">▣</span>}
                    </td>
                    <td><span className={`tag ${t.side === "Long" ? "tag-up" : "tag-down"}`}>{t.side}</span></td>
                    <td className="r num">{t.lot ?? "—"}</td>
                    <td className="r num">{t.entry ?? "—"}</td>
                    <td className="r num">{t.exit ?? "—"}</td>
                    <td className={`r num ${t.pnl > 0 ? "up" : t.pnl < 0 ? "down" : ""}`} style={{ fontWeight: 600 }}>{money(t.pnl, a?.currency ?? j.currency)}</td>
                    <td>{t.setup ?? "—"}</td>
                    <td>{t.mistakes.length ? <span className="tag tag-warn" title={t.mistakes.map(mistakeLabel).join(", ")}>{t.mistakes.length} mistake{t.mistakes.length > 1 ? "s" : ""}</span> : <span className="faint">—</span>}</td>
                    <td>{emotionLabel(t.emotion) ?? "—"}</td>
                    <td className="c" style={{ color: "var(--warn)" }}>{t.rating ? "★".repeat(t.rating) : <span className="faint">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!j.loading && rows.length === 0 && (
            <div className="empty">{j.trades.length ? "No trades match these filters." : "No trades logged yet. Click “Add trade”."}</div>
          )}
        </div>
      </section>

      {editing && (
        <TradeForm
          accounts={j.accounts}
          trade={editing === "new" ? null : editing}
          defaultAccountId={j.accountId}
          setups={setups}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            j.reload();
          }}
        />
      )}
    </div>
  );
}
