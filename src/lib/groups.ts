import { prisma } from "@/lib/prisma";

// Read-side helpers for groups. Access model: the user who created a group can
// view and manage it. (A richer sharing model is out of scope for this build;
// see DECISIONS.md.)

export async function listGroupsForUser(userId: string) {
  return prisma.group.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { members: true, expenses: true } },
    },
  });
}

// Loads a group with its members, verifying the user owns it. Returns null when
// the group does not exist or the user has no access, so callers can 404.
export async function getGroupForUser(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, createdById: userId },
    include: {
      members: { orderBy: { name: "asc" } },
      _count: { select: { expenses: true, settlements: true } },
    },
  });
  return group;
}

// Throws if the user cannot access the group. Used by mutating actions.
export async function assertGroupAccess(groupId: string, userId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, createdById: userId },
    select: { id: true },
  });
  if (!group) throw new Error("Group not found or access denied");
  return group;
}
