"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FfEvent } from "@/lib/sources";
import { ageText } from "@/lib/format";

const NY = "America/New_York";
const MA = "Africa/Casablanca";
const IMPACTS = [
  { key: "High", label: "High", cls: "tag-down" },
  { key: "Medium", label: "Medium", cls: "tag-warn" },
  { key: "Low", label: "Low", cls: "" },
  { key: "Holiday", label: "Holiday", cls: "" },
];
const CCYS = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "CNY"];

function nyParts(iso: string) {
  const d = new Date(iso);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const hm = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });

export default function NewsPage() {
  const [events, setEvents] = useState<FfEvent[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [impacts, setImpacts] = useState<string[]>(["High", "Medium"]);
  const [ccys, setCcys] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      setEvents(json.events);
      setFetchedAt(json.fetchedAt);
      setError(json.error ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = (list: string[], set: (v: string[]) => void, k: string) =>
    set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  const filtered = useMemo(
    () =>
      (events ?? [])
        .filter((e) => impacts.includes(e.impact) && (ccys.length === 0 || ccys.includes(e.country)))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    [events, impacts, ccys],
  );

  // Alerte : news forte entre 02h00 et 09h30 heure de New York (sessions de Londres / pré-ouverture NY)
  const alerts = useMemo(
    () =>
      (events ?? []).filter((e) => {
        if (e.impact !== "High") return false;
        if (ccys.length && !ccys.includes(e.country)) return false;
        const { minutes } = nyParts(e.date);
        return minutes >= 120 && minutes <= 570 && Date.parse(e.date) > now - 3600000;
      }).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)),
    [events, ccys, now],
  );

  const days = useMemo(() => {
    const g = new Map<string, FfEvent[]>();
    for (const e of filtered) {
      const k = nyParts(e.date).day;
      g.set(k, [...(g.get(k) ?? []), e]);
    }
    return [...g.entries()];
  }, [filtered]);

  const todayNy = nyParts(new Date(now).toISOString()).day;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>News calendar</h1>
          <p>This week (ForexFactory), in New York time and Morocco time.</p>
        </div>
        <div className="row">
          {fetchedAt && <span className="small muted">Updated {ageText(fetchedAt)}</span>}
          <button className="btn" onClick={() => load(true)} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="notice err">{error}</div>}

      {alerts.length > 0 && (
        <div className="notice" role="alert" style={{ alignItems: "flex-start" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
            <path d="M12 3l10 18H2zM12 10v5M12 18h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <b>High-impact news during your trading window (02:00–09:30 NY)</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {alerts.map((e, i) => (
                <li key={i}>
                  {new Date(e.date).toLocaleDateString("en-US", { weekday: "long", timeZone: NY })} {hm(e.date, NY)} NY ({hm(e.date, MA)} Morocco) · <b>{e.country}</b> {e.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="card card-b stack" style={{ gap: 12 }}>
        <div className="row">
          <span className="label" style={{ width: 90 }}>Impact</span>
          {IMPACTS.map((i) => (
            <button key={i.key} className={`chip ${impacts.includes(i.key) ? "on" : ""}`} onClick={() => toggle(impacts, setImpacts, i.key)}>
              {i.label}
            </button>
          ))}
        </div>
        <div className="row">
          <span className="label" style={{ width: 90 }}>Currencies</span>
          <button className={`chip ${ccys.length === 0 ? "on" : ""}`} onClick={() => setCcys([])}>All</button>
          {CCYS.map((c) => (
            <button key={c} className={`chip ${ccys.includes(c) ? "on" : ""}`} onClick={() => toggle(ccys, setCcys, c)}>{c}</button>
          ))}
        </div>
      </div>

      {!events && loading && <div className="card card-b"><div className="skeleton" style={{ height: 200 }} /></div>}
      {events && days.length === 0 && <div className="card empty">No news for these filters.</div>}

      {days.map(([day, list]) => (
        <section key={day} className="card">
          <div className="card-h">
            <h2 style={{ textTransform: "capitalize" }}>
              {new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h2>
            {day === todayNy && <span className="tag tag-accent">Today</span>}
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>NY time</th>
                  <th>Morocco</th>
                  <th>Currency</th>
                  <th>Impact</th>
                  <th>Event</th>
                  <th className="r">Forecast</th>
                  <th className="r">Previous</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const imp = IMPACTS.find((x) => x.key === e.impact);
                  const past = Date.parse(e.date) < now;
                  const { minutes } = nyParts(e.date);
                  const inWindow = e.impact === "High" && minutes >= 120 && minutes <= 570;
                  const allDay = minutes === 0 && e.impact === "Holiday";
                  return (
                    <tr key={i} style={{ opacity: past ? 0.5 : 1, background: inWindow ? "var(--warn-soft)" : undefined }}>
                      <td className="num" style={{ fontWeight: 600 }}>{allDay ? "All day" : hm(e.date, NY)}</td>
                      <td className="num muted">{allDay ? "—" : hm(e.date, MA)}</td>
                      <td className="mono" style={{ fontWeight: 600 }}>{e.country}</td>
                      <td><span className={`tag ${imp?.cls ?? ""}`}>{imp?.label ?? e.impact}</span></td>
                      <td style={{ whiteSpace: "normal", minWidth: 220 }}>{e.title}</td>
                      <td className="r num">{e.forecast || "—"}</td>
                      <td className="r num muted">{e.previous || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
