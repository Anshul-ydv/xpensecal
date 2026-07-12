import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { computeGroupBalances } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/app/BackButton";
import { Avatar } from "./Avatar";
import { PerPersonTable } from "./PerPersonTable";

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

  const guests = await prisma.member.findMany({
    where: { groupId: id, isGuest: true },
    select: { id: true },
  });
  const guestIds = guests.map((g) => g.id);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <BackButton fallback={`/groups/${group.id}`} className="mb-4" />
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

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Balances</h1>
        <p className="mt-1.5 text-sm text-muted">
          {balances.transfers.length === 0
            ? "Everyone is settled up."
            : `Settle up in ${balances.transfers.length} payment${
                balances.transfers.length === 1 ? "" : "s"
              }.`}
        </p>
      </header>

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
                className="card flex items-center gap-3 px-4 py-3.5"
              >
                <Avatar name={t.fromName} />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate font-medium">{t.fromName}</span>
                  <Arrow />
                  <span className="truncate font-medium">{t.toName}</span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(t.amountMinor, base)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-person net + the exact expenses behind it (Rohan).
          Click a row to expand the full breakdown. */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Per-person summary</h2>
          <p className="mt-1 text-sm text-muted">
            Tap any row to see how the number is made up.
          </p>
        </div>
        <PerPersonTable
          members={balances.members}
          base={base}
          guestIds={guestIds}
        />
      </section>
    </main>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0 text-muted"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
