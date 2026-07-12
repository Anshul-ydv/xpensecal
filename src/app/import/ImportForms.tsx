"use client";

import { useActionState } from "react";
import {
  importSampleAction,
  importUploadAction,
  type ImportFormState,
} from "./actions";

export function ImportForms() {
  const [state, formAction, pending] = useActionState<ImportFormState, FormData>(
    importUploadAction,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      {/* One-click sample import */}
      <div className="rounded-xl border border-black/10 p-5 dark:border-white/15">
        <h2 className="mb-1 font-medium">Import the provided sample</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Runs the importer on the assignment&apos;s{" "}
          <code>expenses_export.csv</code> using the known move-in / move-out
          dates, and shows the full anomaly report.
        </p>
        <form action={importSampleAction}>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Import sample CSV
          </button>
        </form>
      </div>

      {/* Upload a CSV */}
      <form
        action={formAction}
        className="flex flex-col gap-3 rounded-xl border border-black/10 p-5 dark:border-white/15"
      >
        <h2 className="font-medium">Import your own CSV</h2>
        <p className="text-sm text-neutral-500">
          Same columns as the sample: date, description, paid_by, amount,
          currency, split_type, split_with, split_details, notes.
        </p>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">New group name</span>
          <input
            name="groupName"
            required
            placeholder="e.g. Flat 402"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">CSV file</span>
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Importing…" : "Upload and import"}
        </button>
      </form>
    </div>
  );
}
