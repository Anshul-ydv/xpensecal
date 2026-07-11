import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFxRate } from "@/lib/fx";
import { roundToMinor } from "@/lib/money";

type Db = PrismaClient | Prisma.TransactionClient;

// A settlement is a direct payment from one member to another (e.g. "Rohan paid
// Aisha back"). It is NOT a shared expense: it has no split, it just moves money
// between two people and reduces what one owes the other.
export type CreateSettlementInput = {
  db?: Db;
  groupId: string;
  baseCurrency: string;
  fromMemberId: string; // the payer
  toMemberId: string; // the receiver
  date: Date;
  currency: string;
  amountMinor: number; // original currency minor units, expected positive
  note?: string | null;
  importBatchId?: string | null;
  sourceRow?: number | null;
};

export async function createSettlement(
  input: CreateSettlementInput,
): Promise<string> {
  const db = input.db ?? prisma;
  const fxRate = getFxRate(input.currency, input.baseCurrency);
  const amountBaseMinor = roundToMinor(input.amountMinor * fxRate);

  const settlement = await db.settlement.create({
    data: {
      groupId: input.groupId,
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      date: input.date,
      currency: input.currency.toUpperCase(),
      amountMinor: input.amountMinor,
      amountBaseMinor,
      fxRate,
      note: input.note ?? null,
      importBatchId: input.importBatchId ?? null,
      sourceRow: input.sourceRow ?? null,
    },
  });
  return settlement.id;
}
