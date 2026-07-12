# DECISIONS

A log of the significant decisions in this build: the options considered and why
the chosen option won. Ordered roughly by when they came up.

## 1. Framework: Next.js (App Router) full-stack

- **Options:** (a) Next.js full-stack, (b) separate React SPA + a Node/Express or
  FastAPI backend, (c) a server-rendered framework like Rails/Django.
- **Chosen:** Next.js 16 with the App Router and TypeScript.
- **Why:** One codebase and one deploy target for a 2-day build, first-class
  server actions for mutations (no hand-written API layer), and trivial hosting
  on Vercel. Server components keep data-access on the server and out of the
  client bundle.

## 2. Database: PostgreSQL + Prisma

- **Options:** PostgreSQL, MySQL, SQLite.
- **Chosen:** PostgreSQL with Prisma ORM. Relational, as required.
- **Why:** The domain is relational (users, groups, members, expenses, splits,
  settlements, anomalies). Postgres is the same locally (Homebrew) and in
  production (a hosted Postgres), so there is no dev/prod schema drift. Prisma
  gives a typed schema, migrations, and a typed client. SQLite was rejected
  because serverless hosts have an ephemeral filesystem.

## 3. Prisma pinned to v6, not v7

- **Context:** `npm install prisma` pulled Prisma 7, which removes `url` from the
  datasource block and requires a `prisma.config.ts`, driver adapters, ESM
  entrypoints, and explicit env loading.
- **Options:** (a) adopt v7 with driver adapters, (b) pin to stable v6.
- **Chosen:** Pin to v6 (`6.19.3`).
- **Why:** v7's driver-adapter plumbing adds moving parts and deploy risk without
  buying anything for this app. The stable, widely-documented v6 keeps the
  familiar `url`-in-datasource setup and a clean Vercel build. This is a
  deliberate "boring is better on a deadline" call.

## 4. Money as integer minor units, with one rounding rule

- **Options:** floats, a decimal library, or integer minor units.
- **Chosen:** integer minor units (paise/cents) everywhere, with a single
  `roundToMinor` function.
- **Why:** Floats drift; a decimal library is overkill at this scale. Integers
  are exact. Rounding is defined **once** (`src/lib/money.ts`,
  "half away from zero") so the live-session task "change the rounding rule" is a
  one-line change. Splits are distributed with the **largest-remainder method**
  so per-person amounts always sum exactly to the total (no lost or invented
  paisa), including for negative refunds.

## 5. Currency: convert to a base currency using a fixed, stored rate

- **Options:** (a) live/historical FX rates per date, (b) a fixed documented
  rate.
- **Chosen:** a fixed rate table (`USD → INR = 83`), converted at import and the
  rate **stored on each expense** (`fxRate`).
- **Why:** Priya's complaint ("the sheet pretends a dollar is a rupee") is about
  correctness, not market accuracy. A stable documented rate keeps balances
  reproducible and the demo deterministic, and storing the rate makes every
  conversion auditable and re-computable. Swapping in dated rates later only
  touches `src/lib/fx.ts`.

## 6. Every split type reduces to weighted allocation

- **Options:** bespoke math per split type, or one shared algorithm.
- **Chosen:** EQUAL/UNEQUAL/PERCENTAGE/SHARE all become per-member **weights**
  fed to one `allocateByWeights` function.
- **Why:** One well-tested code path instead of four. Equal = all weights 1;
  share = the given integers; percentage = the percentages; unequal = the given
  amounts. Adding a new split type (a live-session task) means producing weights,
  nothing more.

## 7. Balances: net = paid − owed (+/− settlements)

- **Chosen:** `net = paidForGroup − ownShareOfExpenses + settlementsPaid −
  settlementsReceived`, in base currency, over ACTIVE expenses only.
- **Why:** It is the minimal correct model and, because splits sum to the
  expense amount and settlements are +x/−x, all members' nets always sum to zero
  (a built-in correctness check). SUPERSEDED/VOID rows are excluded, which is how
  quarantined/duplicate data stays out of the numbers.

