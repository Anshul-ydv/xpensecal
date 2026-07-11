import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { MemberManager, type MemberDTO } from "./MemberManager";

// Formats a Date to the YYYY-MM-DD string an <input type="date"> expects.
function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // params is async in Next.js 16
  const user = await requireUser();

  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

  // Load members with counts of financial records so the UI can lock deletion of
  // anyone already tied to expenses/settlements.
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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <nav className="mb-4 text-sm text-neutral-500">
        <Link href="/groups" className="underline underline-offset-4">
          Groups
        </Link>{" "}
        / {group.name}
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-neutral-500">
          Base currency {group.baseCurrency} · {group._count.expenses} expenses ·{" "}
          {group._count.settlements} settlements
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">Members</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Leave a member&apos;s dates blank for open-ended membership. Set a
          &quot;left&quot; date when someone moves out and a &quot;joined&quot;
          date when someone moves in — balances only count expenses during a
          member&apos;s active window.
        </p>
        <MemberManager groupId={group.id} members={memberDTOs} />
      </section>
    </main>
  );
}
