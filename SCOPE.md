# SCOPE

This document is the anomaly log for `expenses_export.csv` (every data problem
found and how the importer handles it) followed by the database schema.

The source file was provided as an `.xlsx`. It was exported to
`expenses_export.csv` with a format-only conversion (dates written as ISO,
numbers left exactly as stored, e.g. `899.995`). **No cell values were
hand-edited**; every deliberate anomaly is preserved and handled by the app at
import time.

## How anomalies are handled

For every problem the importer does three things: **detect**, **surface**
(as an `ImportAnomaly` row shown on the import report), and **handle** by a
documented policy. Handling falls into a few buckets:

- **Auto-applied** — deterministic, cosmetic, or unambiguous fixes (name
  normalization, sub-paisa rounding, currency defaulting, USD conversion,
  refund handling, treating out-of-100 percentages as weights).
- **Quarantine (VOID)** — the row is imported but excluded from balances until a
  human fixes the underlying data (missing payer, out-of-range date, zero
  amount, unsupported currency, no valid participants).
- **Supersede (SUPERSEDED)** — duplicate rows are kept for audit but excluded
  from balances; the first occurrence stays active.
- **Reinterpret** — a row logged as an expense that is really a settlement is
  recorded as a settlement instead.
- **Pending approval** — anything that deletes, supersedes, drops a participant,
  quarantines, or reinterprets starts as `PENDING_APPROVAL` so a human (Meera)
  can approve or reject it on the report screen.

`ACTIVE`, `SUPERSEDED`, and `VOID` are the three `Expense.status` values;
balances only count `ACTIVE`.

## Anomaly log (by CSV data row)

Row numbers are 1-based over the data rows (row 1 = the first row after the
header, `February rent`).

| Row | Description | Problem | Type | Policy / action |
|----|-------------|---------|------|-----------------|
| 5 | `dinner - marina bites` | Exact duplicate of row 4 (same date, payer Dev, ₹3200) | `DUPLICATE_EXACT` | Row 4 stays ACTIVE; row 5 marked SUPERSEDED (excluded from balances). Pending approval. |
| 8 | `Movie night snacks` | Payer `priya` (lower-case) | `NAME_NORMALIZED` | Normalized to `Priya`; matched to existing member. Auto. |
| 9 | `Cylinder refill` | Amount `899.995` (sub-paisa) | `SUBUNIT_ROUNDING` | Rounded to `900.00` (half away from zero). Auto. |
| 10 | `Groceries DMart` | Payer `Priya S` (stray initial) | `NAME_NORMALIZED` | Normalized to `Priya`. Auto. |
| 12 | `House cleaning supplies` | No payer (`can't remember who paid`) | `MISSING_PAYER` | Imported VOID (excluded from balances) until a payer is assigned. Pending approval. |
| 13 | `Rohan paid Aisha back` | Settlement logged as an expense (blank split_type) | `SETTLEMENT_AS_EXPENSE` | Recorded as a settlement Rohan → Aisha ₹5000, not an expense. Pending approval. |
| 14 | `Pizza Friday` | Percentages 30+30+30+20 = 110% | `PERCENTAGE_SUM_INVALID` | Percentages treated as relative weights so the full amount is still split. Auto. |
| 19 | `Goa villa booking` | 540 **USD** | `FOREIGN_CURRENCY` | Converted at 83 INR/USD; original + INR both stored. Auto. |
| 20 | `Beach shack lunch` | 84 **USD** | `FOREIGN_CURRENCY` | Converted at 83 INR/USD. Auto. |
| 22 | `Parasailing` | 150 USD **and** `Dev's friend Kabir` in the split | `FOREIGN_CURRENCY` + `NON_MEMBER_PARTICIPANT` | USD converted; Kabir (non-member) removed from the split, cost shared among the 4 members. Non-member drop is pending approval. |
| 24 | `Thalassa dinner` | Conflicting duplicate of row 23 (same dinner, different payer & amount, ₹2450 vs ₹2400) | `DUPLICATE_CONFLICTING` | Row 23 (first) stays ACTIVE; row 24 SUPERSEDED pending review — a human picks the winner. |
| 25 | `Parasailing refund` | −30 USD (negative) | `NEGATIVE_AMOUNT` (+ `FOREIGN_CURRENCY`) | Treated as a **refund**: reduces what participants owe (negative splits). Auto. |
| 26 | `Airport cab` | Date `2014-03-01` (typo) + payer `rohan ` (trailing space) | `DATE_OUT_OF_RANGE` + `NAME_NORMALIZED` | Date is outside the ledger range → VOID (quarantined) until corrected; name trimmed to `Rohan`. Date is pending approval. |
| 27 | `Groceries DMart` | Currency blank (`forgot to set currency`) | `MISSING_CURRENCY` | Defaulted to the group base currency (INR). Auto. |
| 30 | `Dinner order Swiggy` | Amount `0` (`counted twice earlier`) | `ZERO_AMOUNT` | Imported VOID (no effect on balances). Pending approval. |
| 31 | `Weekend brunch` | Percentages 30+30+30+20 = 110% | `PERCENTAGE_SUM_INVALID` | Treated as relative weights. Auto. |
| 33 | `Deep cleaning service` | Ambiguous date (`is this April 5 or May 4?`) | `DATE_AMBIGUOUS` | Kept the stored date (2026-05-04); flagged for confirmation rather than guessed. Auto (kept). |
| 35 | `Groceries BigBasket` | Meera in an April split after she left (`oops Meera still in the group list`) | `MEMBER_INACTIVE_AT_DATE` | Meera removed from the 2026-04-02 split; cost shared among active members (Aisha, Rohan, Priya). Pending approval. |
| 37 | `Sam deposit share` | A deposit payment logged as an expense | `SETTLEMENT_AS_EXPENSE` | Recorded as a settlement Sam → Aisha ₹15000. Pending approval. |
| 41 | `Furniture for common room` | `split_type=equal` but per-person shares provided | `SPLIT_TYPE_DETAILS_MISMATCH` | Honored the split type (equal); ignored the redundant shares. Auto. |

