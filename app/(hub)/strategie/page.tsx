"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type BacktestRow = { periode: string; marche: string; trades: string; gagnants: string; rr: string; resultat: string };
type Content = {
  rules: string;
  tc: string;
  examples: string;
  backtestNote: string;
  backtest: BacktestRow[];
  code: string;
  checklist: string[];
};

// Contenu de départ : la stratégie ACR de Yassni. Modifiable depuis la page (enregistré dans Supabase).
const DEFAULT: Content = {
  rules: [
    "1. Tendance du jour : je la choisis avant la séance. Haussière = achats seulement. Baissière = ventes seulement.",
    "",
    "2. Range Asie : de 20h00 à 00h00 heure de New York. Son plus haut et son plus bas = la liquidité.",
    "",
    "3. Sweep : entre 02h00 et 09h00 NY, une bougie H1 passe au-delà du haut ou du bas de l’Asie. J’attends que cette bougie H1 soit terminée, peu importe où elle clôture.",
    "",
    "4. TC en M5 : je trace la ligne TC (voir l’explication plus bas). Le TC est validé seulement si le CORPS d’une bougie M5 clôture au-delà de la ligne, avant 09h30 NY.",
    "",
    "5. Entrée : à la clôture de la bougie M5 qui valide le TC.",
    "   • Stop loss : au-delà de l’extrême du sweep, + 5 ticks.",
    "   • Take profit : ratio fixe.",
    "",
    "Gestion du risque",
    "   • Risque 1 % maximum par trade.",
    "   • 2 trades maximum par jour.",
    "   • Pas d’entrée juste avant une grosse news.",
    "   • Si je casse une règle, j’arrête pour la journée.",
  ].join("\n"),
  tc: [
    "Le TC se trace en M5, après le sweep de l’Asie.",
    "",
    "• Pour un achat (le bas de l’Asie a été pris) : la ligne TC est le dernier sommet d’où est partie la descente qui a pris le bas de l’Asie.",
    "• Pour une vente (le haut de l’Asie a été pris) : la ligne TC est le dernier creux d’où est partie la montée qui a pris le haut de l’Asie.",
    "",
    "Validation : le CORPS d’une bougie M5 doit clôturer au-delà de la ligne TC. Une simple mèche ne compte pas.",
    "Limite de temps : la validation doit arriver avant 09h30 NY. Après, pas de trade.",
  ].join("\n"),
  examples:
    "Décris ici tes trades modèles (date, marché, ce qui a validé chaque règle). Ajoute les captures dans le journal et note leur date ici.",
  backtestNote:
    "Données Dukascopy 2023-2024. Règles appliquées automatiquement, SANS le filtre de tendance du jour (règle 1). TP en ratio 1:1. Nombre de gagnants arrondi à partir du % gagnants.",
  backtest: [
    { periode: "2023-2024", marche: "EURUSD", trades: "473", gagnants: "246", rr: "1:1", resultat: "−6,5 R" },
    { periode: "2023-2024", marche: "GBPUSD", trades: "480", gagnants: "230", rr: "1:1", resultat: "−36 R" },
  ],
  code: "// Colle ici le code Pine Script de ton indicateur ACR pour TradingView.\n//@version=5\nindicator(\"ACR\", overlay = true)\n",
  checklist: [
    "Tendance du jour définie : je trade seulement dans son sens",
    "Range Asie (20h00–00h00 NY) tracé : haut et bas marqués",
    "Sweep : une bougie H1 a dépassé le haut ou le bas de l’Asie entre 02h00 et 09h00 NY, et elle est terminée",
    "Ligne TC tracée en M5 (dernier sommet ou creux d’où est parti le sweep)",
    "Le CORPS d’une bougie M5 a clôturé au-delà du TC, avant 09h30 NY",
    "SL au-delà de l’extrême du sweep (+ 5 ticks), TP en ratio fixe",
    "Risque 1 % maximum, lot calculé (Calculateur de risque)",
    "Moins de 2 trades aujourd’hui et aucune règle cassée aujourd’hui",
    "Pas de grosse news juste avant l’entrée (Calendrier des news)",
  ],
};

