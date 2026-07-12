import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { formatMinor, formatMoney } from "@/lib/money";
import { BackButton } from "@/app/BackButton";
import { NewExpenseForm } from "./NewExpenseForm";
import { NewSettlementForm } from "./NewSettlementForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const SPLIT_LABEL: Record<string, string> = {
  EQUAL: "equal",
  UNEQUAL: "unequal",
  PERCENTAGE: "percentage",
  SHARE: "shares",
};

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();
  const base = group.baseCurrency;

  const members = await prisma.member.findMany({
    where: { groupId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const formMembers = members.map((m) => ({ id: m.id, name: m.name }));

  // Expenses newest first, with their resolved per-member breakdown (Rohan's
  // "show me exactly which expenses make up my number").
  const expenses = await prisma.expense.findMany({
    where: { groupId: id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      paidBy: { select: { name: true } },
      splits: {
        include: { member: { select: { name: true } } },
        orderBy: { member: { name: "asc" } },
      },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId: id },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      fromMember: { select: { name: true } },
      toMember: { select: { name: true } },
    },
  });

  // If this group was created by a CSV import, link straight to its report.
  const importBatch = await prisma.importBatch.findFirst({
    where: { groupId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  // Non-member guests the importer excluded from each expense's split (e.g.
  // "Dev's friend Kabir"). Surfaced on the expense so the handling is visible
  // in the ledger, not only in the import report.
  const nonMemberAnomalies = await prisma.importAnomaly.findMany({
    where: { type: "NON_MEMBER_PARTICIPANT", expense: { groupId: id } },
    select: { expenseId: true, message: true },
  });
  const excludedByExpense = new Map<string, string[]>();
  for (const a of nonMemberAnomalies) {
    if (!a.expenseId) continue;
    const name = a.message.match(/"([^"]+)"/)?.[1];
    if (!name) continue;
    const list = excludedByExpense.get(a.expenseId) ?? [];
    list.push(name);
    excludedByExpense.set(a.expenseId, list);
  }

  // Pre-format settlements for the client form's "previous settlements" list.
  const settlementDTOs = settlements.map((s) => ({
    id: s.id,
    fromName: s.fromMember.name,
    toName: s.toMember.name,
    date: fmtDate(s.date),
    amount: formatMoney(s.amountBaseMinor, base),
    note: s.note ?? null,
  }));

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
      <BackButton fallback="/groups" className="mb-4" />
      <nav className="mb-5 text-sm text-muted">
        <Link href="/groups" className="transition-colors hover:text-fg">
          Groups
        </Link>{" "}
        <span className="opacity-50">/</span> {group.name}
      </nav>

      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
          <p className="mt-1.5 text-sm text-muted">
            Base currency {base} · {expenses.length} expenses ·{" "}
            {settlements.length} settlements
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {importBatch && (
            <Link
              href={`/import/${importBatch.id}`}
              className="btn btn-ghost"
            >
              Import report
            </Link>
          )}
          <Link
            href={`/groups/${group.id}/members`}
            className="btn btn-ghost"
          >
            Manage members
          </Link>
          <Link
            href={`/groups/${group.id}/balances`}
            className="btn btn-primary"
          >
            View balances
          </Link>
        </div>
      </header>

      {members.length === 0 && (
        <div className="card mb-10 flex flex-col items-start gap-3 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            No members yet. Add people to the group before recording expenses.
          </span>
          <Link
            href={`/groups/${group.id}/members`}
            className="btn btn-primary shrink-0"
          >
            Add members
          </Link>
        </div>
      )}

      {members.length > 0 && (
        <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NewExpenseForm groupId={group.id} members={formMembers} />
          <NewSettlementForm
            groupId={group.id}
            members={formMembers}
            recent={settlementDTOs}
          />
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Expenses</h2>
        {expenses.length === 0 ? (
          <div className="card text-sm text-muted">No expenses yet.</div>
        ) : (
          <ul className="flex flex-col gap-3">
            {expenses.map((e) => {
              const converted = e.currency !== base;
              return (
                <li key={e.id} className="card overflow-hidden p-0">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 transition-colors hover:bg-elevated [&::-webkit-details-marker]:hidden">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
                        aria-hidden
                      >
                        <path
                          d="M9 6l6 6-6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {e.description}
                          {e.status !== "ACTIVE" && (
                            <span className="ml-1.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                              {e.status.toLowerCase()}
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {fmtDate(e.date)} · paid by{" "}
                          {e.paidBy?.name ?? "unknown"} ·{" "}
                          {SPLIT_LABEL[e.splitType]}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums">
                          {formatMoney(e.amountBaseMinor, base)}
                        </p>
                        {converted && (
                          <p className="text-xs text-muted">
                            {formatMoney(e.amountMinor, e.currency)} @ {e.fxRate}
                          </p>
                        )}
                      </div>
                    </summary>

                    <div className="border-t border-border bg-bg px-4 py-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                        Split breakdown ({e.splits.length})
                      </p>
                      <ul className="flex flex-col gap-1 text-sm">
                        {e.splits.map((s) => (
                          <li
                            key={s.id}
                            className="flex justify-between gap-4 border-b border-dashed border-border pb-1 last:border-0"
                          >
                            <span>
                              {s.member.name}
                              {s.rawShare ? (
                                <span className="text-muted"> ({s.rawShare})</span>
                              ) : null}
                            </span>
                            <span className="tabular-nums">
                              {formatMinor(s.owedBaseMinor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {(() => {
                        const excluded = excludedByExpense.get(e.id);
                        if (!excluded || excluded.length === 0) return null;
                        return (
                          <p className="mt-3 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-300">
                            {excluded.length} non-member
                            {excluded.length > 1 ? "s" : ""} excluded:{" "}
                            {excluded.join(", ")} — their share was redistributed
                            among the members above.
                          </p>
                        );
                      })()}
                      <div className="mt-3 flex justify-end">
                        <DeleteExpenseButton expenseId={e.id} />
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
