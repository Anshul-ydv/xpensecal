# Deploying XpenseCal

The app is a standard Next.js 16 app with a PostgreSQL database. The path below
uses **Vercel** (hosting) + **Neon** (serverless Postgres), which are both free
to start and need no CLI. Any Postgres host and any Node host work equally well.

## 1. Create a Postgres database (Neon)

1. Sign up at https://neon.tech and create a project (region near your users).
2. From the project dashboard, copy two connection strings:
   - the **pooled** string (host contains `-pooler`) → this is `DATABASE_URL`
   - the **direct** string (no `-pooler`) → this is `DIRECT_URL`
   Both should include `?sslmode=require`.

## 2. Deploy to Vercel

1. Sign up at https://vercel.com and click **Add New → Project**.
2. Import the GitHub repo `Anshul-ydv/xpensecal`.
3. Vercel auto-detects Next.js. Before deploying, add **Environment Variables**:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the Neon **pooled** connection string |
   | `DIRECT_URL` | the Neon **direct** connection string |
   | `AUTH_SECRET` | a long random string (e.g. `openssl rand -base64 32`) |
4. Click **Deploy**.

The `build` script runs `prisma generate && prisma migrate deploy && next build`,
so the schema is created on the production database automatically during the
first deploy. `prisma migrate deploy` is idempotent, so subsequent deploys are
safe.

## 3. Verify

1. Open the deployed URL, register an account.
2. Go to **Import → Import sample CSV** to load `expenses_export.csv` and view
   the anomaly report, then **View balances**.
3. Put the deployed URL in `README.md` (the "Live app" line).

## Notes

- `AUTH_SECRET` must be set in production or login will fail loudly (by design).
- The session cookie is marked `secure` in production, so use HTTPS (Vercel does
  this by default).
- To reset the production database, drop and recreate it in Neon, then redeploy.
