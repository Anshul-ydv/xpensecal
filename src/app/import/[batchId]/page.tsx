import Link from "next/link";
import { notFound } from "next/navigation";
import type { AnomalySeverity } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ANOMALY_META } from "@/lib/import/anomalies";
import { ApproveReject } from "./ApproveReject";

const SEVERITY_ORDER: Record<AnomalySeverity, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
};

// Pill styles for the summary counts.
const SEVERITY_STYLE: Record<AnomalySeverity, string> = {
  ERROR:
    "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
  WARNING:
    "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  INFO: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
};

const SEVERITY_DOT: Record<AnomalySeverity, string> = {
  ERROR: "bg-red-400",
  WARNING: "bg-amber-400",
  INFO: "bg-sky-400",
};

const STATUS_LABEL: Record<string, string> = {
  AUTO_APPLIED: "auto-applied",
  PENDING_APPROVAL: "needs approval",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export default async function ImportReportPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const user = await requireUser();

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      group: { select: { id: true, name: true, createdById: true } },
      anomalies: true,
    },
  });
  if (!batch || batch.group.createdById !== user.id) notFound();

  const anomalies = [...batch.anomalies].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.rowNumber - b.rowNumber,
  );

  const counts = anomalies.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <nav className="mb-5 text-sm text-muted">
        <Link href="/import" className="transition-colors hover:text-fg">
          Import
        </Link>{" "}
        <span className="opacity-50">/</span> Report
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Import report</h1>
        <p className="mt-1.5 text-sm text-muted">
          {batch.filename} · imported into{" "}
          <Link
            href={`/groups/${batch.group.id}`}
            className="text-fg underline underline-offset-4 decoration-border hover:decoration-accent"
          >
            {batch.group.name}
          </Link>
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Rows read" value={batch.totalRows} />
        <Stat label="Active expenses" value={batch.importedExpenses} />
        <Stat label="Settlements" value={batch.importedSettlements} />
        <Stat label="Quarantined" value={batch.skippedRows} />
        <Stat label="Anomalies" value={anomalies.length} />
      </section>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {(["ERROR", "WARNING", "INFO"] as AnomalySeverity[]).map((s) =>
          counts[s] ? (
            <span
              key={s}
              className={`rounded-full border px-3 py-1 font-medium ${SEVERITY_STYLE[s]}`}
            >
              {counts[s]} {s.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>

      <div className="mb-9 flex gap-3">
        <Link href={`/groups/${batch.group.id}/balances`} className="btn btn-primary">
          View balances
        </Link>
        <Link href={`/groups/${batch.group.id}`} className="btn btn-ghost">
          Open group
        </Link>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Anomalies detected{" "}
          <span className="text-muted">({anomalies.length})</span>
        </h2>
        {anomalies.length === 0 ? (
          <p className="text-sm text-muted">No anomalies — clean import.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {anomalies.map((a) => (
              <li key={a.id} className="card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${SEVERITY_DOT[a.severity]}`}
                    />
                    Row {a.rowNumber} · {ANOMALY_META[a.type].label}
                  </span>
                  <span className="badge">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <p className="mt-2.5 text-sm">{a.message}</p>
                <p className="mt-1.5 text-sm text-muted">
                  <span className="font-medium text-fg">Action:</span> {a.action}
                </p>
                <p className="mt-3 truncate rounded-md bg-bg px-2.5 py-1.5 font-mono text-xs text-faint">
                  {a.rawRow}
                </p>
                {a.status === "PENDING_APPROVAL" && (
                  <div className="mt-3">
                    <ApproveReject anomalyId={a.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-3 py-4 text-center">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