**16 distinct problem types** are detected across these rows (the assignment
requires at least 12). Recurring, legitimately-repeated rows (monthly rent,
wifi, maid, groceries on different dates) are **not** flagged as duplicates
because the duplicate key includes the date.

### Questions the data forces (and our answers)

- **Is a negative amount an error or a refund?** A refund. Row 25's note
  confirms a cancelled slot; we allow negative amounts and let them reduce
  balances. (An unexplained negative would still import but is visible for
  review.)
- **If two people log the same dinner with different amounts, which row wins?**
  The first row in file order wins deterministically; the later one is
  superseded and flagged `DUPLICATE_CONFLICTING` so a human can flip the choice.
  We do not trust free-text notes to auto-pick a winner.
- **Does someone who moved out still owe expenses dated after they left?** No.
  Membership is time-bounded (`Member.joinedAt` / `leftAt`); a participant
  outside their active window is removed from that split (row 35, Meera).

## Membership timeline

Join/leave dates are **not columns** in the CSV — they come from the assignment
narrative and are encoded in `src/lib/import/roster.ts`:

- Aisha, Rohan, Priya — members throughout (open window).
- Dev — trip guest, open window (shares only specific expenses).
- Meera — `leftAt = 2026-03-31` (moved out end of March).
- Sam — `joinedAt = 2026-04-08` (moved in mid-April; first activity is his deposit).
- "Dev's friend Kabir" — **not** on the roster → treated as a non-member guest.

## Database schema

PostgreSQL via Prisma. Money is stored as integer **minor units** (paise/cents).
Full schema in `prisma/schema.prisma`.

- **User** — a login account (`email`, `passwordHash`, `name`). Distinct from a
  Member.
- **Group** — a shared-expense group with a `baseCurrency` (default INR),
  owned by the `User` who created it.
- **Member** — a participant in a group. `joinedAt` / `leftAt` bound the window
  during which they are active. May optionally link to a `User`. Unique
  `(groupId, name)` (names are normalized).
- **Expense** — `description`, `date`, original `currency` + `amountMinor`, the
  base-currency `amountBaseMinor`, the `fxRate` used, `splitType`
  (EQUAL/UNEQUAL/PERCENTAGE/SHARE), optional `paidByMemberId`, `status`
  (ACTIVE/SUPERSEDED/VOID), and import provenance (`importBatchId`, `sourceRow`).
- **ExpenseSplit** — the resolved amount one member owes for one expense
  (`owedBaseMinor`) plus the raw share for display (`rawShare`). Unique
  `(expenseId, memberId)`. Every split type collapses to concrete owed amounts
  here, which is what powers the per-expense balance breakdown.
- **Settlement** — a direct payment `fromMember` → `toMember` (original +
  base amount, `fxRate`). Not a shared expense; has no splits.
- **ImportBatch** — one import run: `filename`, row counts, and the report.
- **ImportAnomaly** — one detected problem: `rowNumber`, `rawRow`, `type`,
  `severity` (INFO/WARNING/ERROR), `status`
  (AUTO_APPLIED/PENDING_APPROVAL/APPROVED/REJECTED), `message`, `action`, and
  optional links to the produced `Expense`/`Settlement`.

Referential integrity: deleting a group cascades to its members, expenses,
splits, settlements, and import batches. Deleting a member cascades their splits
and settlements and nulls the payer on any expense they paid. A member who is
part of any financial record cannot be deleted through the UI (they must be
marked "left" instead) to keep historical balances intact.
