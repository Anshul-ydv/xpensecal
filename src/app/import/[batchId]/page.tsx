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

const SEVERITY_STYLE: Record<AnomalySeverity, string> = {
  ERROR:
    "border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300",
  WARNING:
    "border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  INFO: "border-sky-500/30 bg-sky-50 text-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
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
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/import" className="underline underline-offset-4">
          Import
        </Link>{" "}
        / Report
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Import report</h1>
        <p className="text-sm text-neutral-500">
          {batch.filename} · imported into{" "}
          <Link
            href={`/groups/${batch.group.id}`}
            className="underline underline-offset-4"
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
              className={`rounded-full border px-3 py-1 ${SEVERITY_STYLE[s]}`}
            >
              {counts[s]} {s.toLowerCase()}
            </span>
          ) : null,
        )}
      </div>

      <div className="mb-6 flex gap-3">
        <Link
          href={`/groups/${batch.group.id}/balances`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          View balances
        </Link>
        <Link
          href={`/groups/${batch.group.id}`}
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Open group
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Anomalies detected ({anomalies.length})
        </h2>
        {anomalies.length === 0 ? (
          <p className="text-sm text-neutral-500">No anomalies — clean import.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {anomalies.map((a) => (
              <li
                key={a.id}
                className={`rounded-lg border p-4 ${SEVERITY_STYLE[a.severity]}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Row {a.rowNumber} · {ANOMALY_META[a.type].label}
                  </span>
                  <span className="rounded-full border border-black/20 px-2 py-0.5 text-xs dark:border-white/20">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
                <p className="mt-1 text-sm">{a.message}</p>
                <p className="mt-1 text-sm opacity-80">
                  <span className="font-medium">Action:</span> {a.action}
                </p>
                <p className="mt-2 truncate font-mono text-xs opacity-60">
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
    <div className="rounded-lg border border-black/10 p-3 text-center dark:border-white/15">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
