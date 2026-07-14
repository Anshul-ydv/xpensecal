import type { Prisma, PrismaClient, SplitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFxRate, isSupportedCurrency } from "@/lib/fx";
import { allocateByWeights, formatMinor, roundToMinor } from "@/lib/money";

// A Prisma client or an interactive-transaction client. Lets the importer call
// createExpense inside its own transaction (Step 7).
type Db = PrismaClient | Prisma.TransactionClient;

// Per-member split input. Every split type ultimately reduces to a positive
// integer WEIGHT per member; the base-currency total is then allocated across
// those weights with the largest-remainder method (see money.ts). This keeps a
// single code path for equal, share, percentage, and unequal splits.
//
//   EQUAL      -> weight 1 for everyone
//   SHARE      -> the given integer weight
//   PERCENTAGE -> the given percentage (as weight)
//   UNEQUAL    -> the given per-person amount (original minor units) as weight
export type SplitMemberInput = {
  memberId: string;
  weight: number; // >= 0; interpretation depends on splitType
  rawShare?: string | null; // for display, e.g. "30%", "2", "700.00"
};

export type CreateExpenseInput = {
  db?: Db;
  groupId: string;
  baseCurrency: string;
  description: string;
  date: Date;
  currency: string;
  amountMinor: number; // ORIGINAL currency, minor units (may be negative = refund)
  splitType: SplitType;
  paidByMemberId: string | null;
  members: SplitMemberInput[];
  notes?: string | null;
  status?: "ACTIVE" | "SUPERSEDED" | "VOID";
  importBatchId?: string | null;
  sourceRow?: number | null;
};

// Builds display strings per split type for the raw share column.
export function rawShareFor(
  splitType: SplitType,
  weight: number,
): string | null {
  switch (splitType) {
    case "EQUAL":
      return null;
    case "SHARE":
      return `${weight}`;
    case "PERCENTAGE":
      return `${weight}%`;
    case "UNEQUAL":
      return formatMinor(weight);
  }
}

// Creates an expense together with its resolved per-member splits, in a single
// transaction. Returns the created expense id.
export async function createExpense(input: CreateExpenseInput): Promise<string> {
  const db = input.db ?? prisma;

  // 1. Convert the original amount to the group's base currency and remember the
  //    exact rate used, so the conversion is auditable (Priya's request).
  //
  //    A quarantined row (VOID) may carry an unsupported currency — that is
  //    exactly why it was quarantined. It is excluded from balances, so we keep
  //    it visible for audit with a passthrough rate of 1 instead of throwing and
  //    crashing the whole import. An ACTIVE expense with an unsupported currency
  //    is still a hard error (callers guard against this before we get here).
  const status = input.status ?? "ACTIVE";
  const currencySupported = isSupportedCurrency(input.currency);
  const fxRate =
    !currencySupported && status === "VOID"
      ? 1
      : getFxRate(input.currency, input.baseCurrency);
  const amountBaseMinor = roundToMinor(input.amountMinor * fxRate);

  // 2. Allocate the base total across members by their weights. This is where a
  //    stray rounding penny is assigned deterministically.
  const weights = input.members.map((m) => m.weight);
  const owed = allocateByWeights(amountBaseMinor, weights);

  const run = async (tx: Db) => {
    const expense = await tx.expense.create({
      data: {
        groupId: input.groupId,
        description: input.description,
        date: input.date,
        currency: input.currency.toUpperCase(),
        amountMinor: input.amountMinor,
        amountBaseMinor,
        fxRate,
        splitType: input.splitType,
        paidByMemberId: input.paidByMemberId,
        notes: input.notes ?? null,
        status,
        importBatchId: input.importBatchId ?? null,
        sourceRow: input.sourceRow ?? null,
        splits: {
          create: input.members.map((m, i) => ({
            memberId: m.memberId,
            owedBaseMinor: owed[i],
            rawShare:
              m.rawShare ?? rawShareFor(input.splitType, m.weight),
          })),
        },
      },
    });
    return expense.id;
  };

  // If we're already inside a transaction (importer), reuse it; otherwise open one.
  if (input.db) return run(input.db);
  return prisma.$transaction((tx) => run(tx));
}
