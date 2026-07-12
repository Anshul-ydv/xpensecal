import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { formatMinor, formatMoney } from "@/lib/money";
import { MemberManager, type MemberDTO } from "./MemberManager";
import { NewExpenseForm } from "./NewExpenseForm";
import { NewSettlementForm } from "./NewSettlementForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
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
    include: {
      _count: {
        select: {
          splits: true,
          paidExpenses: true,
          settlementsFrom: true,
          settlementsTo: true,
        },
      },
    },
  });

  const memberDTOs: MemberDTO[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    joinedAt: toDateInput(m.joinedAt),
    leftAt: toDateInput(m.leftAt),
    locked:
      m._count.splits +
        m._count.paidExpenses +
        m._count.settlementsFrom +
        m._count.settlementsTo >
      0,
  }));
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

  return (
    <main className="mx-auto max-w-4xl px-5 py-8 sm:py-10">
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
        <Link
          href={`/groups/${group.id}/balances`}
          className="btn btn-primary"
        >
          View balances
        </Link>
      </header>

      <section className="mb-10">
        <h2 className="mb-2 text-lg font-semibold">Members</h2>
        <p className="mb-4 text-sm text-muted">
          Set a &quot;left&quot; date when someone moves out and a
          &quot;joined&quot; date when someone moves in — expenses only count for
          a member during their active window.
        </p>
        <MemberManager groupId={group.id} members={memberDTOs} />
      </section>

      {members.length > 0 && (
        <section className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <NewExpenseForm groupId={group.id} members={formMembers} />
          <NewSettlementForm groupId={group.id} members={formMembers} />
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
                <li key={e.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {e.description}{" "}
                        {e.status !== "ACTIVE" && (
                          <span className="ml-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300">
                            {e.status.toLowerCase()}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {fmtDate(e.date)} · paid by{" "}
                        {e.paidBy?.name ?? "unknown"} · {SPLIT_LABEL[e.splitType]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">
                        {formatMoney(e.amountBaseMinor, base)}
                      </p>
                      {converted && (
                        <p className="text-xs text-muted">
                          {formatMoney(e.amountMinor, e.currency)} @ {e.fxRate}
                        </p>
                      )}
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer select-none text-xs text-muted transition-colors hover:text-fg">
                      Breakdown ({e.splits.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {e.splits.map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between gap-4 border-b border-dashed border-border pb-1"
                        >
                          <span>
                            {s.member.name}
                            {s.rawShare ? (
                              <span className="text-muted">
                                {" "}
                                ({s.rawShare})
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums">
                            {formatMinor(s.owedBaseMinor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <div className="mt-3 flex justify-end border-t border-border pt-3">
                    <DeleteExpenseButton expenseId={e.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Settlements</h2>
        {settlements.length === 0 ? (
          <div className="card text-sm text-muted">No settlements yet.</div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {settlements.map((s) => (
              <li
                key={s.id}
                className="card flex items-center justify-between px-4 py-3.5 text-sm"
              >
                <span>
                  <span className="font-medium">{s.fromMember.name}</span>{" "}
                  <span className="text-muted">paid</span>{" "}
                  <span className="font-medium">{s.toMember.name}</span>
                  <span className="text-muted">
                    {" "}
                    · {fmtDate(s.date)}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(s.amountBaseMinor, base)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
