// Currency conversion.
//
// Priya's complaint: "the sheet pretends a dollar is a rupee." So every expense
// is converted to the group's base currency using an explicit, documented rate,
// and the rate used is stored on the expense (Expense.fxRate) so any conversion
// can be re-checked later.
//
// DECISION: we use a single fixed rate table rather than live/historical rates.
// A shared-flat expense tracker does not need market-accurate, per-date FX; a
// stable documented rate keeps balances reproducible and the demo deterministic.
// See DECISIONS.md. Rates are expressed as "units of INR per 1 unit of currency".
const INR_PER_UNIT: Record<string, number> = {
  INR: 1,
  USD: 83, // fixed assignment rate; ~market rate for the trip period
};

export const SUPPORTED_CURRENCIES = Object.keys(INR_PER_UNIT);

// Returns how many units of `baseCurrency` equal one unit of `currency`.
// Throws for an unsupported currency so the caller (or importer) can surface it
// rather than silently guessing.
export function getFxRate(currency: string, baseCurrency: string): number {
  const from = INR_PER_UNIT[currency.toUpperCase()];
  const to = INR_PER_UNIT[baseCurrency.toUpperCase()];
  if (from === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  if (to === undefined) {
    throw new Error(`Unsupported base currency: ${baseCurrency}`);
  }
  return from / to;
}

export function isSupportedCurrency(currency: string): boolean {
  return INR_PER_UNIT[currency.toUpperCase()] !== undefined;
}
