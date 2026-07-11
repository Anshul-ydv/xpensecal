import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { computeGroupBalances } from "@/lib/balances";
import { formatMoney, formatMinor } from "@/lib/money";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  const balances = await computeGroupBalances(id);
  const base = balances.baseCurrency;

  return (
    <main className="mx-auto max-w-3xl p-6 sm:p-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/groups" className="underline underline-offset-4">
          Groups
        </Link>{" "}
        /{" "}
        <Link
          href={`/groups/${group.id}`}
          className="underline underline-offset-4"
        >
          {group.name}
        </Link>{" "}
        / Balances
      </nav>

      <h1 className="mb-6 text-2xl font-semibold">Balances</h1>

      {/* Aisha: who pays whom, how much, done. */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Who pays whom</h2>
        {balances.transfers.length === 0 ? (
          <p className="text-sm text-neutral-500">
            All settled up — nobody owes anybody.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {balances.transfers.map((t, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 dark:border-white/15"
              >
                <span>
                  <span className="font-medium">{t.fromName}</span> pays{" "}
                  <span className="font-medium">{t.toName}</span>
                </span>
                <span className="font-medium">
                  {formatMoney(t.amountMinor, base)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-person net + the exact expenses behind it (Rohan). */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Per-person summary</h2>
        <ul className="flex flex-col gap-3">
          {balances.members.map((m) => {
            const owedToThem = m.netMinor > 0;
            const settled = m.netMinor === 0;
            return (
              <li
                key={m.memberId}
                className="rounded-lg border border-black/10 p-4 dark:border-white/15"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <span
                    className={
                      settled
                        ? "text-neutral-500"
                        : owedToThem
                          ? "font-medium text-green-700 dark:text-green-400"
                          : "font-medium text-red-600 dark:text-red-400"
                    }
                  >
                    {settled
                      ? "settled up"
                      : owedToThem
                        ? `is owed ${formatMoney(m.netMinor, base)}`
                        : `owes ${formatMoney(-m.netMinor, base)}`}
                  </span>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-neutral-500">
                    How this number is made up
                  </summary>
                  <div className="mt-3 flex flex-col gap-3 text-sm">
                    <BreakdownBlock
                      title={`Paid for the group (+${formatMinor(m.paidMinor)})`}
                      empty="Paid for nothing"
                      lines={m.contributions.paidExpenses.map((p) => ({
                        left: `${p.date} · ${p.description}`,
                        right: `+${formatMinor(p.amountMinor)}`,
                      }))}
                    />
                    <BreakdownBlock
                      title={`Their share of expenses (−${formatMinor(m.owedMinor)})`}
                      empty="No shares"
                      lines={m.contributions.owedSplits.map((s) => ({
                        left: `${s.date} · ${s.description}${
                          s.rawShare ? ` (${s.rawShare})` : ""
                        }`,
                        right: `−${formatMinor(s.owedMinor)}`,
                      }))}
                    />
                    {m.contributions.settlementsPaid.length > 0 && (
                      <BreakdownBlock
                        title={`Settlements they paid (+${formatMinor(m.settlePaidMinor)})`}
                        empty=""
                        lines={m.contributions.settlementsPaid.map((s) => ({
                          left: `${s.date} · paid ${s.otherName}`,
                          right: `+${formatMinor(s.amountMinor)}`,
                        }))}
                      />
                    )}
                    {m.contributions.settlementsReceived.length > 0 && (
                      <BreakdownBlock
                        title={`Settlements they received (−${formatMinor(m.settleReceivedMinor)})`}
                        empty=""
                        lines={m.contributions.settlementsReceived.map((s) => ({
                          left: `${s.date} · from ${s.otherName}`,
                          right: `−${formatMinor(s.amountMinor)}`,
                        }))}
                      />
                    )}
                    <p className="border-t border-black/10 pt-2 text-right font-medium dark:border-white/15">
                      Net: {formatMoney(m.netMinor, base)}
                    </p>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function BreakdownBlock({
  title,
  empty,
  lines,
}: {
  title: string;
  empty: string;
  lines: { left: string; right: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      {lines.length === 0 ? (
        empty ? (
          <p className="text-xs text-neutral-400">{empty}</p>
        ) : null
      ) : (
        <ul className="mt-1 flex flex-col gap-1">
          {lines.map((l, i) => (
            <li
              key={i}
              className="flex justify-between border-b border-dashed border-black/5 pb-1 dark:border-white/10"
            >
              <span>{l.left}</span>
              <span className="tabular-nums">{l.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
