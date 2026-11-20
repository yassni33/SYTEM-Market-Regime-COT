// Yassni's ACR Range indicator for TradingView, kept exactly as provided (do not edit the code below).
// String.raw keeps every character as-is; the code contains no backtick and no "${".
export const ACR_PINE = String.raw`// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0
// ACR Range — Yassni
// Stratégie :
//   1) Range Asie (par défaut 20h00–00h00 New York) -> haut et bas = liquidité "Asia R LQ"
//   0) Vous choisissez la tendance du jour : haussière = sweep du BAS puis achat ; baissière = sweep du HAUT puis vente
//   1b) Zone du sweep : 02h00 (open de Francfort) → 09h00 New York ; le TC doit être validé avant 09h30 (open de New York)
//   2) En H1 : une bougie fait un SWEEP (elle passe au-delà du haut ou du bas de l'Asie, clôture n'importe où)
//   3) On attend la clôture de cette bougie H1
//   4) En M5 : ligne TC = dernier creux (pour une vente) / dernier sommet (pour un achat) avant l'extrême du sweep
//   5) Signal quand une bougie M5 CLÔTURE avec son corps au-delà de la ligne TC (une mèche ne compte pas)
//   6) Entrée à la clôture, SL au-delà de l'extrême du sweep, TP = 3 fois le risque (ou l'autre côté du range Asie)
//   7) La position est dessinée : zone rouge (SL), zone bleue (TP), étiquettes SELL/BUY, SL et TP
// À utiliser sur un graphique M5 (fonctionne de M1 à M15).

//@version=6
indicator("ACR Range — Yassni", overlay = true, max_lines_count = 500, max_labels_count = 500, max_boxes_count = 200)

// ───────── Réglages ─────────
grpS = "Sessions (heure de New York)"
asiaSess   = input.session("2000-2359", "Range Asie", group = grpS, tooltip = "20h00–00h00 New York par défaut")
sweepSess  = input.session("0200-0900", "Zone du sweep (open Francfort → 09h00)", group = grpS, tooltip = "La bougie H1 qui fait le sweep doit commencer dans cette zone (02h00–09h00 New York)")
tradeSess  = input.session("0200-0930", "Validation du TC (jusqu'à l'open de New York)", group = grpS, tooltip = "Le TC en M5 doit être validé avant 09h30 New York")
tz         = "America/New_York"

grpB = "Tendance (votre analyse)"
bias       = input.string("Haussière : achats seulement", "Tendance du jour", options = ["Haussière : achats seulement", "Baissière : ventes seulement", "Les deux"], group = grpB, tooltip = "Haussière : on attend le sweep du BAS de l'Asie puis le TC achat. Baissière : on attend le sweep du HAUT de l'Asie puis le TC vente.")
allowBuy   = bias != "Baissière : ventes seulement"
allowSell  = bias != "Haussière : achats seulement"

grpT = "Signal"
htf        = input.timeframe("60", "Unité du sweep (HTF)", group = grpT)
pivLen     = input.int(2, "Force des creux/sommets M5 (bougies de chaque côté)", minval = 1, maxval = 10, group = grpT)
needBody   = input.bool(true, "TC valide seulement si le CORPS clôture au-delà", group = grpT)
needInside = input.bool(false, "La bougie H1 doit clôturer dans le range (option)", group = grpT, tooltip = "Désactivé par défaut : il suffit que la bougie H1 passe le haut ou le bas de l'Asie, puis on attend sa clôture")
oneSignal  = input.bool(true, "Un seul signal par côté et par jour", group = grpT)

grpR = "Position (entrée, SL, TP)"
slBufTicks = input.int(5, "Marge du stop au-delà du sweep (ticks)", minval = 0, group = grpR)
tpMode     = input.string("R fixe", "Objectif (TP)", options = ["R fixe", "Autre côté de l'Asie"], group = grpR)
rrTarget   = input.float(3.0, "Ratio risque / gain (TP = X fois le risque)", minval = 0.5, step = 0.5, group = grpR)
showTrade  = input.bool(true, "Dessiner la position (zones SL et TP)", group = grpR)
maxBars    = input.int(150, "Longueur max de la position (bougies)", minval = 10, group = grpR)
cRisk      = input.color(color.new(color.red, 75), "Zone SL", group = grpR)
cRew       = input.color(color.new(color.blue, 75), "Zone TP", group = grpR)

grpV = "Affichage"
showBox    = input.bool(true, "Boîte du range Asie", group = grpV)
showMid    = input.bool(true, "Ligne 50 % du range Asie", group = grpV)
cBox       = input.color(color.new(color.gray, 85), "Couleur boîte Asie", group = grpV)
cLQ        = input.color(color.purple, "Couleur Asia R LQ", group = grpV)
cMid       = input.color(color.blue, "Couleur 50 %", group = grpV)
cEnd       = input.color(color.aqua, "Couleur fin d'Asie", group = grpV)
cTC        = input.color(color.black, "Couleur ligne TC", group = grpV)
keepHours  = input.int(24, "Effacer les dessins plus vieux que (heures)", minval = 0, group = grpV, tooltip = "24 = on ne garde que les signaux des dernières 24 heures. 0 = tout garder")

// ───────── Sessions ─────────
inAsia    = not na(time(timeframe.period, asiaSess, tz))
inWin     = not na(time(timeframe.period, tradeSess, tz))
inSweep   = not na(time(timeframe.period, sweepSess, tz))
asiaStart = inAsia and not inAsia[1]
asiaEnd   = not inAsia and inAsia[1]

// ───────── État du jour ─────────
var float asiaH = na
var float asiaL = na
var int   asiaStartBar = na
var int   asiaEndBar = na
var bool  asiaDone = false
var box   asiaBox = na
var line  lqHigh = na
var line  lqLow  = na
var line  midLn  = na

// Vente (sweep du HAUT)
var bool  sArm = false
var bool  sDone = false
var float sTC = na
var float sExt = na
var line  sTCln = na
// Achat (sweep du BAS)
var bool  lArm = false
var bool  lDone = false
var float lTC = na
var float lExt = na
var line  lTCln = na

if asiaStart
    asiaH := high
    asiaL := low
    asiaStartBar := bar_index
    asiaDone := false
    sArm := false
    sDone := false
    lArm := false
    lDone := false
else if inAsia
    asiaH := math.max(asiaH, high)
    asiaL := math.min(asiaL, low)

if asiaEnd and not na(asiaH)
    asiaDone := true
    asiaEndBar := bar_index
    if showBox
        asiaBox := box.new(asiaStartBar, asiaH, bar_index - 1, asiaL, border_color = color.new(color.gray, 60), bgcolor = cBox, text = "ASIA", text_color = color.new(color.gray, 40), text_size = size.large)
    line.new(bar_index, asiaH, bar_index, asiaL, color = cEnd, width = 1)
    lqHigh := line.new(bar_index, asiaH, bar_index + 1, asiaH, color = cLQ, width = 2)
    lqLow  := line.new(bar_index, asiaL, bar_index + 1, asiaL, color = cLQ, width = 2)
    label.new(bar_index, asiaH, "Asia R LQ", style = label.style_label_lower_left, color = color.new(color.white, 100), textcolor = cLQ, size = size.small)
    label.new(bar_index, asiaL, "Asia R LQ", style = label.style_label_upper_left, color = color.new(color.white, 100), textcolor = cLQ, size = size.small)
    if showMid
        midLn := line.new(bar_index, (asiaH + asiaL) / 2, bar_index + 1, (asiaH + asiaL) / 2, color = cMid, style = line.style_dotted)

// Prolonge les lignes pendant la fenêtre de trading
if asiaDone and inWin
    if not na(lqHigh)
        line.set_x2(lqHigh, bar_index)
    if not na(lqLow)
        line.set_x2(lqLow, bar_index)
    if not na(midLn)
        line.set_x2(midLn, bar_index)

// ───────── Bougie HTF (H1) construite à partir des bougies M5 ─────────
htfOpenTime = time(htf)
newHtf = htfOpenTime != htfOpenTime[1]

var float hO = na
var float hH = na
var float hL = na
var int   hHb = na
var int   hLb = na
var int   hT = na
var bool  hWin = false

// Bougie HTF qui vient de se terminer (valeurs avant la remise à zéro)
float cH = na
float cL = na
float cC = na
int   cHb = na
int   cLb = na
int   cT = na
bool  cWin = false

if newHtf
    cH := hH
    cL := hL
    cC := close[1]
    cHb := hHb
    cLb := hLb
    cT := hT
    cWin := hWin
    hO := open
    hH := high
    hL := low
    hHb := bar_index
    hLb := bar_index
    hT := time
    hWin := inSweep
else
    if high > hH
        hH := high
        hHb := bar_index
    if low < hL
        hL := low
        hLb := bar_index

// ───────── Creux / sommets M5 (pour la ligne TC) ─────────
var array<float> plP = array.new<float>()
var array<int>   plI = array.new<int>()
var array<float> phP = array.new<float>()
var array<int>   phI = array.new<int>()

pl = ta.pivotlow(low, pivLen, pivLen)
ph = ta.pivothigh(high, pivLen, pivLen)
if not na(pl)
    array.push(plP, pl)
    array.push(plI, bar_index - pivLen)
    if array.size(plP) > 60
        array.shift(plP)
        array.shift(plI)
if not na(ph)
    array.push(phP, ph)
    array.push(phI, bar_index - pivLen)
    if array.size(phP) > 60
        array.shift(phP)
        array.shift(phI)

// Dernier pivot avant une bougie donnée -> [prix, index]
lastBefore(array<float> ps, array<int> idxs, int idx) =>
    float p = na
    int   i = na
    int n = array.size(ps)
    if n > 0
        for k = n - 1 to 0
            if array.get(idxs, k) < idx
                p := array.get(ps, k)
                i := array.get(idxs, k)
                break
    [p, i]

// ───────── Détection du sweep H1 (à la clôture de la bougie H1) ─────────
htfAfterAsia = asiaDone and not na(cT) and not na(asiaEndBar) and cHb >= asiaEndBar and not inAsia and cWin
sweepHigh = allowSell and newHtf and htfAfterAsia and inWin and cH > asiaH and (not needInside or cC < asiaH)
sweepLow  = allowBuy and newHtf and htfAfterAsia and inWin and cL < asiaL and (not needInside or cC > asiaL)

if sweepHigh and not sArm and not (oneSignal and sDone)
    [p, i] = lastBefore(plP, plI, cHb)
    if not na(p)
        sArm := true
        sTC := p
        sExt := cH
        sTCln := line.new(i, p, bar_index, p, color = cTC, width = 2)
        label.new(bar_index, p, "TC", style = label.style_label_left, color = color.new(color.white, 100), textcolor = color.red, size = size.small)
        label.new(cHb, cH, "Sweep H1", style = label.style_label_down, color = color.new(color.red, 80), textcolor = color.red, size = size.tiny)

if sweepLow and not lArm and not (oneSignal and lDone)
    [p, i] = lastBefore(phP, phI, cLb)
    if not na(p)
        lArm := true
        lTC := p
        lExt := cL
        lTCln := line.new(i, p, bar_index, p, color = cTC, width = 2)
        label.new(bar_index, p, "TC", style = label.style_label_left, color = color.new(color.white, 100), textcolor = color.red, size = size.small)
        label.new(cLb, cL, "Sweep H1", style = label.style_label_up, color = color.new(color.green, 80), textcolor = color.green, size = size.tiny)

// ───────── Validation du TC en M5 + position ─────────
bool sellSig = false
bool buySig  = false
tick = syminfo.mintick

// Position en cours (une à la fois)
var int   tDir = 0          // -1 vente, +1 achat, 0 aucune
var float tEntry = na
var float tSL = na
var float tTP = na
var int   tStart = na
var box   tRiskBx = na
var box   tRewBx = na
var label tSLlb = na
var label tTPlb = na

fmt(float v) => str.tostring(v, format.mintick)

openPos(int d, float entry, float sl, float tp) =>
    box rb = na
    box wb = na
    label ls = na
    label lt = na
    if showTrade
        rb := box.new(bar_index, d < 0 ? sl : entry, bar_index + 1, d < 0 ? entry : sl, border_color = color.new(color.red, 40), bgcolor = cRisk)
        wb := box.new(bar_index, d < 0 ? entry : tp, bar_index + 1, d < 0 ? tp : entry, border_color = color.new(color.blue, 40), bgcolor = cRew)
        label.new(bar_index, entry, (d < 0 ? "SELL " : "BUY ") + fmt(entry), style = label.style_label_right, color = d < 0 ? color.red : color.green, textcolor = color.white, size = size.small)
        ls := label.new(bar_index + 1, sl, "SL " + fmt(sl), style = label.style_label_left, color = color.red, textcolor = color.white, size = size.small)
        lt := label.new(bar_index + 1, tp, "TP " + fmt(tp), style = label.style_label_left, color = color.blue, textcolor = color.white, size = size.small)
    [rb, wb, ls, lt]

// Suivi de la position ouverte : prolonge les zones jusqu'au TP ou au SL
if tDir != 0 and bar_index > tStart
    bool hitSL = tDir < 0 ? high >= tSL : low <= tSL
    bool hitTP = tDir < 0 ? low <= tTP : high >= tTP
    bool tooLong = bar_index - tStart >= maxBars
    if showTrade
        box.set_right(tRiskBx, bar_index)
        box.set_right(tRewBx, bar_index)
        label.set_x(tSLlb, bar_index)
        label.set_x(tTPlb, bar_index)
    if hitSL or hitTP or tooLong
        string res = hitSL ? "SL touché" : hitTP ? "TP touché ✓" : "Fermée (temps)"
        color rc = hitSL ? color.red : hitTP ? color.green : color.gray
        if showTrade
            label.new(bar_index, hitSL ? tSL : hitTP ? tTP : close, res, style = label.style_label_left, color = color.new(rc, 85), textcolor = rc, size = size.tiny)
        tDir := 0

if sArm
    sExt := math.max(sExt, high)
    line.set_x2(sTCln, bar_index)
    if not inWin
        sArm := false
    else if (needBody ? close < sTC : low < sTC) and tDir == 0
        sellSig := true
        sArm := false
        sDone := true
        entry = needBody ? close : sTC
        sl = sExt + slBufTicks * tick
        risk = sl - entry
        tp = tpMode == "R fixe" or asiaL >= entry ? entry - rrTarget * risk : asiaL
        [rb, wb, ls, lt] = openPos(-1, entry, sl, tp)
        tDir := -1
        tEntry := entry
        tSL := sl
        tTP := tp
        tStart := bar_index
        tRiskBx := rb
        tRewBx := wb
        tSLlb := ls
        tTPlb := lt
        alert("ACR SELL " + syminfo.ticker + " | entrée " + fmt(entry) + " | SL " + fmt(sl) + " | TP " + fmt(tp), alert.freq_once_per_bar_close)

if lArm
    lExt := math.min(lExt, low)
    line.set_x2(lTCln, bar_index)
    if not inWin
        lArm := false
    else if (needBody ? close > lTC : high > lTC) and tDir == 0
        buySig := true
        lArm := false
        lDone := true
        entry = needBody ? close : lTC
        sl = lExt - slBufTicks * tick
        risk = entry - sl
        tp = tpMode == "R fixe" or asiaH <= entry ? entry + rrTarget * risk : asiaH
        [rb, wb, ls, lt] = openPos(1, entry, sl, tp)
        tDir := 1
        tEntry := entry
        tSL := sl
        tTP := tp
        tStart := bar_index
        tRiskBx := rb
        tRewBx := wb
        tSLlb := ls
        tTPlb := lt
        alert("ACR BUY " + syminfo.ticker + " | entrée " + fmt(entry) + " | SL " + fmt(sl) + " | TP " + fmt(tp), alert.freq_once_per_bar_close)

plotshape(sellSig, "Vente ACR", shape.triangledown, location.abovebar, color.red, size = size.small, text = "SELL", show_last = keepHours > 0 ? keepHours * 12 : 100000)
plotshape(buySig, "Achat ACR", shape.triangleup, location.belowbar, color.green, size = size.small, text = "BUY", show_last = keepHours > 0 ? keepHours * 12 : 100000)

// ───────── Nettoyage : efface les dessins de plus de X heures ─────────
if keepHours > 0 and (newHtf or barstate.islast)
    int barsKeep = math.max(1, math.round(keepHours * 3600 / timeframe.in_seconds()))
    int cutoff = bar_index - barsKeep
    // Les dessins encore actifs (position en cours, ligne TC armée) sont prolongés à chaque bougie, donc jamais effacés
    for ln in array.copy(line.all)
        if math.max(line.get_x1(ln), line.get_x2(ln)) < cutoff
            line.delete(ln)
    for lb in array.copy(label.all)
        if label.get_x(lb) < cutoff
            label.delete(lb)
    for bx in array.copy(box.all)
        if box.get_right(bx) < cutoff
            box.delete(bx)

alertcondition(sellSig, "ACR Vente", "ACR : vente validée (TC cassé par le corps)")
alertcondition(buySig, "ACR Achat", "ACR : achat validé (TC cassé par le corps)")
alertcondition(sweepHigh or sweepLow, "ACR Sweep H1", "ACR : sweep H1 du range Asie, surveiller le TC en M5")

// Rappel de la tendance choisie
var table biasTbl = table.new(position.top_right, 1, 2)
if barstate.islast
    table.cell(biasTbl, 0, 0, "ACR · " + bias, bgcolor = allowBuy and not allowSell ? color.new(color.green, 20) : allowSell and not allowBuy ? color.new(color.red, 20) : color.new(color.gray, 20), text_color = color.white, text_size = size.small)

// Avertissement si l'unité du graphique est trop grande
if barstate.islast and timeframe.in_seconds() > 900
    table.cell(biasTbl, 0, 1, "ACR Range : mettez le graphique en M5 (M1–M15)", bgcolor = color.new(color.orange, 20), text_color = color.white)`;
