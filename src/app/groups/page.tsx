import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listGroupsForUser } from "@/lib/groups";
import { AppHeader } from "../AppHeader";
import { BackButton } from "../BackButton";
import { CreateGroupForm } from "./CreateGroupForm";
import { DeleteGroupButton } from "./DeleteGroupButton";

export default async function GroupsPage() {
  const user = await requireUser();
  const groups = await listGroupsForUser(user.id);

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <BackButton fallback="/dashboard" className="mb-4" />
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Your groups</h1>
        <p className="mt-1.5 text-sm text-muted">
          Create a group and manage who is in it over time.
        </p>
      </header>

      <div className="mb-8">
        <CreateGroupForm />
      </div>

      {groups.length === 0 ? (
        <div className="card text-sm text-muted">No groups yet.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li
              key={g.id}
              className="card card-link flex items-center gap-3 py-4 pl-5 pr-3"
            >
              <Link
                href={`/groups/${g.id}`}
                className="flex flex-1 items-center justify-between gap-3"
              >
                <span className="font-medium">{g.name}</span>
                <span className="text-sm text-muted">
                  {g._count.members} members · {g._count.expenses} expenses ·{" "}
                  {g.baseCurrency}
                </span>
              </Link>
              <DeleteGroupButton groupId={g.id} groupName={g.name} />
            </li>
          ))}
        </ul>
      )}
      </main>
    </>
  );
}