## 8. "Who pays whom": greedy debt simplification

- **Options:** (a) show raw pairwise debts, (b) minimize the number of transfers
  (NP-hard), (c) greedy largest-debtor/largest-creditor matching.
- **Chosen:** greedy matching.
- **Why:** Aisha wants "one number per person… who pays whom, done." Greedy
  produces few, clean transfers, is deterministic, and is easy to explain. True
  minimization is NP-hard and not worth it here. Rohan's "show me the exact
  expenses" need is met separately by the per-member drill-down.

## 9. Duplicate policy: first row wins, later rows superseded

- **Options:** trust free-text notes to pick a winner, keep the largest/smallest,
  or keep the first deterministically.
- **Chosen:** first row in file order stays ACTIVE; later matches are SUPERSEDED
  and flagged (exact vs conflicting) for human review.
- **Why:** Deterministic and explainable. Notes like "hers is wrong" are
  unreliable to parse. Detection uses `(date + sorted description tokens)` so
  "Dinner at Marina Bites" == "dinner - marina bites" but monthly bills on
  different dates never collide. Humans can override by rejecting the anomaly.

## 10. Bad rows are quarantined (VOID), not dropped or guessed

- **Options:** crash the import, silently skip, silently guess, or import-and-quarantine.
- **Chosen:** import the row as `VOID` (kept for audit, excluded from balances)
  and log the anomaly. Applies to missing payer, out-of-range date (the 2014
  typo), zero amount, unsupported currency.
- **Why:** "A crashed import and a silent guess are both failing answers." We
  never guess the correct payer or the real date — we keep the row visible and
  let a human fix it.

## 11. Membership as `joinedAt`/`leftAt` on Member (not a periods table)

- **Options:** a separate `MembershipPeriod` table (supports rejoining), or two
  nullable dates on Member.
- **Chosen:** `joinedAt` / `leftAt` on Member.
- **Why:** The data has exactly one join and one leave per person. Two dates make
  the "is this member active on date X?" check trivial and easy to explain. A
  periods table would be the right extension if members could leave and rejoin;
  that is documented as future work rather than built speculatively.

## 12. Settlement detection heuristic

- **Chosen:** a row is treated as a settlement when its `split_type` is blank, or
  when the notes mention settle/deposit/"paid back" **and** there is a single
  counterparty in `split_with`.
- **Why:** Catches both "Rohan paid Aisha back" (blank split type) and "Sam
  deposit share" (a payment to a single person). Modeling a payment to one person
  as an expense split or as a settlement produces the same net effect, but the
  settlement is the truthful representation and is flagged for approval.

## 13. Meera's approval workflow

- **Chosen:** anomalies that change/delete data start `PENDING_APPROVAL`;
  cosmetic fixes are `AUTO_APPLIED`. On the report a user can Approve (the action
  stands) or Reject. Rejecting a duplicate reactivates the superseded expense.
- **Why:** Directly answers "I want to approve anything the app deletes or
  changes." Reactivating a duplicate is the one cleanly-reversible change, so it
  is fully undoable; quarantined rows need their underlying data fixed first.

## 14. Auth: hand-rolled bcrypt + JWT cookie

- **Options:** NextAuth/Auth.js, or a hand-rolled session.
- **Chosen:** bcrypt password hashing + a `jose`-signed HS256 JWT in an httpOnly
  cookie, gated by `proxy.ts`.
- **Why:** Every line is explainable in the live session with no framework magic.
  Login returns an identical error for unknown-email and wrong-password (no user
  enumeration). It is intentionally simple; OAuth/passwordless were out of scope.

## 15. Import creates a new group each run

- **Chosen:** each import creates a fresh group seeded with the roster, then
  produces a report.
- **Why:** Self-contained and idempotent for the demo — re-importing never
  double-counts into an existing group. The sample import uses the known roster;
  an arbitrary upload derives members from payers and flags other unknown names.
