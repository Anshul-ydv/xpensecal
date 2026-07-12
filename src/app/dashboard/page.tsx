import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { AppHeader } from "../AppHeader";
import { DeleteGroupButton } from "../groups/DeleteGroupButton";

export default async function DashboardPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(user.id);

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome, {user.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Track shared expenses, import messy spreadsheets, and settle up.
          </p>
        </header>

        <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card flex flex-col p-6">
            <h2 className="mb-2 font-semibold">Groups</h2>
            <p className="mb-5 text-sm text-muted">
              Create a group, manage who is in it over time, add expenses, and
              see who owes whom.
            </p>
            <Link href="/groups" className="btn btn-primary mt-auto self-start">
              Go to your groups
            </Link>
          </div>
          <div className="card flex flex-col p-6">
            <h2 className="mb-2 font-semibold">Import a spreadsheet</h2>
            <p className="mb-5 text-sm text-muted">
              Import a CSV of expenses. Every data problem is detected, shown,
              and handled — never silently guessed.
            </p>
            <Link href="/import" className="btn btn-ghost mt-auto self-start">
              Import a CSV
            </Link>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Your groups</h2>
          {groups.length === 0 ? (
            <div className="card text-sm text-muted">
              No groups yet. Create one or import a CSV to get started.
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="card card-link flex items-center gap-3 py-3.5 pl-5 pr-3"
                >
                  <Link
                    href={`/groups/${g.id}`}
                    className="flex flex-1 items-center justify-between gap-3"
                  >
                    <span className="font-medium">{g.name}</span>
                    <span className="text-sm text-muted">
                      {g._count.members} members · {g._count.expenses} expenses
                    </span>
                  </Link>
                  <DeleteGroupButton groupId={g.id} groupName={g.name} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
