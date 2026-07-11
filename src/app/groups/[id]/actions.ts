"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SplitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { assertGroupAccess } from "@/lib/groups";
import { isActiveOn } from "@/lib/membership";
import { isSupportedCurrency } from "@/lib/fx";
import { toMinor } from "@/lib/money";
import { createExpense, type SplitMemberInput } from "@/lib/expenses";
import { createSettlement } from "@/lib/settlements";

export type ActionState = { error: string } | { ok: true } | null;

const SPLIT_TYPES: SplitType[] = ["EQUAL", "UNEQUAL", "PERCENTAGE", "SHARE"];

const baseExpenseSchema = z.object({
  groupId: z.string().min(1),
  description: z.string().trim().min(1, "Description is required").max(140),
  date: z.string().min(1, "Date is required"),
  currency: z.string().trim().toUpperCase(),
  amount: z.string().trim().min(1, "Amount is required"),
  splitType: z.enum(["EQUAL", "UNEQUAL", "PERCENTAGE", "SHARE"]),
  paidByMemberId: z.string().min(1, "Select who paid"),
});

export async function createExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = baseExpenseSchema.safeParse({
    groupId: formData.get("groupId"),
    description: formData.get("description"),
    date: formData.get("date"),
    currency: formData.get("currency"),
    amount: formData.get("amount"),
    splitType: formData.get("splitType"),
    paidByMemberId: formData.get("paidByMemberId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { groupId, description, currency, splitType, paidByMemberId } =
    parsed.data;

  await assertGroupAccess(groupId, user.id);

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { baseCurrency: true },
  });

  if (!isSupportedCurrency(currency)) {
    return { error: `Unsupported currency "${currency}". Use INR or USD.` };
  }

  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };

  const amountMinor = toMinor(parsed.data.amount);
  if (amountMinor === null || amountMinor === 0) {
    return { error: "Enter a non-zero amount" };
  }

  const members = await prisma.member.findMany({ where: { groupId } });
  const byId = new Map(members.map((m) => [m.id, m]));

  if (!byId.has(paidByMemberId)) return { error: "Payer is not in this group" };

  // Collect the participants the user ticked and their raw input value.
  const included: { memberId: string; value: string }[] = [];
  for (const m of members) {
    if (formData.get(`include_${m.id}`) === "on") {
      included.push({
        memberId: m.id,
        value: String(formData.get(`value_${m.id}`) ?? "").trim(),
      });
    }
  }
  if (included.length === 0) {
    return { error: "Select at least one participant" };
  }

  // Everyone in the split must have been an active member on the expense date.
  for (const inc of included) {
    const m = byId.get(inc.memberId)!;
    if (!isActiveOn(m, date)) {
      return {
        error: `${m.name} was not an active member on ${parsed.data.date}. Adjust their join/left dates or remove them.`,
      };
    }
  }

  // Resolve each split type into per-member weights (see lib/expenses.ts).
  const splitMembers: SplitMemberInput[] = [];

  if (splitType === "EQUAL") {
    for (const inc of included) {
      splitMembers.push({ memberId: inc.memberId, weight: 1 });
    }
  } else if (splitType === "SHARE") {
    for (const inc of included) {
      const w = Number(inc.value);
      if (!Number.isInteger(w) || w <= 0) {
        return { error: "Shares must be positive whole numbers" };
      }
      splitMembers.push({ memberId: inc.memberId, weight: w });
    }
  } else if (splitType === "PERCENTAGE") {
    let sum = 0;
    for (const inc of included) {
      const p = Number(inc.value);
      if (!Number.isFinite(p) || p <= 0) {
        return { error: "Percentages must be positive numbers" };
      }
      sum += p;
      splitMembers.push({ memberId: inc.memberId, weight: p });
    }
    if (Math.round(sum) !== 100) {
      return { error: `Percentages must add up to 100 (they add up to ${sum})` };
    }
  } else {
    // UNEQUAL: explicit per-person amount in the original currency.
    let sumMinor = 0;
    for (const inc of included) {
      const partMinor = toMinor(inc.value);
      if (partMinor === null || partMinor < 0) {
        return { error: "Each share must be a valid non-negative amount" };
      }
      sumMinor += partMinor;
      splitMembers.push({ memberId: inc.memberId, weight: partMinor });
    }
    if (sumMinor !== amountMinor) {
      return {
        error: `The per-person amounts must add up to the total (${parsed.data.amount})`,
      };
    }
  }

  await createExpense({
    groupId,
    baseCurrency: group.baseCurrency,
    description,
    date,
    currency,
    amountMinor,
    splitType,
    paidByMemberId,
    members: splitMembers,
    notes: null,
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export async function deleteExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) return { error: "Missing expense" };

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { groupId: true },
  });
  if (!expense) return { error: "Expense not found" };
  await assertGroupAccess(expense.groupId, user.id);

  // Splits are removed by the cascade on ExpenseSplit.
  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/groups/${expense.groupId}`);
  return { ok: true };
}

const settlementSchema = z
  .object({
    groupId: z.string().min(1),
    fromMemberId: z.string().min(1, "Select who paid"),
    toMemberId: z.string().min(1, "Select who was paid"),
    date: z.string().min(1, "Date is required"),
    currency: z.string().trim().toUpperCase(),
    amount: z.string().trim().min(1, "Amount is required"),
    note: z.string().trim().max(140).optional(),
  })
  .refine((d) => d.fromMemberId !== d.toMemberId, {
    message: "Payer and receiver must be different people",
  });

export async function createSettlementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = settlementSchema.safeParse({
    groupId: formData.get("groupId"),
    fromMemberId: formData.get("fromMemberId"),
    toMemberId: formData.get("toMemberId"),
    date: formData.get("date"),
    currency: formData.get("currency"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { groupId, fromMemberId, toMemberId, currency } = parsed.data;
  await assertGroupAccess(groupId, user.id);

  if (!isSupportedCurrency(currency)) {
    return { error: `Unsupported currency "${currency}". Use INR or USD.` };
  }
  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) return { error: "Invalid date" };

  const amountMinor = toMinor(parsed.data.amount);
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Enter a positive amount" };
  }

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { baseCurrency: true },
  });
  const memberIds = new Set(
    (await prisma.member.findMany({ where: { groupId }, select: { id: true } })).map(
      (m) => m.id,
    ),
  );
  if (!memberIds.has(fromMemberId) || !memberIds.has(toMemberId)) {
    return { error: "Both members must be in this group" };
  }

  await createSettlement({
    groupId,
    baseCurrency: group.baseCurrency,
    fromMemberId,
    toMemberId,
    date,
    currency,
    amountMinor,
    note: parsed.data.note ?? null,
  });

  revalidatePath(`/groups/${groupId}`);
  return { ok: true };
}

export { SPLIT_TYPES };
