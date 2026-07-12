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
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
      <nav className="mb-5 text-sm text-muted">
        <Link href="/groups" className="transition-colors hover:text-fg">
          Groups
        </Link>{" "}
        <span className="opacity-50">/</span>{" "}
        <Link
          href={`/groups/${group.id}`}
          className="transition-colors hover:text-fg"
        >
          {group.name}
        </Link>{" "}
        <span className="opacity-50">/</span> Balances
      </nav>

      <h1 className="mb-8 text-3xl font-semibold tracking-tight">Balances</h1>

      {/* Aisha: who pays whom, how much, done. */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Who pays whom</h2>
        {balances.transfers.length === 0 ? (
          <div className="card text-sm text-muted">
            All settled up — nobody owes anybody.
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {balances.transfers.map((t, idx) => (
              <li
                key={idx}
                className="card flex items-center justify-between px-4 py-3.5"
              >
                <span>
                  <span className="font-medium">{t.fromName}</span>{" "}
                  <span className="text-muted">pays</span>{" "}
                  <span className="font-medium">{t.toName}</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(t.amountMinor, base)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-person net + the exact expenses behind it (Rohan). */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Per-person summary</h2>
        <ul className="flex flex-col gap-3">
          {balances.members.map((m) => {
            const owedToThem = m.netMinor > 0;
            const settled = m.netMinor === 0;
            return (
              <li key={m.memberId} className="card">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{m.name}</span>
                  <span
                    className={
                      settled
                        ? "text-sm text-muted"
                        : owedToThem
                          ? "font-semibold tabular-nums text-pos"
                          : "font-semibold tabular-nums text-neg"
                    }
                  >
                    {settled
                      ? "settled up"
                      : owedToThem
                        ? `is owed ${formatMoney(m.netMinor, base)}`
                        : `owes ${formatMoney(-m.netMinor, base)}`}
                  </span>
                </div>

                <details className="mt-2 group">
                  <summary className="cursor-pointer select-none text-xs text-muted transition-colors hover:text-fg">
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
                    <p className="border-t border-border pt-2 text-right font-semibold">
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
      <p className="text-xs font-medium text-muted">{title}</p>
      {lines.length === 0 ? (
        empty ? (
          <p className="text-xs text-muted opacity-70">{empty}</p>
        ) : null
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {lines.map((l, i) => (
            <li
              key={i}
              className="flex justify-between gap-4 border-b border-dashed border-border pb-1"
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
