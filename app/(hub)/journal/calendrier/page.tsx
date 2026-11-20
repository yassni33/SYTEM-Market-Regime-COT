"use client";
import { useEffect, useMemo, useState } from "react";
import { AccountSelect } from "@/components/journal/AccountBar";
import TradeForm from "@/components/journal/TradeForm";
import { useJournal } from "@/components/journal/useJournal";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { tradeDay, type Trade } from "@/lib/journal";
import { dayKey, money, signedMoney } from "@/lib/format";
import { MONTHS_LONG } from "@/lib/markets";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PnlCalendar() {
  const j = useJournal();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Trade | null>(null);

  useEffect(() => {
    supabaseBrowser()
      .from("day_notes")
      .select("day, note")
      .then(({ data }) => setNotes(Object.fromEntries((data ?? []).map((r) => [r.day, r.note]))));
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of j.filtered) {
      const k = tradeDay(t);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [j.filtered]);

  // Grille du mois : semaines de lundi à dimanche
  const weeks = useMemo(() => {
    const first = new Date(month);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const out: Date[][] = [];
    const cur = new Date(start);
    while (out.length < 6) {
      const w: Date[] = [];
      for (let i = 0; i < 7; i++) {
        w.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      out.push(w);
      if (cur.getMonth() !== month.getMonth()) break;
    }
    return out;
  }, [month]);

  const monthTrades = j.filtered.filter((t) => tradeDay(t).slice(0, 7) === dayKey(month).slice(0, 7));
  const monthPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
  const ccy = j.currency;
  const today = dayKey(new Date());

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>P&L calendar</h1>
          <p>Your result day by day. Click a day to see its trades and write the daily note.</p>
        </div>
        <AccountSelect j={j} />
      </div>

      <div className={`grid ${selected ? "split" : ""}`}>
        <section className="card" style={{ minWidth: 0 }}>
          <div className="card-h">
            <div className="row">
              <button className="btn btn-sm" onClick={() => shift(-1)} aria-label="Previous month">←</button>
              <h2 style={{ minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>
                {MONTHS_LONG[month.getMonth()]} {month.getFullYear()}
              </h2>
              <button className="btn btn-sm" onClick={() => shift(1)} aria-label="Next month">→</button>
            </div>
            <div className="row">
              <span className="muted small">{monthTrades.length} trades</span>
              <b className={`num ${monthPnl >= 0 ? "up" : "down"}`}>{signedMoney(monthPnl, ccy)}</b>
            </div>
          </div>
          <div className="tbl-wrap">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(78px, 1fr)) minmax(88px, 1fr)", gap: 4, padding: 10, minWidth: 700 }}>
              {[...WEEKDAYS, "Week"].map((d) => (
                <div key={d} className="label" style={{ textAlign: "center", padding: "2px 0 6px" }}>{d}</div>
              ))}
              {weeks.map((w, wi) => {
                const weekTrades = w.flatMap((d) => (d.getMonth() === month.getMonth() ? byDay.get(dayKey(d)) ?? [] : []));
                const wp = weekTrades.reduce((s, t) => s + t.pnl, 0);
                return (
                  <div key={wi} style={{ display: "contents" }}>
                    {w.map((d) => {
                      const k = dayKey(d);
                      const ts = byDay.get(k) ?? [];
                      const p = ts.reduce((s, t) => s + t.pnl, 0);
                      const inMonth = d.getMonth() === month.getMonth();
                      const bg = !ts.length ? "var(--card)" : p > 0 ? "var(--up-soft)" : p < 0 ? "var(--down-soft)" : "var(--neutral-soft)";
                      return (
                        <button
                          key={k}
                          onClick={() => setSelected(k)}
                          style={{
                            minHeight: 82, textAlign: "left", padding: 8, borderRadius: 8, cursor: "pointer",
                            border: selected === k ? "2px solid var(--accent)" : "1px solid var(--line)",
                            background: bg, opacity: inMonth ? 1 : 0.4, display: "flex", flexDirection: "column", gap: 2,
                          }}
                        >
                          <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
                            <span className="small num" style={{ fontWeight: k === today ? 700 : 400, color: k === today ? "var(--accent)" : "var(--muted)" }}>{d.getDate()}</span>
                            {notes[k] && <span title="Daily note" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)" }} />}
                          </div>
                          {ts.length > 0 && (
                            <>
                              <span className={`num ${p >= 0 ? "up" : "down"}`} style={{ fontWeight: 600, fontSize: 13 }}>{signedMoney(p, ccy, 0)}</span>
                              <span className="small muted">{ts.length} trade{ts.length > 1 ? "s" : ""}</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                    <div style={{ padding: 8, borderRadius: 8, background: "var(--bg)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <span className="small muted">Week {wi + 1}</span>
                      <span className={`num ${wp > 0 ? "up" : wp < 0 ? "down" : "muted"}`} style={{ fontWeight: 600 }}>{weekTrades.length ? signedMoney(wp, ccy, 0) : "—"}</span>
                      <span className="small muted">{weekTrades.length ? `${weekTrades.length} trades` : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {selected && (
          <DayPanel
            day={selected}
            trades={byDay.get(selected) ?? []}
            note={notes[selected] ?? ""}
            ccy={ccy}
            onClose={() => setSelected(null)}
            onNote={(v) => setNotes((n) => ({ ...n, [selected]: v }))}
            onOpen={setEditing}
          />
        )}
      </div>

      {editing && (
        <TradeForm
          accounts={j.accounts}
          trade={editing}
          setups={[...new Set(j.trades.map((t) => t.setup).filter(Boolean) as string[])]}
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

function DayPanel({
  day, trades, note, ccy, onClose, onNote, onOpen,
}: {
  day: string; trades: Trade[]; note: string; ccy: string;
  onClose: () => void; onNote: (v: string) => void; onOpen: (t: Trade) => void;
}) {
  const [text, setText] = useState(note);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    setText(note);
    setStatus(null);
  }, [day, note]);

  async function save() {
    const { error } = await supabaseBrowser().from("day_notes").upsert({ day, note: text });
    if (error) return setStatus(`Error: ${error.message}`);
    onNote(text);
    setStatus("Note saved");
  }
  const p = trades.reduce((s, t) => s + t.pnl, 0);
  return (
    <aside className="card" style={{ alignSelf: "start" }}>
      <div className="card-h">
        <h2 style={{ textTransform: "capitalize" }}>
          {new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <button className="btn btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="card-b stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">{trades.length} trade(s)</span>
          <b className={`num ${p >= 0 ? "up" : "down"}`}>{signedMoney(p, ccy)}</b>
        </div>
        {trades.map((t) => (
          <button key={t.id} className="btn" style={{ justifyContent: "space-between", width: "100%" }} onClick={() => onOpen(t)}>
            <span><b className="mono">{t.market}</b> <span className={`tag ${t.side === "Long" ? "tag-up" : "tag-down"}`}>{t.side}</span> <span className="small muted">{t.setup}</span></span>
            <span className={`num ${t.pnl >= 0 ? "up" : "down"}`}>{money(t.pnl, ccy)}</span>
          </button>
        ))}
        <label className="field">
          <span>Daily note</span>
          <textarea id="day-note" className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="How did the day go? Did you follow the plan? Mindset, lesson of the day…" />
        </label>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="small muted">{status}</span>
          <button className="btn btn-primary" onClick={save}>Save note</button>
        </div>
      </div>
    </aside>
  );
}
