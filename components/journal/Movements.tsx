"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ACCOUNT_TYPES, computeCashflow, TX_TYPES, type Transaction } from "@/lib/journal";
import { dateFr, money, signedMoney } from "@/lib/format";
import type { Journal } from "./useJournal";

// Onglet « Mouvements » : solde de chaque compte + liste des retraits, dépôts et payouts.
export default function Movements({ j, onEdit }: { j: Journal; onEdit: (t: Transaction) => void }) {
  const shown = j.accounts.filter((a) => j.accountId === "all" || a.id === j.accountId);
  const accById = Object.fromEntries(j.accounts.map((a) => [a.id, a]));

  async function remove(t: Transaction) {
    const acc = accById[t.account_id];
    if (!window.confirm(`Supprimer ce ${TX_TYPES[t.type].toLowerCase()} de ${money(t.amount, acc?.currency)} du ${dateFr(t.date)} ?`)) return;
    const { error } = await supabaseBrowser().from("account_transactions").delete().eq("id", t.id);
    if (error) return window.alert(error.message);
    j.reload();
  }

  return (
    <div className="stack" style={{ gap: 18 }}>
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Solde par compte</h2>
            <p>Solde = départ + dépôts − retraits − payouts + P&L des trades</p>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Compte</th>
                <th className="r">Départ</th>
                <th className="r">Dépôts</th>
                <th className="r">Retraits</th>
                <th className="r">Payouts</th>
                <th className="r">P&L trades</th>
                <th className="r">Solde actuel</th>
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
          {!shown.length && <div className="empty">Aucun compte. Crée-en un avec le bouton « Comptes ».</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Retraits et dépôts</h2>
            <p>Ces mouvements changent le solde, jamais tes stats de trading.</p>
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
                  <th>Compte</th>
                  <th>Type</th>
                  <th className="r">Montant</th>
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
                          <button className="btn btn-sm" onClick={() => onEdit(t)}>Modifier</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(t)}>Supprimer</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!j.filteredTx.length && (
              <div className="empty">Aucun retrait ni dépôt. Clique sur « + Retrait / Dépôt » pour en ajouter un.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
