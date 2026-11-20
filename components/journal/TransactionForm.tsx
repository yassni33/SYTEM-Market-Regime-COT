"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { TX_TYPES, type Account, type Transaction } from "@/lib/journal";
import { dayKey } from "@/lib/format";

export default function TransactionForm({
  accounts,
  tx,
  defaultAccountId,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  tx?: Transaction | null;
  defaultAccountId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !tx;
  const [accountId, setAccountId] = useState(
    tx?.account_id ?? (defaultAccountId && defaultAccountId !== "all" ? defaultAccountId : accounts[0]?.id ?? ""),
  );
  const [type, setType] = useState<Transaction["type"]>(tx?.type ?? "withdrawal");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [date, setDate] = useState(tx?.date ?? dayKey(new Date()));
  const [note, setNote] = useState(tx?.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const acc = accounts.find((a) => a.id === accountId);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return setErr("Create an account first (Accounts button).");
    const value = Number(amount.replace(/[\s,]/g, ""));
    if (!isFinite(value) || value <= 0) return setErr("The amount must be a positive number. The type says whether money comes in or goes out.");
    setBusy(true);
    setErr(null);
    const row = { account_id: accountId, type, amount: value, date, note: note.trim() || null };
    const sb = supabaseBrowser();
    const { error } = isNew
      ? await sb.from("account_transactions").insert(row)
      : await sb.from("account_transactions").update(row).eq("id", tx!.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <form
        className="card modal"
        style={{ width: "min(520px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        role="dialog"
        aria-label={isNew ? "New withdrawal or deposit" : "Edit transaction"}
      >
        <div className="card-h">
          <h2>{isNew ? "Withdrawal / Deposit" : "Edit transaction"}</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="card-b stack">
          <div className="field">
            <span>Type</span>
            <div className="seg">
              {(Object.keys(TX_TYPES) as Transaction["type"][]).map((k) => (
                <button type="button" key={k} className={type === k ? "on" : ""} onClick={() => setType(k)}>
                  {TX_TYPES[k]}
                </button>
              ))}
            </div>
            <span className="small muted" style={{ fontWeight: 400 }}>
              {type === "deposit"
                ? "Money added to the account. It raises the balance, not your P&L."
                : type === "payout"
                  ? "Profit split paid by the prop firm. It lowers the account balance."
                  : "Money taken out of the account. It lowers the balance, not your P&L."}
            </span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Account</span>
              <select id="tx-account" className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {accounts.length === 0 && <option value="">No account</option>}
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Amount ({acc?.currency ?? "USD"})</span>
              <input id="tx-amount" className="input num" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000" />
            </label>
            <label className="field">
              <span>Date</span>
              <input id="tx-date" className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Note</span>
            <input id="tx-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="1st FTMO payout, bank transfer…" />
          </label>
          {err && <div className="notice err">{err}</div>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
