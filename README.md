# XpenseCal — Shared Expenses App

A shared-expenses tracker for a flat of roommates whose spending history lives in a
messy spreadsheet. The app imports that spreadsheet, detects and surfaces every data
problem it finds, and produces clean, explainable balances (who owes whom, and exactly
which expenses make up each number).

Built for the Spreetail internship assignment.

## Status

Work in progress — built and committed step by step. See the commit history for the
incremental build.

## Tech stack

- **Next.js 16 (App Router) + TypeScript** — single full-stack app, deployed on Vercel.
- **PostgreSQL + Prisma** — relational database (dev and prod both Postgres).
- **Auth** — hand-rolled email/password with bcrypt + a signed JWT in an httpOnly cookie.
- **Money** — stored as integer minor units with an explicit currency; foreign amounts
  are converted to a base currency (INR) so a dollar is never treated as a rupee.

## What it does (target feature set)

1. Login / register.
2. Create and manage groups whose membership changes over time (members join and leave).
3. Create and manage expenses across every split type in the source data
   (equal, unequal, percentage, share/ratio) plus settlements.
4. Group-wise balances, per-person balance summary, and a full expense-level breakdown
   behind every number.
5. Settle debts / record payments.
6. Import `expenses_export.csv` through the app, with an anomaly report.

## Getting started (local)

Prerequisites: Node.js 20.9+ and a local PostgreSQL instance.

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000.

## Documentation

- `SCOPE.md` — anomaly log (every data problem found in the CSV and how it is handled) and the database schema.
- `DECISIONS.md` — decision log: each significant decision, the options considered, and why.
- `AI_USAGE.md` — AI tools used, key prompts, and concrete cases where the AI was wrong and how it was corrected.

## AI usage

This project was built with an AI coding assistant (see `AI_USAGE.md`). Every line is
owned and understood by the author.
