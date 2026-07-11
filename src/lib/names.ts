// Canonicalizes a person's name so that "priya", "Priya S", "Priya " and
// "Priya" all resolve to the same member. Used both when adding members in the
// UI and when matching names during CSV import (the source data has casing and
// trailing-space inconsistencies like "priya", "rohan ", "Priya S").
//
// Rules:
//   - trim and collapse internal whitespace
//   - Title Case each word
//   - drop a trailing single-letter initial ("Priya S" -> "Priya")
//
// This is deliberately simple and conservative. It is documented in SCOPE.md and
// the import logs every name it rewrites (NAME_NORMALIZED anomaly) so a human can
// see and, if needed, override the mapping.
export function normalizeName(raw: string): string {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) return "";

  const words = collapsed.split(" ");
  // Drop a trailing lone initial, e.g. "Priya S" -> "Priya".
  if (words.length > 1 && words[words.length - 1].replace(/\./g, "").length === 1) {
    words.pop();
  }

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
