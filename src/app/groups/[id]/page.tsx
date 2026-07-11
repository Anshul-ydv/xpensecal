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
    <main className="mx-auto max-w-4xl p-6 sm:p-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/groups" className="underline underline-offset-4">
          Groups
        </Link>{" "}
        / {group.name}
      </nav>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="text-sm text-neutral-500">
            Base currency {base} · {expenses.length} expenses ·{" "}
            {settlements.length} settlements
          </p>
        </div>
        <Link
          href={`/groups/${group.id}/balances`}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          View balances
        </Link>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Members</h2>
        <p className="mb-4 text-sm text-neutral-500">
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
        <h2 className="mb-3 text-lg font-medium">Expenses</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-neutral-500">No expenses yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {expenses.map((e) => {
              const converted = e.currency !== base;
              return (
                <li
                  key={e.id}
                  className="rounded-lg border border-black/10 p-4 dark:border-white/15"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {e.description}{" "}
                        {e.status !== "ACTIVE" && (
                          <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {e.status.toLowerCase()}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {fmtDate(e.date)} · paid by{" "}
                        {e.paidBy?.name ?? "unknown"} · {SPLIT_LABEL[e.splitType]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatMoney(e.amountBaseMinor, base)}
                      </p>
                      {converted && (
                        <p className="text-xs text-neutral-500">
                          {formatMoney(e.amountMinor, e.currency)} @ {e.fxRate}
                        </p>
                      )}
                    </div>
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-neutral-500">
                      Breakdown ({e.splits.length})
                    </summary>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {e.splits.map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between border-b border-dashed border-black/5 pb-1 dark:border-white/10"
                        >
                          <span>
                            {s.member.name}
                            {s.rawShare ? (
                              <span className="text-neutral-400">
                                {" "}
                                ({s.rawShare})
                              </span>
                            ) : null}
                          </span>
                          <span>{formatMinor(s.owedBaseMinor)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <div className="mt-2 flex justify-end">
                    <DeleteExpenseButton expenseId={e.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Settlements</h2>
        {settlements.length === 0 ? (
          <p className="text-sm text-neutral-500">No settlements yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {settlements.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-sm dark:border-white/15"
              >
                <span>
                  <span className="font-medium">{s.fromMember.name}</span> paid{" "}
                  <span className="font-medium">{s.toMember.name}</span>
                  <span className="text-neutral-500">
                    {" "}
                    · {fmtDate(s.date)}
                    {s.note ? ` · ${s.note}` : ""}
                  </span>
                </span>
                <span className="font-medium">
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
