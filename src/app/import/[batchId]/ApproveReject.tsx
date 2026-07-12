"use client";

import { resolveAnomalyAction } from "./actions";

// Approve/reject controls for a pending anomaly (Meera's approval workflow).
export function ApproveReject({ anomalyId }: { anomalyId: string }) {
  return (
    <div className="flex gap-2">
      <form action={resolveAnomalyAction}>
        <input type="hidden" name="anomalyId" value={anomalyId} />
        <input type="hidden" name="decision" value="APPROVED" />
        <button
          type="submit"
          className="rounded border border-green-600/40 px-2 py-1 text-xs text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
        >
          Approve
        </button>
      </form>
      <form action={resolveAnomalyAction}>
        <input type="hidden" name="anomalyId" value={anomalyId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <button
          type="submit"
          className="rounded border border-red-600/40 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Reject
        </button>
      </form>
    </div>
  );
}
