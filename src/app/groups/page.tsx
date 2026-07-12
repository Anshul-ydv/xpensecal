import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { AppHeader } from "../AppHeader";
import { CreateGroupForm } from "./CreateGroupForm";

export default async function GroupsPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(user.id);

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Your groups</h1>
        <p className="text-sm text-neutral-500">
          Create a group and manage who is in it over time.
        </p>
      </header>

      <div className="mb-8">
        <CreateGroupForm />
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No groups yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                href={`/groups/${g.id}`}
                className="flex items-center justify-between rounded-lg border border-black/10 px-5 py-4 transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-sm text-neutral-500">
                  {g._count.members} members · {g._count.expenses} expenses ·{" "}
                  {g.baseCurrency}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </main>
    </>
  );
}
