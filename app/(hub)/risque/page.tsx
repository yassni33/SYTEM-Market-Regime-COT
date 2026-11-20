"use client";
import { useEffect, useMemo, useState } from "react";
import type { Analysis } from "@/lib/analysis";
import { CURRENCIES, FX_PAIRS, pipSize, priceDecimals } from "@/lib/markets";
import { money, num } from "@/lib/format";

type Instrument = "fx" | "gold" | "index";
const parse = (s: string) => {
  const v = Number(s.replace(/[\s,]/g, "")); // English input: "100,000" = 100000, dot for decimals
  return isFinite(v) ? v : NaN;
};

export default function RiskCalculator() {
  const [balance, setBalance] = useState("100000");
  const [acct, setAcct] = useState("USD");
  const [riskMode, setRiskMode] = useState<"pct" | "amount">("pct");
  const [risk, setRisk] = useState("1");
  const [instrument, setInstrument] = useState<Instrument>("fx");
  const [pair, setPair] = useState("EURUSD");
  const [pointValue, setPointValue] = useState("1");
  const [slMode, setSlMode] = useState<"pips" | "price">("pips");
  const [slPips, setSlPips] = useState("20");
  const [entry, setEntry] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [ratio, setRatio] = useState("2");
  const [usdPer, setUsdPer] = useState<Record<string, number> | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [rateErr, setRateErr] = useState<string | null>(null);

  // Taux de change : on réutilise les prix de la page Market Regime (cache cloud).
  useEffect(() => {
    fetch("/api/market")
      .then((r) => r.json())
      .then((a: Analysis & { error?: string }) => {
        if (a.error) throw new Error(a.error);
        const p: Record<string, number> = {};
        a.markets.forEach((m) => (p[m.symbol] = m.price));
        const u: Record<string, number> = { USD: 1 };
        for (const c of CURRENCIES) {
          if (c === "USD") continue;
          if (p[c + "USD"]) u[c] = p[c + "USD"];
          else if (p["USD" + c]) u[c] = 1 / p["USD" + c];
        }
        setUsdPer(u);
        setPrices(p);
      })
      .catch((e) => setRateErr(`Exchange rates unavailable (${e.message}). Non-USD calculations are disabled.`));
  }, []);

  // Pré-remplir le prix d'entrée avec le dernier prix connu
  useEffect(() => {
    if (instrument === "fx" && prices[pair] && slMode === "price" && !entry) setEntry(prices[pair].toFixed(priceDecimals(pair)));
  }, [pair, prices, slMode, instrument, entry]);

  const r = useMemo(() => {
    const bal = parse(balance);
    const riskMoney = riskMode === "pct" ? (bal * parse(risk)) / 100 : parse(risk);
    const pip = instrument === "fx" ? pipSize(pair) : instrument === "gold" ? 0.1 : 1;
    const quote = instrument === "fx" ? pair.slice(3) : "USD";
    // Valeur d'un pip pour 1 lot standard, dans la devise de cotation
    let pipValueLot: number;
    if (instrument === "index") pipValueLot = parse(pointValue); // already in the account currency
    else {
      const raw = instrument === "fx" ? pip * 100000 : 0.1 * 100; // or : 100 onces
      if (quote === acct) pipValueLot = raw;
      else if (usdPer?.[quote] && usdPer?.[acct]) pipValueLot = (raw * usdPer[quote]) / usdPer[acct];
      else pipValueLot = NaN;
    }
    let dist: number;
    let tpPrice: number | null = null;
    let direction: "Long" | "Short" | null = null;
    if (slMode === "pips") dist = parse(slPips);
    else {
      const e = parse(entry), s = parse(slPrice);
      dist = Math.abs(e - s) / pip;
      if (isFinite(e) && isFinite(s) && e !== s) {
        direction = s < e ? "Long" : "Short";
        tpPrice = direction === "Long" ? e + Math.abs(e - s) * parse(ratio) : e - Math.abs(e - s) * parse(ratio);
      }
    }
    const rawLots = riskMoney / (dist * pipValueLot);
    const lots = Math.floor(rawLots * 100 + 1e-9) / 100;
    const risked = lots * dist * pipValueLot;
    return {
      riskMoney, pip, pipValueLot, dist, lots, risked, gain: risked * parse(ratio),
      pipValue: lots * pipValueLot, tpPrice, direction,
      ok: isFinite(lots) && lots > 0,
      tooSmall: isFinite(rawLots) && rawLots > 0 && rawLots < 0.01,
    };
  }, [balance, riskMode, risk, instrument, pair, pointValue, slMode, slPips, entry, slPrice, ratio, acct, usdPer]);

  const dec = instrument === "fx" ? priceDecimals(pair) : 2;
  const unit = instrument === "index" ? "points" : "pips";

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <h1>Risk calculator</h1>
          <p>The right lot size so you never risk more than planned. Lot size rounded down to 0.01.</p>
        </div>
      </div>
      {rateErr && <div className="notice">{rateErr}</div>}

      <div className="grid split">
        <section className="card">
          <div className="card-h"><h2>Settings</h2></div>
          <div className="card-b stack">
            <div className="form-grid">
              <label className="field">
                <span>Account balance</span>
                <input id="r-balance" className="input num" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
              </label>
              <label className="field">
                <span>Account currency</span>
                <select id="r-acct" className="input" value={acct} onChange={(e) => setAcct(e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div className="field">
                <span>Risk</span>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <div className="seg">
                    <button className={riskMode === "pct" ? "on" : ""} onClick={() => setRiskMode("pct")}>%</button>
                    <button className={riskMode === "amount" ? "on" : ""} onClick={() => setRiskMode("amount")}>{acct}</button>
                  </div>
                  <input id="r-risk" className="input num" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Instrument</span>
                <select id="r-instrument" className="input" value={instrument} onChange={(e) => setInstrument(e.target.value as Instrument)}>
                  <option value="fx">Forex pair</option>
                  <option value="gold">Gold (XAUUSD)</option>
                  <option value="index">Index (manual value)</option>
                </select>
              </label>
              {instrument === "fx" && (
                <label className="field">
                  <span>Pair</span>
                  <select id="r-pair" className="input mono" value={pair} onChange={(e) => { setPair(e.target.value); setEntry(""); }}>
                    {FX_PAIRS.map((p) => <option key={p.symbol}>{p.symbol}</option>)}
                  </select>
                </label>
              )}
              {instrument === "index" && (
                <label className="field">
                  <span>Value of 1 point per lot ({acct})</span>
                  <input id="r-point" className="input num" inputMode="decimal" value={pointValue} onChange={(e) => setPointValue(e.target.value)} />
                </label>
              )}
              {instrument === "gold" && (
                <div className="field"><span>Contract</span><div className="small muted" style={{ paddingTop: 8 }}>1 lot = 100 oz · 1 pip = $0.10</div></div>
              )}
            </div>

            <div className="form-grid">
              <div className="field">
                <span>Stop loss</span>
                <div className="seg">
                  <button className={slMode === "pips" ? "on" : ""} onClick={() => setSlMode("pips")}>In {unit}</button>
                  <button className={slMode === "price" ? "on" : ""} onClick={() => setSlMode("price")}>By price</button>
                </div>
              </div>
              {slMode === "pips" ? (
                <label className="field">
                  <span>SL distance ({unit})</span>
                  <input id="r-slpips" className="input num" inputMode="decimal" value={slPips} onChange={(e) => setSlPips(e.target.value)} />
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Entry price</span>
                    <input id="r-entry" className="input num" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>SL price</span>
                    <input id="r-slprice" className="input num" inputMode="decimal" value={slPrice} onChange={(e) => setSlPrice(e.target.value)} />
                  </label>
                </>
              )}
              <label className="field">
                <span>TP ratio (R)</span>
                <input id="r-ratio" className="input num" inputMode="decimal" value={ratio} onChange={(e) => setRatio(e.target.value)} />
              </label>
            </div>
          </div>
        </section>

        <section className="card" style={{ alignSelf: "start", borderTop: "4px solid var(--accent)" }}>
          <div className="card-b stack">
            <div>
              <div className="label">Lot size</div>
              <div className="num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1, color: "var(--accent)" }}>
                {r.ok ? num(r.lots, 2) : "—"}
              </div>
              {r.tooSmall && <div className="small down">Risk too small for 0.01 lot with this stop.</div>}
            </div>
            {[
              ["Money at risk", money(r.ok ? r.risked : NaN, acct), "down"],
              ["Profit at TP", money(r.ok ? r.gain : NaN, acct), "up"],
              ["Pip value (this lot size)", money(r.ok ? r.pipValue : NaN, acct), ""],
              ["Pip value (1 lot)", money(r.pipValueLot, acct), ""],
              ["Target risk", money(r.riskMoney, acct), ""],
              ["SL distance", isFinite(r.dist) ? `${num(r.dist, 1)} ${unit}` : "—", ""],
            ].map(([l, v, t]) => (
              <div key={l} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                <span className="muted">{l}</span>
                <b className={`num ${t}`}>{v}</b>
              </div>
            ))}
            {r.tpPrice != null && (
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">TP price ({r.direction})</span>
                <b className="num">{num(r.tpPrice, dec)}</b>
              </div>
            )}
            <p className="small muted">
              Money at risk can be slightly below your target risk because the lot size is rounded down. Check the pip
              value with your broker (contract size, commissions).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
