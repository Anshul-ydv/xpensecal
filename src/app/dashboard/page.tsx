import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "../(auth)/actions";

// Placeholder dashboard. Groups, balances, and imports land here in later steps.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">XpenseCal</h1>
          <p className="text-sm text-neutral-500">
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-black/10 p-6 dark:border-white/15">
        <h2 className="mb-2 font-medium">Groups</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Create a group, manage who is in it over time, add expenses, and see
          who owes whom.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/groups"
            className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Go to your groups
          </Link>
          <Link
            href="/import"
            className="inline-block rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Import a CSV
          </Link>
        </div>
      </section>
    </main>
  );
}
