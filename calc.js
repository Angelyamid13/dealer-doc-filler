/* DealerDoc Filler v2 — pure calculation module (no DOM).
   Shared by app.js (browser) and /tmp/dealer-v2-tests.mjs (node).
   All money math rounds to cents at display time via money(). */

export function num(v) {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}
export function has(v) { return String(v ?? "").trim() !== ""; }
export function money(v) {
  return num(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function round2(v) { return Math.round(num(v) * 100) / 100; }

/* ---- Contract of Sale 31-line chain (Form 104-2) ----
   d: flat deal-data object. Missing/blank inputs are treated as
   unknown (null) and propagate as blank, exactly like v1. */
const CALC_DEFS = {
  line6:  { op: "sum", toks: ["line1","line2","line3","line4","line5"] },
  line9:  { op: "sum", toks: ["line6","-line7","-line8"] },
  line12: { op: "sum", toks: ["line10","-line11"] },
  line14: { op: "sum", toks: ["line12","line13"] },
  line15: { op: "sum", toks: ["line9"] },
  line19: { op: "sum", toks: ["line15","line16","line17","line18"] },
  line20: { op: "sum", toks: ["line10"] },
  line21: { op: "sum", toks: ["line19","-line20"] },
  line22: { op: "expr", fn: "tax" },              // line21 * taxRate / 100
  line29: { op: "sum", toks: ["line19","line22","line23","line24","line25","line26","line27","line28"] },
  line30: { op: "sum", toks: ["line14"] },
  line31: { op: "sum", toks: ["line29","-line30"] },
};
const CALC_IDS = Object.keys(CALC_DEFS);

function effNum(id, d, seen = new Set()) {
  if (seen.has(id)) return null; // cycle guard
  const def = CALC_DEFS[id];
  let v;
  if (def) { seen.add(id); v = calcField(id, d, seen); }
  else { v = has(d[id]) ? num(d[id]) : null; }
  return (typeof v === "number" && !isNaN(v)) ? v : null;
}

export function calcField(id, d, seen = new Set()) {
  const def = CALC_DEFS[id];
  if (!def) return has(d[id]) ? num(d[id]) : null;
  if (def.op === "expr") {
    const a = effNum("line21", d, new Set(seen));
    const r = has(d.taxRate) ? num(d.taxRate) : null;
    if (a === null || r === null) return null;
    return round2(a * r / 100);
  }
  let any = false, total = 0;
  for (const tok of def.toks) {
    const neg = tok.charAt(0) === "-";
    const v = effNum(neg ? tok.slice(1) : tok, d, new Set(seen));
    if (v !== null) { any = true; total += neg ? -v : v; }
  }
  return any ? round2(total) : null;
}

/* Returns every calculated line id -> number|null. */
export function computeContract(d) {
  const out = {};
  for (const id of CALC_IDS) out[id] = calcField(id, d || {});
  return out;
}
export function isCalcId(id) { return CALC_IDS.includes(id); }

/* ---- Standard amortization ----
   Returns monthly payment rounded to cents, or null when inputs
   are missing/invalid. 0% interest => principal / months. */
export function monthlyPayment(principal, annualPct, months) {
  const L = num(principal), n = Math.floor(num(months)), r = num(annualPct) / 100 / 12;
  if (!has(principal) && !has(annualPct) && !has(months)) return null;
  if (!(L > 0) || !(n > 0) || num(annualPct) < 0) return null;
  let pmt;
  if (r === 0) pmt = L / n;
  else pmt = L * r / (1 - Math.pow(1 + r, -n));
  return round2(pmt);
}

/* ---- Truth-in-Lending / finance-agreement totals (amortization) ----
   Returns {monthly, financeCharge, totalOfPayments} or nulls. */
export function loanTotals(amountFinanced, aprPct, months) {
  const monthly = monthlyPayment(amountFinanced, aprPct, months);
  if (monthly === null) return { monthly: null, financeCharge: null, totalOfPayments: null };
  const n = Math.floor(num(months));
  const total = round2(monthly * n);
  return { monthly, financeCharge: round2(total - num(amountFinanced)), totalOfPayments: total };
}

/* ---- VIN validation: 17 chars, no I/O/Q ---- */
export function isValidVIN(vin) {
  const v = String(vin || "").trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

/* ---- Deal-level derived values used across templates ---- */
export function dealDerived(d) {
  const c = computeContract(d);
  const finP = has(d.finAmount) ? d.finAmount : (c.line31 ?? "");
  const finR = has(d.finRate) ? d.finRate : "";
  const finN = has(d.finMonths) ? d.finMonths : "";
  const lt = loanTotals(finP, finR, finN);
  const tilP = has(d.tilAmount) ? d.tilAmount : finP;
  const tilR = has(d.tilApr) ? d.tilApr : finR;
  const tilN = has(d.tilMonths) ? d.tilMonths : finN;
  const til = loanTotals(tilP, tilR, tilN);
  return {
    contract: c,
    fin: { principal: has(finP) ? num(finP) : null, rate: finR, months: finN, ...lt },
    til: { amount: has(tilP) ? num(tilP) : null, apr: tilR, months: tilN, dueDay: d.tilDueDay || "", ...til },
  };
}
