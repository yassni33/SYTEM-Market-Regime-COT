"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { EMOTIONS, MISTAKES, type Account, type Trade } from "@/lib/journal";
import { FX_PAIRS, INDICES } from "@/lib/markets";

const MARKETS = [...FX_PAIRS.map((p) => p.symbol), "XAUUSD", ...INDICES.map((i) => i.symbol), "US30", "NAS100", "SPX500", "GER40"];

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
const numOrNull = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !isFinite(v) ? null : v;
};

// Affiche des captures stockées dans Supabase (liens signés, valables 1 h)
export function useSignedUrls(paths: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join("|");
  useEffect(() => {
    if (!paths.length) return;
    supabaseBrowser()
      .storage.from("captures")
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((d) => {
          if (d.path && d.signedUrl) m[d.path] = d.signedUrl;
        });
        setUrls(m);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export default function TradeForm({
  accounts,
  trade,
  defaultAccountId,
  setups,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  trade?: Trade | null;
  defaultAccountId?: string;
  setups: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !trade;
  const [f, setF] = useState(() => ({
    account_id: trade?.account_id ?? (defaultAccountId && defaultAccountId !== "all" ? defaultAccountId : accounts[0]?.id ?? ""),
    market: trade?.market ?? "EURUSD",
    side: trade?.side ?? "Long",
    opened_at: toLocalInput(trade?.opened_at ?? new Date().toISOString()),
    closed_at: toLocalInput(trade?.closed_at ?? new Date().toISOString()),
    lot: trade?.lot?.toString() ?? "",
    entry: trade?.entry?.toString() ?? "",
    exit: trade?.exit?.toString() ?? "",
    sl: trade?.sl?.toString() ?? "",
    tp: trade?.tp?.toString() ?? "",
    pnl: trade?.pnl?.toString() ?? "",
    fees: trade?.fees?.toString() ?? "",
    setup: trade?.setup ?? "ACR",
    mistakes: trade?.mistakes ?? [],
    emotion: trade?.emotion ?? "",
    rating: trade?.rating ?? 0,
    notes: trade?.notes ?? "",
    screenshots: trade?.screenshots ?? [],
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const urls = useSignedUrls(f.screenshots);
  const previews = useMemo(() => files.map((x) => URL.createObjectURL(x)), [files]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleMistake = (m: string) =>
    set("mistakes", f.mistakes.includes(m) ? f.mistakes.filter((x) => x !== m) : [...f.mistakes, m]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.account_id) return setErr("Crée d’abord un compte (bouton « Comptes »).");
    const pnl = numOrNull(f.pnl);
    if (pnl == null) return setErr("Indique le P&L net du trade (négatif si perte).");
    setBusy(true);
    setErr(null);
    const sb = supabaseBrowser();
    const id = trade?.id ?? crypto.randomUUID();
    const { data: u } = await sb.auth.getUser();
    const uploaded: string[] = [];
    for (const file of files) {
      const path = `${u.user?.id}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await sb.storage.from("captures").upload(path, file, { contentType: file.type });
      if (error) {
        setBusy(false);
        return setErr(`Envoi de la capture impossible : ${error.message}`);
      }
      uploaded.push(path);
    }
    const row = {
      id,
      account_id: f.account_id,
      market: f.market.trim().toUpperCase(),
      side: f.side,
      opened_at: new Date(f.opened_at).toISOString(),
      closed_at: f.closed_at ? new Date(f.closed_at).toISOString() : null,
      lot: numOrNull(f.lot),
      entry: numOrNull(f.entry),
      exit: numOrNull(f.exit),
      sl: numOrNull(f.sl),
      tp: numOrNull(f.tp),
      pnl,
      fees: numOrNull(f.fees) ?? 0,
      setup: f.setup.trim() || null,
      mistakes: f.mistakes,
      emotion: f.emotion || null,
      rating: f.rating || null,
      notes: f.notes.trim() || null,
      screenshots: [...f.screenshots, ...uploaded],
    };
    const { error } = isNew ? await sb.from("trades").insert(row) : await sb.from("trades").update(row).eq("id", id);
    setBusy(false);
    if (error) return setErr(error.message);
    onSaved();
  }

  async function removeShot(path: string) {
    await supabaseBrowser().storage.from("captures").remove([path]);
    const next = f.screenshots.filter((p) => p !== path);
    set("screenshots", next);
    if (trade) await supabaseBrowser().from("trades").update({ screenshots: next }).eq("id", trade.id);
  }

  async function del() {
    if (!trade || !window.confirm("Supprimer ce trade ? C’est définitif.")) return;
    const sb = supabaseBrowser();
    if (trade.screenshots.length) await sb.storage.from("captures").remove(trade.screenshots);
    const { error } = await sb.from("trades").delete().eq("id", trade.id);
    if (error) return setErr(error.message);
    onSaved();
  }

  const input = (k: "lot" | "entry" | "exit" | "sl" | "tp" | "pnl" | "fees", label: string, ph = "") => (
    <label className="field">
      <span>{label}</span>
      <input id={`t-${k}`} className="input num" inputMode="decimal" value={f[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save} role="dialog" aria-label={isNew ? "Nouveau trade" : "Modifier le trade"}>
        <div className="card-h">
          <h2>{isNew ? "Nouveau trade" : `Trade ${trade?.market}`}</h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="card-b stack">
          <div className="form-grid">
            <label className="field">
              <span>Compte</span>
              <select id="t-account" className="input" value={f.account_id} onChange={(e) => set("account_id", e.target.value)} required>
                {accounts.length === 0 && <option value="">Aucun compte</option>}
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Marché</span>
              <input id="t-market" className="input mono" list="markets" value={f.market} onChange={(e) => set("market", e.target.value)} required />
              <datalist id="markets">{MARKETS.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <div className="field">
              <span>Sens</span>
              <div className="seg">
                {(["Long", "Short"] as const).map((s) => (
                  <button type="button" key={s} className={f.side === s ? "on" : ""} onClick={() => set("side", s)}>{s}</button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Ouverture</span>
              <input id="t-open" className="input" type="datetime-local" value={f.opened_at} onChange={(e) => set("opened_at", e.target.value)} required />
            </label>
            <label className="field">
              <span>Clôture</span>
              <input id="t-close" className="input" type="datetime-local" value={f.closed_at} onChange={(e) => set("closed_at", e.target.value)} />
            </label>
            {input("lot", "Lot", "0,50")}
            {input("entry", "Entrée")}
            {input("exit", "Sortie")}
            {input("sl", "Stop loss")}
            {input("tp", "Take profit")}
            {input("pnl", "P&L net", "-250 ou 480")}
            {input("fees", "Frais", "7")}
            <label className="field">
              <span>Setup</span>
              <input id="t-setup" className="input" list="setups" value={f.setup} onChange={(e) => set("setup", e.target.value)} />
              <datalist id="setups">{[...new Set(["ACR", ...setups])].map((s) => <option key={s} value={s} />)}</datalist>
            </label>
            <label className="field">
              <span>Émotion</span>
              <select id="t-emotion" className="input" value={f.emotion} onChange={(e) => set("emotion", e.target.value)}>
                <option value="">—</option>
                {EMOTIONS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <div className="field">
              <span>Note du trade</span>
              <div className="row" style={{ gap: 2 }}>
                {[1, 2, 3, 4, 5].map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => set("rating", f.rating === r ? 0 : r)}
                    aria-label={`${r} sur 5`}
                    style={{ border: 0, background: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: r <= f.rating ? "var(--warn)" : "var(--line-strong)", padding: 2 }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <span>Erreurs commises</span>
            <div className="row">
              {MISTAKES.map((m) => (
                <button type="button" key={m} className={`chip ${f.mistakes.includes(m) ? "on" : ""}`} onClick={() => toggleMistake(m)}>{m}</button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea id="t-notes" className="input" rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contexte, raison d’entrée, ce que j’ai bien ou mal fait…" />
          </label>

          <div className="field">
            <span>Captures d’écran</span>
            <div className="row" style={{ alignItems: "flex-start" }}>
              {f.screenshots.map((p) => (
                <div key={p} style={{ position: "relative" }}>
                  {urls[p] ? (
                    <a href={urls[p]} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls[p]} alt="Capture du trade" style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line)" }} />
                    </a>
                  ) : (
                    <div className="skeleton" style={{ width: 120, height: 80 }} />
                  )}
                  <button type="button" className="btn btn-sm btn-danger" style={{ position: "absolute", top: 4, right: 4, padding: "0 6px" }} onClick={() => removeShot(p)} aria-label="Retirer la capture">×</button>
                </div>
              ))}
              {previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={`Nouvelle capture ${i + 1}`} style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 6, border: "2px dashed var(--accent)" }} />
              ))}
              <label className="btn" style={{ height: 80, width: 120, flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
                <span className="small">Ajouter</span>
                <input id="t-files" type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
              </label>
            </div>
          </div>

          {err && <div className="notice err">{err}</div>}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>{!isNew && <button type="button" className="btn btn-danger" onClick={del}>Supprimer</button>}</div>
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
