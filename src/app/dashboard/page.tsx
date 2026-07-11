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
        <p className="text-sm text-neutral-500">
          Groups and expenses are coming in the next steps of the build.
        </p>
      </section>
    </main>
  );
}
