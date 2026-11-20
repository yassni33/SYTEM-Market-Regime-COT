"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ACR_PINE } from "@/lib/acrPine";

// Placeholder used before the real indicator was added: a saved page still holding it gets the real code.
const OLD_PLACEHOLDER = "// Colle ici le code Pine Script";

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

// Default content: Yassni's ACR strategy. Editable from the page (saved in Supabase).
const DEFAULT: Content = {
  rules: [
    "1. Daily trend: I pick it before the session. Bullish = buys only. Bearish = sells only.",
    "",
    "2. Asia range: from 20:00 to 00:00 New York time. Its high and low = the liquidity.",
    "",
    "3. Sweep: between 02:00 and 09:00 NY, an H1 candle trades beyond the Asia high or low. I wait for that H1 candle to close, wherever it closes.",
    "",
    "4. TC on M5: I draw the TC line (see the explanation below). The TC is confirmed only if the BODY of an M5 candle closes beyond the line, before 09:30 NY.",
    "",
    "5. Entry: at the close of the M5 candle that confirms the TC.",
    "   • Stop loss: beyond the sweep extreme, + 5 ticks.",
    "   • Take profit: fixed ratio.",
    "",
    "Risk management",
    "   • 1% max risk per trade.",
    "   • 2 trades max per day.",
    "   • No entry right before high-impact news.",
    "   • If I break a rule, I stop for the day.",
  ].join("\n"),
  tc: [
    "The TC is drawn on M5, after the Asia sweep.",
    "",
    "• For a buy (the Asia low was taken): the TC line is the last high that the move down which took the Asia low started from.",
    "• For a sell (the Asia high was taken): the TC line is the last low that the move up which took the Asia high started from.",
    "",
    "Confirmation: the BODY of an M5 candle must close beyond the TC line. A wick alone does not count.",
    "Time limit: confirmation must come before 09:30 NY. After that, no trade.",
  ].join("\n"),
  examples:
    "Describe your model trades here (date, market, what confirmed each rule). Add the screenshots in the journal and note their date here.",
  backtestNote:
    "Dukascopy data 2023-2024. Rules applied automatically, WITHOUT the daily trend filter (rule 1). TP at a 1:1 ratio. Number of winners rounded from the win rate.",
  backtest: [
    { periode: "2023-2024", marche: "EURUSD", trades: "473", gagnants: "246", rr: "1:1", resultat: "−6.5 R" },
    { periode: "2023-2024", marche: "GBPUSD", trades: "480", gagnants: "230", rr: "1:1", resultat: "−36 R" },
  ],
  code: ACR_PINE,
  checklist: [
    "Daily trend set: I only trade in its direction",
    "Asia range (20:00–00:00 NY) drawn: high and low marked",
    "Sweep: an H1 candle went beyond the Asia high or low between 02:00 and 09:00 NY, and it has closed",
    "TC line drawn on M5 (last high or low the sweep move started from)",
    "The BODY of an M5 candle closed beyond the TC, before 09:30 NY",
    "SL beyond the sweep extreme (+ 5 ticks), TP at a fixed ratio",
    "1% max risk, lot size calculated (Risk calculator)",
    "Fewer than 2 trades today and no rule broken today",
    "No high-impact news right before entry (News calendar)",
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
        if (data?.content && Object.keys(data.content).length) {
          const saved = data.content as Content;
          const code = !saved.code || saved.code.startsWith(OLD_PLACEHOLDER) ? ACR_PINE : saved.code;
          setC({ ...DEFAULT, ...saved, code });
        }
      });
  }, []);

  async function save() {
    const { error } = await supabaseBrowser()
      .from("strategy")
      .upsert({ content: draft, updated_at: new Date().toISOString() });
    if (error) return setStatus(`Error: ${error.message}`);
    setC(draft);
    setEdit(false);
    setStatus("Saved");
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
          <h1>ACR strategy</h1>
          <p>Your rules, the pre-trade checklist, your examples, your backtest and the indicator code.</p>
        </div>
        <div className="row">
          {status && <span className="small muted">{status}</span>}
          {edit ? (
            <>
              <button className="btn" onClick={() => setEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          ) : (
            <button className="btn" onClick={() => { setDraft(c); setEdit(true); setStatus(null); }}>Edit page</button>
          )}
        </div>
      </div>

      <div className="grid g2">
        <section className="card">
          <div className="card-h"><h2>Rules</h2></div>
          <div className="card-b">{block("rules", 12)}</div>
        </section>

        <section className="card" style={{ borderColor: allOk ? "var(--accent)" : undefined }}>
          <div className="card-h">
            <div>
              <h2>Pre-trade checklist</h2>
              <p>Everything must be ticked. Otherwise, no trade.</p>
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
                <span className="small muted">One item per line.</span>
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
                  <b className={allOk ? "up" : "muted"}>{allOk ? "Trade allowed by your plan" : "Not yet: not everything is checked"}</b>
                  <button className="btn btn-sm" onClick={() => setChecked([])}>Reset</button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-h"><h2>The TC explained</h2></div>
        <div className="card-b">{block("tc", 8)}</div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Examples</h2></div>
        <div className="card-b">{block("examples", 6)}</div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Backtest results</h2>
            <p>{totals.trades ? `${totals.trades} trades · ${Math.round((totals.wins / totals.trades) * 100)}% overall win rate` : "Add your results row by row."}</p>
          </div>
          {edit && (
            <button className="btn btn-sm" onClick={() => setDraft({ ...draft, backtest: [...draft.backtest, { periode: "", marche: "", trades: "", gagnants: "", rr: "", resultat: "" }] })}>
              + Row
            </button>
          )}
        </div>
        <div className="card-b">{block("backtestNote", 3)}</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Period</th><th>Market</th><th className="r">Trades</th><th className="r">Winners</th><th className="r">Win rate</th><th className="r">Avg R:R</th><th className="r">Result (R or %)</th>{edit && <th />}</tr>
            </thead>
            <tbody>
              {bt.map((r, i) => {
                const wr = Number(r.trades) ? Math.round((Number(r.gagnants) / Number(r.trades)) * 100) + "%" : "—";
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
          {!bt.length && <div className="empty">No backtest results yet. Click “Edit page” to add some.</div>}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div><h2>TradingView indicator code</h2><p>Pine Script, to paste into the TradingView Pine Editor.</p></div>
          {!edit && (
            <button
              className="btn btn-sm"
              onClick={() => navigator.clipboard.writeText(c.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        <div className="card-b">
          {edit ? (
            <textarea id="s-code" className="input mono" rows={16} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} spellCheck={false} />
          ) : (
            <pre className="mono" style={{ margin: 0, padding: 14, background: "var(--sidebar)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, overflowX: "auto", fontSize: 12.5, lineHeight: 1.6 }}>
              {c.code}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
