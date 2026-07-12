# XpenseCal — Shared Expenses App

A shared-expenses tracker for a flat of roommates whose spending history lived in
a messy spreadsheet. The app imports that spreadsheet, **detects and surfaces
every data problem** it finds (never silently guessing), and produces clean,
explainable balances — who owes whom, and the exact expenses behind every number.

Built for the Spreetail internship assignment.

- **Live app:** _add the deployed URL here after deploying (Step 10)_
- **Repo:** https://github.com/Anshul-ydv/xpensecal

## What it does

1. **Login / register** — email + password.
2. **Groups with changing membership** — members join and leave over time
   (`joinedAt` / `leftAt`), so expenses only count during a member's active window.
3. **Expenses in every split type in the data** — equal, unequal, percentage, and
   share/ratio — plus **settlements** (member-to-member payments).
4. **Balances** — a per-person net summary, a full **expense-level breakdown**
   behind each number, and a **who-pays-whom** settle-up list.
5. **CSV import** — imports `expenses_export.csv`, detecting/surfacing/handling
   every anomaly and producing an **import report**. Changes that delete or alter
   data require approval.

## Tech stack

- **Next.js 16 (App Router) + TypeScript** — one full-stack app, deployable on Vercel.
- **PostgreSQL + Prisma (v6)** — relational database; same engine in dev and prod.
- **Auth** — bcrypt password hashing + a `jose`-signed JWT in an httpOnly cookie.
- **Money** — integer minor units with an explicit currency; foreign amounts are
  converted to a base currency (INR) and the FX rate is stored per expense.

AI tools used and how they were directed/corrected: see **`AI_USAGE.md`**.

## Getting started (local)

**Prerequisites:** Node.js 20.9+ and PostgreSQL 14+.

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL and create a database
#    (macOS/Homebrew example)
brew services start postgresql@16
createdb xpensecal

# 3. Configure environment
cp .env.example .env
#   Edit .env:
#   DATABASE_URL="postgresql://<you>@localhost:5432/xpensecal?schema=public"
#   AUTH_SECRET="<a long random string>"

# 4. Apply the database schema
npx prisma migrate dev

# 5. Run the app
npm run dev
```

Open http://localhost:3000, register an account, then go to **Import** and click
**Import sample CSV** to load `expenses_export.csv` and see the anomaly report,
or upload your own CSV.

### Useful commands

```bash
npm run dev        # start the dev server
npm run build      # production build
npx prisma studio  # inspect the database
```

## How the import works (the core requirement)

The importer (`src/lib/import/importer.ts`) reads the CSV, then for every row:

1. **Detects** problems (duplicates, wrong/foreign currency, negative/zero
   amounts, sub-paisa precision, bad/ambiguous dates, non-members, members
   inactive on a date, settlements logged as expenses, percentages ≠ 100, etc.).
2. **Surfaces** each as an `ImportAnomaly` shown on the import report, with the
   severity and the exact action taken.
3. **Handles** it by a documented policy — auto-fix, quarantine (VOID), supersede
   a duplicate, or reinterpret as a settlement. Anything that deletes or changes
   data starts as *pending approval*.

The full anomaly log and the database schema are in **`SCOPE.md`**. The reasoning
behind each significant choice is in **`DECISIONS.md`**.

## Project layout

```
prisma/schema.prisma          # database schema + migrations
src/lib/
  money.ts                    # minor units, rounding rule, largest-remainder allocation
  fx.ts                       # currency conversion (documented fixed rate)
  expenses.ts / settlements.ts# create records; all split types -> weighted allocation
  balances.ts                 # net balances + who-pays-whom + drill-down
  membership.ts               # is-a-member-active-on-a-date
  names.ts                    # name normalization
  auth.ts                     # sessions
  csv.ts                      # CSV parser
  import/importer.ts          # anomaly detection + import
src/app/                      # pages, server actions, and the import report
```

## Documentation

- **`SCOPE.md`** — anomaly log (every CSV problem and its handling) + DB schema.
- **`DECISIONS.md`** — decision log with options considered and rationale.
- **`AI_USAGE.md`** — AI tools, key prompts, and concrete cases where the AI was
  wrong, how it was caught, and what changed.
