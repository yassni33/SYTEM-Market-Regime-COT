"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ACCOUNT_TYPES, computeCashflow, TX_TYPES, type Transaction } from "@/lib/journal";
import { dateFr, money, signedMoney } from "@/lib/format";
import type { Journal } from "./useJournal";

// "Transactions" tab: balance of each account + list of withdrawals, deposits and payouts.
export default function Movements({ j, onEdit }: { j: Journal; onEdit: (t: Transaction) => void }) {
  const shown = j.accounts.filter((a) => j.accountId === "all" || a.id === j.accountId);
  const accById = Object.fromEntries(j.accounts.map((a) => [a.id, a]));

  async function remove(t: Transaction) {
    const acc = accById[t.account_id];
    if (!window.confirm(`Delete this ${TX_TYPES[t.type].toLowerCase()} of ${money(t.amount, acc?.currency)} on ${dateFr(t.date)}?`)) return;
    const { error } = await supabaseBrowser().from("account_transactions").delete().eq("id", t.id);
    if (error) return window.alert(error.message);
    j.reload();
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Balance by account</h2>
            <p>Balance = starting balance + deposits − withdrawals − payouts + trade P&L</p>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Account</th>
                <th className="r">Starting</th>
                <th className="r">Deposits</th>
                <th className="r">Withdrawals</th>
                <th className="r">Payouts</th>
                <th className="r">Trade P&L</th>
                <th className="r">Current balance</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => {
                const c = computeCashflow(
                  a.initial_balance,
                  j.trades.filter((t) => t.account_id === a.id),
                  j.transactions.filter((t) => t.account_id === a.id),
                );
                return (
                  <tr key={a.id}>
                    <td>
                      <b>{a.name}</b> <span className="tag">{ACCOUNT_TYPES[a.type]}</span>
                    </td>
                    <td className="r num">{money(c.initial, a.currency)}</td>
                    <td className="r num">{c.deposits ? money(c.deposits, a.currency) : "—"}</td>
                    <td className="r num">{c.withdrawals ? money(-c.withdrawals, a.currency) : "—"}</td>
                    <td className="r num">{c.payouts ? money(-c.payouts, a.currency) : "—"}</td>
                    <td className={`r num ${c.tradePnl > 0 ? "up" : c.tradePnl < 0 ? "down" : ""}`}>{signedMoney(c.tradePnl, a.currency)}</td>
                    <td className="r num" style={{ fontWeight: 600 }}>{money(c.balance, a.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <div className="empty">No accounts. Create one with the Accounts button.</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Withdrawals and deposits</h2>
            <p>These change the balance, never your trading stats.</p>
          </div>
        </div>
        {j.txError ? (
          <div className="card-b"><div className="notice">{j.txError}</div></div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="r">Amount</th>
                  <th>Note</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {j.filteredTx.map((t) => {
                  const a = accById[t.account_id];
                  const out = t.type !== "deposit";
                  return (
                    <tr key={t.id}>
                      <td className="num">{dateFr(t.date)}</td>
                      <td>{a?.name ?? "—"}</td>
                      <td>
                        <span className={`tag ${out ? "" : "tag-accent"}`}>{TX_TYPES[t.type]}</span>
                      </td>
                      <td className="r num" style={{ fontWeight: 600 }}>
                        {out ? "−" : "+"}
                        {money(t.amount, a?.currency)}
                      </td>
                      <td style={{ whiteSpace: "normal", minWidth: 160 }}>{t.note ?? <span className="faint">—</span>}</td>
                      <td className="r">
                        <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <button className="btn btn-sm" onClick={() => onEdit(t)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(t)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!j.filteredTx.length && (
              <div className="empty">No withdrawals or deposits yet. Click “+ Withdrawal / Deposit” to add one.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
