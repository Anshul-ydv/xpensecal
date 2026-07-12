import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getGroupForUser } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/app/BackButton";
import { MemberManager, type MemberDTO } from "../MemberManager";

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export default async function GroupMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const group = await getGroupForUser(id, user.id);
  if (!group) notFound();

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
    isGuest: m.isGuest,
  }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 sm:py-10">
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
        <span className="opacity-50">/</span> Members
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1.5 text-sm text-muted">
          Set a &quot;left&quot; date when someone moves out and a
          &quot;joined&quot; date when someone moves in — expenses only count for
          a member during their active window.
        </p>
      </header>

      <MemberManager groupId={group.id} members={memberDTOs} />
    </main>
  );
}
