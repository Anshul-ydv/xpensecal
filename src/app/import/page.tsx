import { requireUser } from "@/lib/auth";
import { AppHeader } from "../AppHeader";
import { ImportForms } from "./ImportForms";

export default async function ImportPage() {
  const user = await requireUser();

  return (
    <>
      <AppHeader userName={user.name} />
      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Import expenses</h1>
        <p className="mt-1.5 text-sm text-muted">
          Every import creates a new group and produces a report of every data
          problem found and the action taken. Nothing is silently guessed.
        </p>
      </header>

      <ImportForms />
      </main>
    </>
  );
}
