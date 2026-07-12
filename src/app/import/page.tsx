import { requireUser } from "@/lib/auth";
import { AppHeader } from "../AppHeader";
import { ImportForms } from "./ImportForms";

export default async function ImportPage() {
  const user = await requireUser();

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Import expenses</h1>
        <p className="text-sm text-neutral-500">
          Every import creates a new group and produces a report of every data
          problem found and the action taken. Nothing is silently guessed.
        </p>
      </header>

      <ImportForms />
      </main>
    </>
  );
}
