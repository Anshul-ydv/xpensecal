"use client";

import { useMemo, useState } from "react";
import type { AnomalySeverity } from "@prisma/client";
import { ApproveReject } from "./ApproveReject";
import { resolveAllPendingAction } from "./actions";

export type AnomalyDTO = {
  id: string;
  rowNumber: number;
  type: string; // human label
  severity: AnomalySeverity;
  status: string; // AUTO_APPLIED | PENDING_APPROVAL | APPROVED | REJECTED
  message: string;
  action: string;
  rawRow: string;
};

const STATUS_LABEL: Record<string, string> = {
  AUTO_APPLIED: "auto-applied",
  PENDING_APPROVAL: "needs approval",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const SEVERITY_DOT: Record<AnomalySeverity, string> = {
  ERROR: "bg-red-400",
  WARNING: "bg-amber-400",
  INFO: "bg-sky-400",
};

type SeverityFilter = "ALL" | AnomalySeverity;
type StatusFilter = "ALL" | "PENDING" | "RESOLVED";

export function AnomalyExplorer({
  batchId,
  anomalies,
}: {
  batchId: string;
  anomalies: AnomalyDTO[];
}) {
  const [severity, setSeverity] = useState<SeverityFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { ERROR: 0, WARNING: 0, INFO: 0, pending: 0, resolved: 0 };
    for (const a of anomalies) {
      c[a.severity]++;
      if (a.status === "PENDING_APPROVAL") c.pending++;
      if (a.status === "APPROVED" || a.status === "REJECTED") c.resolved++;
    }
    return c;
  }, [anomalies]);

  const needsApprovalTotal = counts.pending + counts.resolved;
  const progress =
    needsApprovalTotal === 0
      ? 100
      : Math.round((counts.resolved / needsApprovalTotal) * 100);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return anomalies.filter((a) => {
      if (severity !== "ALL" && a.severity !== severity) return false;
      if (status === "PENDING" && a.status !== "PENDING_APPROVAL") return false;
      if (
        status === "RESOLVED" &&
        a.status !== "APPROVED" &&
        a.status !== "REJECTED"
      )
        return false;
      if (query) {
        const hay =
          `${a.rowNumber} ${a.type} ${a.message} ${a.action} ${a.rawRow}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [anomalies, severity, status, q]);

  async function copyRow(a: AnomalyDTO) {
    try {
      await navigator.clipboard.writeText(a.rawRow);
      setCopied(a.id);
      setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  const sevChip = (key: SeverityFilter, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setSeverity(key)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        severity === key
          ? "border-accent bg-accent/15 text-fg"
          : "border-border text-muted hover:text-fg"
      }`}
    >
      {label}
      {count !== undefined ? ` (${count})` : ""}
    </button>
  );

  const statusChip = (key: StatusFilter, label: string) => (
    <button
      type="button"
      onClick={() => setStatus(key)}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        status === key
          ? "border-accent bg-accent/15 text-fg"
          : "border-border text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Approval progress */}
      {needsApprovalTotal > 0 && (
        <div className="card">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Approvals</span>
            <span className="text-muted">
              {counts.resolved} of {needsApprovalTotal} resolved
              {counts.pending > 0 && ` · ${counts.pending} pending`}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {counts.pending > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={resolveAllPendingAction}>
                <input type="hidden" name="batchId" value={batchId} />
                <input type="hidden" name="decision" value="APPROVED" />
                <button
                  type="submit"
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-pos transition-colors hover:bg-emerald-500/20"
                >
                  Approve all pending ({counts.pending})
                </button>
              </form>
              <form
                action={resolveAllPendingAction}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `Reject all ${counts.pending} pending anomalies? Superseded duplicates will be reactivated.`,
                    )
                  )
                    e.preventDefault();
                }}
              >
                <input type="hidden" name="batchId" value={batchId} />
                <input type="hidden" name="decision" value="REJECTED" />
                <button
                  type="submit"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-neg transition-colors hover:bg-red-500/20"
                >
                  Reject all pending
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search anomalies (row, type, message, raw data)…"
          className="field"
        />
        <div className="flex flex-wrap items-center gap-2">
          {sevChip("ALL", "All", anomalies.length)}
          {sevChip("ERROR", "Errors", counts.ERROR)}
          {sevChip("WARNING", "Warnings", counts.WARNING)}
          {sevChip("INFO", "Info", counts.INFO)}
          <span className="mx-1 h-4 w-px bg-border" />
          {statusChip("ALL", "Any status")}
          {statusChip("PENDING", "Needs approval")}
          {statusChip("RESOLVED", "Resolved")}
        </div>
      </div>

      <p className="text-xs text-muted">
        Showing {filtered.length} of {anomalies.length}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-sm text-muted">
          No anomalies match these filters.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((a) => (
            <li key={a.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[a.severity]}`}
                  />
                  Row {a.rowNumber} · {a.type}
                </span>
                <span className="badge">
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
              </div>
              <p className="mt-2.5 text-sm">{a.message}</p>
              <p className="mt-1.5 text-sm text-muted">
                <span className="font-medium text-fg">Action:</span> {a.action}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-bg px-2.5 py-1.5 font-mono text-xs text-faint">
                  {a.rawRow}
                </code>
                <button
                  type="button"
                  onClick={() => copyRow(a)}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-fg"
                  title="Copy raw CSV row"
                >
                  {copied === a.id ? "Copied" : "Copy"}
                </button>
              </div>
              {a.status === "PENDING_APPROVAL" && (
                <div className="mt-3">
                  <ApproveReject anomalyId={a.id} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
