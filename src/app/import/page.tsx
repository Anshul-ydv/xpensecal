import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ImportForms } from "./ImportForms";

export default async function ImportPage() {
  await requireUser();

  return (
    <main className="mx-auto max-w-2xl p-6 sm:p-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/dashboard" className="underline underline-offset-4">
          Dashboard
        </Link>{" "}
        / Import
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Import expenses</h1>
        <p className="text-sm text-neutral-500">
          Every import creates a new group and produces a report of every data
          problem found and the action taken. Nothing is silently guessed.
        </p>
      </header>

      <ImportForms />
    </main>
  );
}
