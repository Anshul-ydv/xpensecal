"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

// Meera's request: "I want to approve anything the app deletes or changes."
// Anomalies that changed data start as PENDING_APPROVAL. Here a user either
// APPROVES the importer's action (it stands) or REJECTS it.
//
// Rejecting a duplicate reactivates the superseded expense (undoing the only
// easily-reversible destructive change). For quarantined rows (missing payer,
// bad date, etc.) rejection just records the decision — those need the
// underlying data fixed on the group page before they can count.
export async function resolveAnomalyAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const anomalyId = String(formData.get("anomalyId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!anomalyId || (decision !== "APPROVED" && decision !== "REJECTED")) return;

  const anomaly = await prisma.importAnomaly.findUnique({
    where: { id: anomalyId },
    include: { importBatch: { select: { groupId: true, group: { select: { createdById: true } } } } },
  });
  if (!anomaly) return;
  if (anomaly.importBatch.group.createdById !== user.id) return; // access check

  await prisma.$transaction(async (tx) => {
    await tx.importAnomaly.update({
      where: { id: anomalyId },
      data: { status: decision as "APPROVED" | "REJECTED" },
    });

    // Reversible undo: if a duplicate was superseded and the user rejects that,
    // bring the expense back into the balances.
    if (
      decision === "REJECTED" &&
      (anomaly.type === "DUPLICATE_EXACT" ||
        anomaly.type === "DUPLICATE_CONFLICTING") &&
      anomaly.expenseId
    ) {
      await tx.expense.update({
        where: { id: anomaly.expenseId },
        data: { status: "ACTIVE" },
      });
    }
  });

  revalidatePath(`/import/${anomaly.importBatchId}`);
}

// Bulk version: approve or reject every still-pending anomaly in a batch in one
// click. Same access check and same reversible-undo rule as the single action.
export async function resolveAllPendingAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const batchId = String(formData.get("batchId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!batchId || (decision !== "APPROVED" && decision !== "REJECTED")) return;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { group: { select: { createdById: true } } },
  });
  if (!batch || batch.group.createdById !== user.id) return; // access check

  const pending = await prisma.importAnomaly.findMany({
    where: { importBatchId: batchId, status: "PENDING_APPROVAL" },
    select: { id: true, type: true, expenseId: true },
  });
  if (pending.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.importAnomaly.updateMany({
      where: { importBatchId: batchId, status: "PENDING_APPROVAL" },
      data: { status: decision as "APPROVED" | "REJECTED" },
    });

    // Rejecting duplicates reactivates the superseded expenses.
    if (decision === "REJECTED") {
      const expenseIds = pending
        .filter(
          (a) =>
            (a.type === "DUPLICATE_EXACT" ||
              a.type === "DUPLICATE_CONFLICTING") &&
            a.expenseId,
        )
        .map((a) => a.expenseId as string);
      if (expenseIds.length > 0) {
        await tx.expense.updateMany({
          where: { id: { in: expenseIds } },
          data: { status: "ACTIVE" },
        });
      }
    }
  });

  revalidatePath(`/import/${batchId}`);
}
