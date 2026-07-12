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
      <div className="card">
        <h2 className="mb-1 font-semibold">Import the provided sample</h2>
        <p className="mb-4 text-sm text-muted">
          Runs the importer on the assignment&apos;s{" "}
          <code className="rounded bg-bg px-1 py-0.5 font-mono text-xs">
            expenses_export.csv
          </code>{" "}
          using the known move-in / move-out dates, and shows the full anomaly
          report.
        </p>
        <form action={importSampleAction}>
          <button type="submit" className="btn btn-primary">
            Import sample CSV
          </button>
        </form>
      </div>

      {/* Upload a CSV */}
      <form action={formAction} className="card flex flex-col gap-3.5">
        <h2 className="font-semibold">Import your own CSV</h2>
        <p className="text-sm text-muted">
          Same columns as the sample: date, description, paid_by, amount,
          currency, split_type, split_with, split_details, notes.
        </p>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">New group name</span>
          <input
            name="groupName"
            required
            placeholder="e.g. Flat 402"
            className="field"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">CSV file</span>
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-fg"
          />
        </label>
        {state?.error && (
          <p className="text-sm text-neg">{state.error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn btn-ghost self-start disabled:opacity-60"
        >
          {pending ? "Importing…" : "Upload and import"}
        </button>
      </form>
    </div>
  );
}