export default function StrategyPage() {
  const [c, setC] = useState<Content>(DEFAULT);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Content>(DEFAULT);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabaseBrowser()
      .from("strategy")
      .select("content")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.content && Object.keys(data.content).length) setC({ ...DEFAULT, ...(data.content as Content) });
      });
  }, []);

  async function save() {
    const { error } = await supabaseBrowser()
      .from("strategy")
      .upsert({ content: draft, updated_at: new Date().toISOString() });
    if (error) return setStatus(`Erreur : ${error.message}`);
    setC(draft);
    setEdit(false);
    setStatus("Enregistré");
    setChecked([]);
  }

  const allOk = c.checklist.length > 0 && c.checklist.every((_, i) => checked[i]);
  const block = (k: "rules" | "tc" | "examples" | "backtestNote", rows = 8) =>
    edit ? (
      <textarea id={`s-${k}`} className="input" rows={rows} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
    ) : (
      <div style={{ whiteSpace: "pre-wrap", maxWidth: "75ch" }}>{c[k]}</div>
    );

  const bt = edit ? draft.backtest : c.backtest;
  const totals = bt.reduce(
    (s, r) => ({ trades: s.trades + (Number(r.trades) || 0), wins: s.wins + (Number(r.gagnants) || 0) }),
    { trades: 0, wins: 0 },
  );

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Stratégie ACR</h1>
          <p>Tes règles, la checklist avant chaque trade, tes exemples, ton backtest et le code de l’indicateur.</p>
        </div>
        <div className="row">
          {status && <span className="small muted">{status}</span>}
          {edit ? (
            <>
              <button className="btn" onClick={() => setEdit(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={save}>Enregistrer</button>
            </>
          ) : (
            <button className="btn" onClick={() => { setDraft(c); setEdit(true); setStatus(null); }}>Modifier la page</button>
          )}
        </div>
      </div>

      <div className="grid g2">
        <section className="card">
          <div className="card-h"><h2>Règles</h2></div>
          <div className="card-b">{block("rules", 12)}</div>
        </section>

        <section className="card" style={{ borderColor: allOk ? "var(--accent)" : undefined }}>
          <div className="card-h">
            <div>
              <h2>Checklist avant chaque trade</h2>
              <p>Tout doit être coché. Sinon, pas de trade.</p>
            </div>
            {!edit && (
              <span className={`tag ${allOk ? "tag-up" : "tag-warn"}`}>
                {checked.filter(Boolean).length}/{c.checklist.length}
              </span>
            )}
          </div>
          <div className="card-b stack" style={{ gap: 8 }}>
            {edit ? (
              <>
                <textarea
                  id="s-checklist"
                  className="input"
                  rows={9}
                  value={draft.checklist.join("\n")}
                  onChange={(e) => setDraft({ ...draft, checklist: e.target.value.split("\n") })}
                />
                <span className="small muted">Un point par ligne.</span>
              </>
            ) : (
              <>
                {c.checklist.filter((x) => x.trim()).map((item, i) => (
                  <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", padding: "6px 8px", borderRadius: 8, background: checked[i] ? "var(--up-soft)" : undefined }}>
                    <input
                      id={`chk-${i}`}
                      type="checkbox"
                      checked={!!checked[i]}
                      onChange={(e) => {
                        const n = [...checked];
                        n[i] = e.target.checked;
                        setChecked(n);
                      }}
                      style={{ marginTop: 3, accentColor: "var(--accent)" }}
                    />
                    <span>{item}</span>
                  </label>
                ))}
                <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                  <b className={allOk ? "up" : "muted"}>{allOk ? "Trade autorisé selon ton plan" : "Pas encore : tout n’est pas validé"}</b>
                  <button className="btn btn-sm" onClick={() => setChecked([])}>Remettre à zéro</button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h2>Le TC expliqué</h2></div>
        <div className="card-b">{block("tc", 8)}</div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Exemples</h2></div>
        <div className="card-b">{block("examples", 6)}</div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Résultats du backtest</h2>
            <p>{totals.trades ? `${totals.trades} trades · ${Math.round((totals.wins / totals.trades) * 100)} % gagnants au total` : "Ajoute tes résultats ligne par ligne."}</p>
          </div>
          {edit && (
            <button className="btn btn-sm" onClick={() => setDraft({ ...draft, backtest: [...draft.backtest, { periode: "", marche: "", trades: "", gagnants: "", rr: "", resultat: "" }] })}>
              + Ligne
            </button>
          )}
        </div>
        <div className="card-b">{block("backtestNote", 3)}</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Période</th><th>Marché</th><th className="r">Trades</th><th className="r">Gagnants</th><th className="r">% gagnants</th><th className="r">R:R moyen</th><th className="r">Résultat (R ou %)</th>{edit && <th />}</tr>
            </thead>
            <tbody>
              {bt.map((r, i) => {
                const wr = Number(r.trades) ? Math.round((Number(r.gagnants) / Number(r.trades)) * 100) + " %" : "—";
                const cell = (k: keyof BacktestRow, right = false) =>
                  edit ? (
                    <td className={right ? "r" : ""}>
                      <input
                        id={`bt-${i}-${k}`}
                        className="input"
                        style={{ minWidth: 80, padding: "4px 6px" }}
                        value={r[k]}
                        onChange={(e) => {
                          const b = [...draft.backtest];
                          b[i] = { ...b[i], [k]: e.target.value };
                          setDraft({ ...draft, backtest: b });
                        }}
                      />
                    </td>
                  ) : (
                    <td className={right ? "r num" : ""}>{r[k] || "—"}</td>
                  );
                return (
                  <tr key={i}>
                    {cell("periode")}{cell("marche")}{cell("trades", true)}{cell("gagnants", true)}
                    <td className="r num">{wr}</td>
                    {cell("rr", true)}{cell("resultat", true)}
                    {edit && (
                      <td><button className="btn btn-sm btn-danger" onClick={() => setDraft({ ...draft, backtest: draft.backtest.filter((_, k) => k !== i) })}>×</button></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!bt.length && <div className="empty">Aucun résultat de backtest pour l’instant. Clique sur « Modifier la page » pour en ajouter.</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div><h2>Code de l’indicateur TradingView</h2><p>Pine Script, à coller dans l’éditeur Pine de TradingView.</p></div>
          {!edit && (
            <button
              className="btn btn-sm"
              onClick={() => navigator.clipboard.writeText(c.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
            >
              {copied ? "Copié !" : "Copier"}
            </button>
          )}
        </div>
        <div className="card-b">
          {edit ? (
            <textarea id="s-code" className="input mono" rows={16} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} spellCheck={false} />
          ) : (
            <pre className="mono" style={{ margin: 0, padding: 14, background: "#15202B", color: "#E6EDF3", borderRadius: 8, overflowX: "auto", fontSize: 12.5, lineHeight: 1.6 }}>
              {c.code}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
