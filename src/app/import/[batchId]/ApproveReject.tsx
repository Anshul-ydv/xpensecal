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
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-pos transition-colors hover:bg-emerald-500/20"
        >
          Approve
        </button>
      </form>
      <form action={resolveAnomalyAction}>
        <input type="hidden" name="anomalyId" value={anomalyId} />
        <input type="hidden" name="decision" value="REJECTED" />
        <button
          type="submit"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-neg transition-colors hover:bg-red-500/20"
        >
          Reject
        </button>
      </form>
    </div>
  );
}
