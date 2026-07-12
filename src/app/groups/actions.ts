"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertGroupAccess } from "@/lib/groups";
import { normalizeName } from "@/lib/names";

export type ActionState = { error: string } | null;

// Coerces an empty/absent date field to null, otherwise parses YYYY-MM-DD.
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((v) => v === null || !Number.isNaN(v.getTime()), "Invalid date");

const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(80),
  baseCurrency: z.string().trim().length(3).toUpperCase().default("INR"),
});

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    baseCurrency: formData.get("baseCurrency") || "INR",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name,
      baseCurrency: parsed.data.baseCurrency,
      createdById: user.id,
    },
  });

  redirect(`/groups/${group.id}`);
}

const memberSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1, "Member name is required"),
  joinedAt: optionalDate,
  leftAt: optionalDate,
});

export async function addMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = memberSchema.safeParse({
    groupId: formData.get("groupId"),
    name: formData.get("name"),
    joinedAt: formData.get("joinedAt"),
    leftAt: formData.get("leftAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { groupId, joinedAt, leftAt } = parsed.data;
  const name = normalizeName(parsed.data.name);
  if (!name) return { error: "Member name is required" };
  if (joinedAt && leftAt && leftAt < joinedAt) {
    return { error: "Left date cannot be before joined date" };
  }

  await assertGroupAccess(groupId, user.id);

  const existing = await prisma.member.findUnique({
    where: { groupId_name: { groupId, name } },
  });
  if (existing) return { error: `"${name}" is already a member` };

  await prisma.member.create({ data: { groupId, name, joinedAt, leftAt } });
  revalidatePath(`/groups/${groupId}`);
  return null;
}

const updateMemberSchema = z.object({
  memberId: z.string().min(1),
  joinedAt: optionalDate,
  leftAt: optionalDate,
});

export async function updateMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    joinedAt: formData.get("joinedAt"),
    leftAt: formData.get("leftAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { memberId, joinedAt, leftAt } = parsed.data;
  if (joinedAt && leftAt && leftAt < joinedAt) {
    return { error: "Left date cannot be before joined date" };
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { groupId: true },
  });
  if (!member) return { error: "Member not found" };
  await assertGroupAccess(member.groupId, user.id);

  await prisma.member.update({
    where: { id: memberId },
    data: { joinedAt, leftAt },
  });
  revalidatePath(`/groups/${member.groupId}`);
  return null;
}

export async function deleteGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return { error: "Missing group" };

  // Ownership is enforced here; the DB cascade (see schema.prisma) removes the
  // group's members, expenses, settlements, and import batches in one step.
  await assertGroupAccess(groupId, user.id);
  await prisma.group.delete({ where: { id: groupId } });

  revalidatePath("/dashboard");
  revalidatePath("/groups");
  return null;
}

export async function deleteMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return { error: "Missing member" };

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      groupId: true,
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
  if (!member) return { error: "Member not found" };
  await assertGroupAccess(member.groupId, user.id);

  // Refuse to delete a member who appears in any financial record; removing them
  // would silently distort historical balances. They should be marked as "left"
  // instead. This keeps the ledger internally consistent.
  const c = member._count;
  if (c.splits + c.paidExpenses + c.settlementsFrom + c.settlementsTo > 0) {
    return {
      error:
        "This member is part of existing expenses or settlements. Set a 'left' date instead of deleting.",
    };
  }

  await prisma.member.delete({ where: { id: memberId } });
  revalidatePath(`/groups/${member.groupId}`);
  return null;
}
