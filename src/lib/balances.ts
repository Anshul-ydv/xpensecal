import { prisma } from "@/lib/prisma";

// Balance calculation.
//
// Convention: a member's NET balance is (what they are owed) minus (what they
// owe), in base-currency minor units.
//   net > 0  -> the group owes them   (creditor)
//   net < 0  -> they owe the group    (debtor)
//
//   net_i =  Σ amount of expenses i PAID
//          − Σ i's share of every expense (their splits)
//          + Σ settlements i PAID to others   (paying reduces their debt)
//          − Σ settlements i RECEIVED          (receiving increases their debt)
//
// Because every expense's splits sum exactly to its amount, and each settlement
// adds +x/−x, the sum of all members' net balances is always zero. Only ACTIVE
// expenses count (duplicates marked SUPERSEDED and zero-amount VOID rows are
// excluded), which is exactly how the importer quarantines bad rows.

export type PaidExpenseLine = {
  id: string;
  description: string;
  date: string;
  amountMinor: number;
};
export type OwedSplitLine = {
  expenseId: string;
  description: string;
  date: string;
  owedMinor: number;
  rawShare: string | null;
};
export type SettlementLine = {
  id: string;
  otherName: string;
  date: string;
  amountMinor: number;
};

export type MemberBalance = {
  memberId: string;
  name: string;
  paidMinor: number;
  owedMinor: number;
  settlePaidMinor: number;
  settleReceivedMinor: number;
  netMinor: number;
  contributions: {
    paidExpenses: PaidExpenseLine[];
    owedSplits: OwedSplitLine[];
    settlementsPaid: SettlementLine[];
    settlementsReceived: SettlementLine[];
  };
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountMinor: number;
};

export type GroupBalances = {
  baseCurrency: string;
  members: MemberBalance[];
  transfers: Transfer[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function computeGroupBalances(
  groupId: string,
): Promise<GroupBalances> {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { baseCurrency: true },
  });

  const members = await prisma.member.findMany({
    where: { groupId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Only ACTIVE expenses feed balances (SUPERSEDED duplicates and VOID rows are
  // deliberately excluded).
  const expenses = await prisma.expense.findMany({
    where: { groupId, status: "ACTIVE" },
    select: {
      id: true,
      description: true,
      date: true,
      amountBaseMinor: true,
      paidByMemberId: true,
      splits: {
        select: { memberId: true, owedBaseMinor: true, rawShare: true },
      },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId },
    select: {
      id: true,
      date: true,
      amountBaseMinor: true,
      fromMemberId: true,
      toMemberId: true,
    },
  });

  const nameById = new Map(members.map((m) => [m.id, m.name]));

  // Seed one accumulator per member.
  const acc = new Map<string, MemberBalance>();
  for (const m of members) {
    acc.set(m.id, {
      memberId: m.id,
      name: m.name,
      paidMinor: 0,
      owedMinor: 0,
      settlePaidMinor: 0,
      settleReceivedMinor: 0,
      netMinor: 0,
      contributions: {
        paidExpenses: [],
        owedSplits: [],
        settlementsPaid: [],
        settlementsReceived: [],
      },
    });
  }

  for (const e of expenses) {
    // What the payer fronted.
    if (e.paidByMemberId) {
      const payer = acc.get(e.paidByMemberId);
      if (payer) {
        payer.paidMinor += e.amountBaseMinor;
        payer.contributions.paidExpenses.push({
          id: e.id,
          description: e.description,
          date: iso(e.date),
          amountMinor: e.amountBaseMinor,
        });
      }
    }
    // What each participant owes.
    for (const s of e.splits) {
      const mb = acc.get(s.memberId);
      if (mb) {
        mb.owedMinor += s.owedBaseMinor;
        mb.contributions.owedSplits.push({
          expenseId: e.id,
          description: e.description,
          date: iso(e.date),
          owedMinor: s.owedBaseMinor,
          rawShare: s.rawShare,
        });
      }
    }
  }

  for (const st of settlements) {
    const from = acc.get(st.fromMemberId);
    const to = acc.get(st.toMemberId);
    if (from) {
      from.settlePaidMinor += st.amountBaseMinor;
      from.contributions.settlementsPaid.push({
        id: st.id,
        otherName: nameById.get(st.toMemberId) ?? "?",
        date: iso(st.date),
        amountMinor: st.amountBaseMinor,
      });
    }
    if (to) {
      to.settleReceivedMinor += st.amountBaseMinor;
      to.contributions.settlementsReceived.push({
        id: st.id,
        otherName: nameById.get(st.fromMemberId) ?? "?",
        date: iso(st.date),
        amountMinor: st.amountBaseMinor,
      });
    }
  }

  const memberBalances = [...acc.values()];
  for (const mb of memberBalances) {
    mb.netMinor =
      mb.paidMinor - mb.owedMinor + mb.settlePaidMinor - mb.settleReceivedMinor;
  }

  return {
    baseCurrency: group.baseCurrency,
    members: memberBalances,
    transfers: simplifyDebts(memberBalances),
  };
}

// Turns net balances into a minimal-ish set of "X pays Y" transfers (Aisha:
// "who pays whom, how much, done"). Greedy largest-debtor / largest-creditor
// matching: not provably the theoretical minimum number of transactions (that
// problem is NP-hard), but it is simple, deterministic, and produces few, clean
// transfers. See DECISIONS.md.
export function simplifyDebts(members: MemberBalance[]): Transfer[] {
  const debtors = members
    .filter((m) => m.netMinor < 0)
    .map((m) => ({ id: m.memberId, name: m.name, amt: -m.netMinor }))
    .sort((a, b) => b.amt - a.amt);
  const creditors = members
    .filter((m) => m.netMinor > 0)
    .map((m) => ({ id: m.memberId, name: m.name, amt: m.netMinor }))
    .sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    if (pay > 0) {
      transfers.push({
        fromId: debtors[i].id,
        fromName: debtors[i].name,
        toId: creditors[j].id,
        toName: creditors[j].name,
        amountMinor: pay,
      });
    }
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return transfers;
}
