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
