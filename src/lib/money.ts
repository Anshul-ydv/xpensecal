// All money handling lives here so rules (rounding, minor units, allocation)
// are defined in exactly one place. The live session may ask to change the
// rounding rule — do it here and everything else follows.
//
// We store money as integer MINOR units (paise/cents). We assume 2-decimal
// currencies (INR, USD), which covers the source data. `MINOR_PER_UNIT` is the
// single knob if that ever changes.

export const MINOR_PER_UNIT = 100;

// Rounds a fractional minor-unit value to a whole minor unit.
//
// Rounding rule: HALF AWAY FROM ZERO (a.k.a. commercial rounding). 0.5 -> 1,
// -0.5 -> -1. This is the intuitive "round .5 up" behaviour for end users.
// To switch to banker's rounding (half to even), change only this function.
export function roundToMinor(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

// Parses a human amount string/number (major units, e.g. "899.995") into integer
// minor units, applying the rounding rule. Returns null for unparseable input.
export function toMinor(amount: string | number): number | null {
  const n = typeof amount === "number" ? amount : Number(amount.trim());
  if (!Number.isFinite(n)) return null;
  return roundToMinor(n * MINOR_PER_UNIT);
}

// Formats integer minor units as a major-unit string with 2 decimals, e.g.
// 90000 -> "900.00". Sign is preserved.
export function formatMinor(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / MINOR_PER_UNIT);
  const frac = (abs % MINOR_PER_UNIT).toString().padStart(2, "0");
  return `${sign}${major}.${frac}`;
}

// Distributes a total (in minor units) across participants by integer weights,
// so the parts sum EXACTLY to the total with no lost or invented penny.
//
// Method: largest-remainder (Hamilton). Give everyone their floored fair share,
// then hand out the leftover minor units one at a time to the participants with
// the largest fractional remainder (ties broken by original order for
// determinism). Works for equal splits (all weights 1), share/ratio splits, and
// percentage splits (weights = percentages).
//
// Negative totals (refunds) are handled by allocating on the absolute value and
// reapplying the sign, which keeps the exact-sum guarantee.
export function allocateByWeights(totalMinor: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const sign = totalMinor < 0 ? -1 : 1;
  const total = Math.abs(totalMinor);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  if (weightSum <= 0) {
    throw new Error("Cannot allocate: sum of weights must be positive");
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  // Order indices by descending fractional part; stable on original index.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const result = floors.slice();
  for (let k = 0; k < remainder; k++) {
    result[order[k % n].i] += 1;
  }

  return result.map((x) => x * sign);
}

// Formats minor units with a currency symbol/code for display, e.g.
// (697200, "INR") -> "₹6972.00", (8400, "USD") -> "$84.00".
const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$" };
export function formatMoney(minor: number, currency: string): string {
  const sym = SYMBOLS[currency.toUpperCase()];
  const body = formatMinor(minor);
  return sym ? `${sym}${body}` : `${body} ${currency.toUpperCase()}`;
}
