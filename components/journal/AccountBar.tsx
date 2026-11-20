"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ACCOUNT_TYPES, type Account } from "@/lib/journal";
import { money } from "@/lib/format";
import type { Journal } from "./useJournal";

export function AccountSelect({ j }: { j: Journal }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="row">
      <select id="account" className="input" style={{ width: "auto", minWidth: 180 }} value={j.accountId} onChange={(e) => j.setAccountId(e.target.value)} aria-label="Account">
        <option value="all">All accounts</option>
        {j.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({ACCOUNT_TYPES[a.type]})
          </option>
        ))}
      </select>
      <button className="btn" onClick={() => setOpen(true)}>Accounts</button>
      {open && <AccountsModal j={j} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AccountsModal({ j, onClose }: { j: Journal; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("prop");
  const [currency, setCurrency] = useState("USD");
  const [balance, setBalance] = useState("100000");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from("accounts")
      .insert({ name: name.trim(), type, currency, initial_balance: Number(balance.replace(/[\s,]/g, "")) || 0 });
    setBusy(false);
    if (error) return setErr(error.message);
    setName("");
    await j.reload();
  }
  async function remove(a: Account) {
    const count = j.trades.filter((t) => t.account_id === a.id).length;
    if (!window.confirm(`Delete the account "${a.name}" and its ${count} trade(s)? This cannot be undone.`)) return;
    const { error } = await supabaseBrowser().from("accounts").delete().eq("id", a.id);
    if (error) return setErr(error.message);
    await j.reload();
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Accounts">
        <div className="card-h">
          <h2>My accounts</h2>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="card-b stack">
          {j.accounts.length === 0 && <p className="muted">No accounts yet. Create your first one below.</p>}
          {j.accounts.map((a) => (
            <div key={a.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <b>{a.name}</b> <span className="tag">{ACCOUNT_TYPES[a.type]}</span>
                <div className="small muted">Starting balance {money(a.initial_balance, a.currency, 0)}</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>Delete</button>
            </div>
          ))}
          <form onSubmit={add} className="form-grid">
            <label className="field">
              <span>Account name</span>
              <input id="acc-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="FTMO 100k" />
            </label>
            <label className="field">
              <span>Type</span>
              <select id="acc-type" className="input" value={type} onChange={(e) => setType(e.target.value as Account["type"])}>
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
              <select id="acc-ccy" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "MAD"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Starting balance</span>
              <input id="acc-balance" className="input" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </label>
            <div className="wide row" style={{ justifyContent: "flex-end" }}>
              {err && <span className="small down">{err}</span>}
              <button className="btn btn-primary" disabled={busy}>Add account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
