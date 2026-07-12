"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { runImport } from "@/lib/import/importer";
import { SAMPLE_CSV } from "@/lib/import/sample-data";

export type ImportFormState = { error: string } | null;

// One-click import of the provided expenses_export.csv (uses the known roster
// with Meera's leave / Sam's join dates).
export async function importSampleAction(): Promise<void> {
  const user = await requireUser();
  const { batchId } = await runImport({
    fileText: SAMPLE_CSV,
    filename: "expenses_export.csv",
    userId: user.id,
    groupName: "Flat (imported sample)",
  });
  redirect(`/import/${batchId}`);
}

const uploadSchema = z.object({
  groupName: z.string().trim().min(1, "Group name is required").max(80),
});

// Import an arbitrary uploaded CSV. Unknown names become open-window members
// (payers) or are flagged as non-members (participants only); membership
// windows can be edited afterwards on the group page.
export async function importUploadAction(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const user = await requireUser();

  const parsed = uploadSchema.safeParse({ groupName: formData.get("groupName") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to import" };
  }
  if (file.size > 1_000_000) {
    return { error: "File is too large (max 1 MB)" };
  }
  const fileText = await file.text();
  if (!fileText.trim()) return { error: "The file is empty" };

  let batchId: string;
  try {
    const result = await runImport({
      fileText,
      filename: file.name || "upload.csv",
      userId: user.id,
      groupName: parsed.data.groupName,
      // No preset roster for uploads: payers become members, and other unknown
      // names are flagged as non-members.
      roster: [],
    });
    batchId = result.batchId;
  } catch (e) {
    return {
      error: `Import failed: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  redirect(`/import/${batchId}`);
}
