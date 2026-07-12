import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { AppHeader } from "../AppHeader";

export default async function DashboardPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(user.id);

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-4xl p-6 sm:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-neutral-500">
            Track shared expenses, import messy spreadsheets, and settle up.
          </p>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-black/10 p-6 dark:border-white/15">
            <h2 className="mb-2 font-medium">Groups</h2>
            <p className="mb-4 text-sm text-neutral-500">
              Create a group, manage who is in it over time, add expenses, and
              see who owes whom.
            </p>
            <Link
              href="/groups"
              className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            >
              Go to your groups
            </Link>
          </div>
          <div className="rounded-xl border border-black/10 p-6 dark:border-white/15">
            <h2 className="mb-2 font-medium">Import a spreadsheet</h2>
            <p className="mb-4 text-sm text-neutral-500">
              Import a CSV of expenses. Every data problem is detected, shown,
              and handled — never silently guessed.
            </p>
            <Link
              href="/import"
              className="inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Import a CSV
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-medium">Your groups</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No groups yet. Create one or import a CSV to get started.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex items-center justify-between rounded-lg border border-black/10 px-5 py-3 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="text-sm text-neutral-500">
                      {g._count.members} members · {g._count.expenses} expenses
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
