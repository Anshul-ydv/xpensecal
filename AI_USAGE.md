# AI_USAGE

## Tools used

- **Kiro (Claude-based coding agent)** — primary development collaborator, used
  for scaffolding, writing implementation code, and drafting these docs.
- The agent has access to the terminal, file editing, and the local Postgres,
  so it also ran the migrations and verification scripts described below.

I remain the engineer of record: I directed the work, reviewed every file, and
verified behavior against the database before each commit.

## How I worked with the AI

I broke the assignment into small, verifiable steps (scaffold → schema → auth →
groups → expenses → balances → import → docs → deploy) and committed each step
separately, so the git history reflects the real build order rather than one
bulk commit. For each step I had the AI implement, then I ran a build/typecheck
and a focused script against the DB before committing.

### Representative prompts

- "Model the schema: users, groups, members with join/leave dates, expenses with
  original + base currency amounts, splits, settlements, and an import anomaly
  log. Money as integer minor units."
- "Every split type (equal, unequal, percentage, share) should reduce to a single
  weighted allocation that sums exactly to the total, including negative refunds."
- "Write the importer so each of the CSV's data problems is detected, surfaced as
  an anomaly row, and handled by a documented policy — never crash, never guess."
- "Balances: net = paid − owed +/− settlements, base currency, active expenses
  only; show the exact expenses behind each person's number."

## Cases where the AI was wrong, how I caught it, and what changed

These are real defects from this build, not hypotheticals.

### 1. Prisma datasource `url` — wrong for the installed major version

- **What the AI produced:** a `schema.prisma` with
  `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }` — the
  standard pattern from its training data.
- **How I caught it:** `npx prisma migrate dev` failed with
  *"The datasource property `url` is no longer supported in schema files"* —
  the freshly-installed Prisma was v7, which requires `prisma.config.ts` and
  driver adapters.
- **What changed:** rather than adopt v7's heavier plumbing on a deadline, I
  pinned Prisma to stable v6, where the original schema is correct. Documented in
  DECISIONS.md (#3). Lesson: the AI assumed a version; I checked the actual
  installed version and the error message.

### 2. `requireUser()` type error from a dynamic `redirect` import

- **What the AI produced:** `requireUser` imported `redirect` via
  `const { redirect } = await import("next/navigation")`. Because of the dynamic
  import, TypeScript could not see that `redirect()` returns `never`, so it
  believed the function could return `CurrentUser | null` and raised
  *"Type 'null' is not assignable to type 'CurrentUser'"*.
- **How I caught it:** `npx tsc --noEmit` failed on `src/lib/auth.ts`.
- **What changed:** switched to a static `import { redirect } from
  "next/navigation"` so the `never` return type narrows correctly and the helper
  is typed as returning a real user.

### 3. Missing cascade rules broke group deletion

- **What the AI produced:** the first schema set `onDelete: Cascade` on
  Group→Expense and Expense→ExpenseSplit, but left `ExpenseSplit → Member` and
  `Settlement → Member` at the default (restrict).
- **How I caught it:** a verification script that created a group, added
  expenses, then deleted the group failed with
  *"Foreign key constraint violated: `ExpenseSplit_memberId_fkey`"* — deleting a
  group cascaded to members, but members couldn't be deleted while splits
  referenced them.
- **What changed:** added `onDelete: Cascade` to the split/settlement→member
  relations and `onDelete: SetNull` to `Expense.paidBy` and the import-batch
  links, then re-migrated. Re-ran the script: all split types allocated
  correctly and cleanup succeeded.

### 4. Server actions used directly as form actions — signature mismatch

- **What the AI produced:** member edit/delete used two-argument actions
  `(prevState, formData)` bound directly to `<form action={...}>`, which expects
  a one-argument `(formData) => void`.
- **How I caught it:** `tsc` reported
  *"Target signature provides too few arguments. Expected 2 or more, but got 1."*
- **What changed:** wired those forms through React's `useActionState` (which
  supplies the `prevState` argument and surfaces inline errors), matching how the
  other forms already worked.

## What I verified myself

- Allocation math (equal/share/percentage/unequal and negative refunds) sums
  exactly to the total, and `899.995` rounds to `900.00`.
- FX conversion stores the original and INR amounts with the rate, and USD
  expenses convert at 83.
- Balance nets always sum to zero; a hand-computed rent + settlement scenario
  produced the expected per-person numbers and transfers.
- The full importer run on the real `expenses_export.csv`: 42 rows → 35 active
  expenses, 2 settlements, 5 quarantined, **16 distinct anomaly types**, nets
  summing to zero.
