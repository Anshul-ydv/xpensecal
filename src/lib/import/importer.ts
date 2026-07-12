import type { AnomalyType, Prisma, SplitType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { normalizeName } from "@/lib/names";
import { isActiveOn } from "@/lib/membership";
import { toMinor } from "@/lib/money";
import { getFxRate, isSupportedCurrency } from "@/lib/fx";
import { createExpense, type SplitMemberInput } from "@/lib/expenses";
import { createSettlement } from "@/lib/settlements";
import { ANOMALY_META, statusFor } from "./anomalies";
import { SAMPLE_ROSTER, type RosterEntry } from "./roster";

type Tx = Prisma.TransactionClient;

// Earliest date we consider plausible for this ledger; anything before it (e.g.
// the "2014" airport-cab typo) is quarantined rather than silently trusted.
const MIN_PLAUSIBLE_DATE = new Date("2026-01-01");

export type ImportResult = { batchId: string; groupId: string };

// ---- small parsing helpers -------------------------------------------------

// "Aisha;Rohan;Priya" -> ["Aisha","Rohan","Priya"]
function splitNames(raw: string): string[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// "Rohan 700; Priya 400" -> Map { normalizedName -> "700" }
// Handles trailing % too ("Aisha 30%").
function parseDetails(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of raw.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)[\s]+([\d.]+)%?$/);
    if (m) map.set(normalizeName(m[1]), m[2]);
  }
  return map;
}

// Duplicate-detection key: date + a stopword-stripped, sorted token set of the
// description. This makes "Dinner at Marina Bites" and "dinner - marina bites"
// collide, and likewise the two Thalassa rows, without falsely merging monthly
// bills (which fall on different dates).
const STOPWORDS = new Set(["at", "the", "a", "an", "and", "for", "of"]);
function descriptionKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .sort()
    .join(" ");
}

// Notes heuristic for the deliberately ambiguous date row
// ("is this April 5 or May 4? format is a mess").
function notesSuggestDateAmbiguity(notes: string): boolean {
  return (
    /\bor\b/i.test(notes) &&
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(notes) &&
    /\d/.test(notes)
  );
}

function notesSuggestSettlement(notes: string): boolean {
  return /\b(settle|settlement|deposit)\b/i.test(notes) || /paid .*back/i.test(notes);
}

// ---- row model -------------------------------------------------------------

type RawRow = {
  rowNumber: number; // 1-based data row
  raw: string;
  date: string;
  description: string;
  paidBy: string;
  amount: string;
  currency: string;
  splitType: string;
  splitWith: string;
  splitDetails: string;
  notes: string;
};

type DupRole = "none" | "winner" | "exact" | "conflict";

function toRawRows(header: string[], rows: string[][]): RawRow[] {
  const idx = (name: string) =>
    header.findIndex((h) => h.trim().toLowerCase() === name);
  const di = idx("date");
  const de = idx("description");
  const pb = idx("paid_by");
  const am = idx("amount");
  const cu = idx("currency");
  const st = idx("split_type");
  const sw = idx("split_with");
  const sd = idx("split_details");
  const no = idx("notes");
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

  return rows.map((r, i) => ({
    rowNumber: i + 1,
    raw: r.join(","),
    date: at(r, di),
    description: at(r, de),
    paidBy: at(r, pb),
    amount: at(r, am),
    currency: at(r, cu),
    splitType: at(r, st),
    splitWith: at(r, sw),
    splitDetails: at(r, sd),
    notes: at(r, no),
  }));
}

// Assigns each row a duplicate role based on (date + description-token) groups.
function classifyDuplicates(rows: RawRow[]): Map<number, DupRole> {
  const groups = new Map<string, RawRow[]>();
  for (const r of rows) {
    const key = `${r.date}|${descriptionKey(r.description)}`;
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }

  const roles = new Map<number, DupRole>();
  for (const arr of groups.values()) {
    if (arr.length === 1) {
      roles.set(arr[0].rowNumber, "none");
      continue;
    }
    const winner = arr[0]; // first row in file order wins; humans can override
    roles.set(winner.rowNumber, "winner");
    for (let k = 1; k < arr.length; k++) {
      const r = arr[k];
      const samePayer = normalizeName(r.paidBy) === normalizeName(winner.paidBy);
      const sameAmount = r.amount.trim() === winner.amount.trim();
      const sameCurrency =
        r.currency.trim().toUpperCase() === winner.currency.trim().toUpperCase();
      roles.set(
        r.rowNumber,
        samePayer && sameAmount && sameCurrency ? "exact" : "conflict",
      );
    }
  }
  return roles;
}

// ---- main importer ---------------------------------------------------------

export async function runImport(opts: {
  fileText: string;
  filename: string;
  userId: string;
  groupName: string;
  baseCurrency?: string;
  roster?: RosterEntry[];
}): Promise<ImportResult> {
  const base = (opts.baseCurrency ?? "INR").toUpperCase();
  const roster = opts.roster ?? SAMPLE_ROSTER;

  const { header, rows } = parseCsv(opts.fileText);
  const rawRows = toRawRows(header, rows);
  const dupRoles = classifyDuplicates(rawRows);

  return prisma.$transaction(
    async (tx) => {
      const group = await tx.group.create({
        data: { name: opts.groupName, baseCurrency: base, createdById: opts.userId },
      });

      // Seed the known roster with their membership windows.
      for (const entry of roster) {
        await tx.member.create({
          data: {
            groupId: group.id,
            name: normalizeName(entry.name),
            joinedAt: entry.joinedAt ? new Date(entry.joinedAt) : null,
            leftAt: entry.leftAt ? new Date(entry.leftAt) : null,
          },
        });
      }
      const members = await tx.member.findMany({ where: { groupId: group.id } });
      const byName = new Map(members.map((m) => [m.name, m]));

      const batch = await tx.importBatch.create({
        data: {
          groupId: group.id,
          createdById: opts.userId,
          filename: opts.filename,
          totalRows: rawRows.length,
        },
      });

      let activeExpenses = 0;
      let settlementsCreated = 0;
      let quarantined = 0; // superseded or voided expense rows

      const record = async (
        row: RawRow,
        type: AnomalyType,
        message: string,
        action: string,
        link: { expenseId?: string; settlementId?: string } = {},
      ) => {
        await tx.importAnomaly.create({
          data: {
            importBatchId: batch.id,
            rowNumber: row.rowNumber,
            rawRow: row.raw,
            type,
            severity: ANOMALY_META[type].severity,
            status: statusFor(type),
            message,
            action,
            expenseId: link.expenseId ?? null,
            settlementId: link.settlementId ?? null,
          },
        });
      };

      // Ensures a member exists for a payer name (payers are always members).
      const ensurePayer = async (name: string) => {
        const norm = normalizeName(name);
        const existing = byName.get(norm);
        if (existing) return existing;
        const created = await tx.member.create({
          data: { groupId: group.id, name: norm },
        });
        byName.set(norm, created);
        return created;
      };

      for (const row of rawRows) {
        const dup = dupRoles.get(row.rowNumber) ?? "none";
        // Anomalies gathered for this row, recorded after the record is created.
        const pending: { type: AnomalyType; message: string; action: string }[] =
          [];

        // --- date ---
        const date = new Date(row.date);
        const dateInvalid = Number.isNaN(date.getTime());
        const dateOutOfRange = !dateInvalid && date < MIN_PLAUSIBLE_DATE;

        // --- amount ---
        const amountNumber = Number(row.amount);
        const amountMinor = toMinor(row.amount);
        const isSubunit =
          amountMinor !== null &&
          Math.abs(amountNumber * 100 - Math.round(amountNumber * 100)) > 1e-9;

        // --- currency ---
        let currency = row.currency.trim().toUpperCase();
        const currencyMissing = currency === "";
        if (currencyMissing) currency = base;

        // ----- settlement path (a payment, not a shared expense) -----
        const isSettlement =
          row.splitType.trim() === "" ||
          (notesSuggestSettlement(row.notes) &&
            splitNames(row.splitWith).length === 1);

        if (isSettlement) {
          const fromM = await ensurePayer(row.paidBy || "Unknown");
          const toNames = splitNames(row.splitWith);
          const toM = toNames.length
            ? byName.get(normalizeName(toNames[0]))
            : undefined;
          if (!toM || amountMinor === null || amountMinor <= 0) {
            // Cannot form a valid settlement; log and skip creating a record.
            await record(
              row,
              "SETTLEMENT_AS_EXPENSE",
              `Row looks like a settlement but is incomplete (to="${row.splitWith}", amount="${row.amount}")`,
              "Skipped: could not resolve payer/receiver/amount.",
            );
            quarantined++;
            continue;
          }
          if (currencyMissing)
            pending.push({
              type: "MISSING_CURRENCY",
              message: `No currency given; assumed ${base}.`,
              action: `Recorded settlement in ${base}.`,
            });
          if (currency === "USD")
            pending.push({
              type: "FOREIGN_CURRENCY",
              message: `Amount in USD converted at ${getFxRate("USD", base)}.`,
              action: `Stored original USD and ${base} equivalent.`,
            });

          const settlementId = await createSettlement({
            db: tx,
            groupId: group.id,
            baseCurrency: base,
            fromMemberId: fromM.id,
            toMemberId: toM.id,
            date: dateInvalid ? new Date() : date,
            currency,
            amountMinor,
            note: row.notes || row.description,
            importBatchId: batch.id,
            sourceRow: row.rowNumber,
          });
          settlementsCreated++;

          await record(
            row,
            "SETTLEMENT_AS_EXPENSE",
            `"${row.description}" was logged as an expense but is a payment from ${fromM.name} to ${toM.name}.`,
            `Recorded as a settlement, not a shared expense.`,
            { settlementId },
          );
          for (const p of pending)
            await record(row, p.type, p.message, p.action, { settlementId });
          continue;
        }

        // ----- expense path -----
        // Determine status from quarantine conditions.
        let status: "ACTIVE" | "SUPERSEDED" | "VOID" = "ACTIVE";

        if (dup === "exact")
          pending.push({
            type: "DUPLICATE_EXACT",
            message: `Identical to an earlier row (same date, payer, amount).`,
            action: `Kept the first occurrence; this copy is marked superseded and excluded from balances.`,
          });
        if (dup === "conflict")
          pending.push({
            type: "DUPLICATE_CONFLICTING",
            message: `Looks like the same expense as an earlier row but with a different payer/amount.`,
            action: `Kept the first row as active; this one is superseded pending review.`,
          });
        if (dup === "exact" || dup === "conflict") status = "SUPERSEDED";

        if (dateInvalid || dateOutOfRange) {
          pending.push({
            type: "DATE_OUT_OF_RANGE",
            message: `Date "${row.date}" is missing or outside the ledger's range.`,
            action: `Imported but quarantined (excluded from balances) until the date is corrected.`,
          });
          status = "VOID";
        } else if (notesSuggestDateAmbiguity(row.notes)) {
          pending.push({
            type: "DATE_AMBIGUOUS",
            message: `Date may be ambiguous (note: "${row.notes}").`,
            action: `Kept the date as stored (${row.date}); flagged for confirmation.`,
          });
        }

        if (amountMinor === null) {
          pending.push({
            type: "DATE_OUT_OF_RANGE",
            message: `Amount "${row.amount}" is not a number.`,
            action: `Quarantined (excluded from balances).`,
          });
          status = "VOID";
        } else {
          if (amountMinor === 0) {
            pending.push({
              type: "ZERO_AMOUNT",
              message: `Amount is zero (note: "${row.notes}").`,
              action: `Imported as void (no effect on balances).`,
            });
            status = "VOID";
          }
          if (isSubunit)
            pending.push({
              type: "SUBUNIT_ROUNDING",
              message: `Amount ${row.amount} has sub-paisa precision.`,
              action: `Rounded to the nearest paisa (half away from zero).`,
            });
          if (amountMinor < 0)
            pending.push({
              type: "NEGATIVE_AMOUNT",
              message: `Negative amount (note: "${row.notes}").`,
              action: `Treated as a refund: reduces what participants owe.`,
            });
        }

        if (currencyMissing)
          pending.push({
            type: "MISSING_CURRENCY",
            message: `No currency given; assumed ${base}.`,
            action: `Converted/stored as ${base}.`,
          });
        else if (currency === "USD")
          pending.push({
            type: "FOREIGN_CURRENCY",
            message: `Amount in USD converted at ${getFxRate("USD", base)} ${base}/USD.`,
            action: `Stored original USD and ${base} equivalent so a dollar isn't treated as a rupee.`,
          });

        if (!isSupportedCurrency(currency)) {
          pending.push({
            type: "DATE_OUT_OF_RANGE",
            message: `Unsupported currency "${currency}".`,
            action: `Quarantined (excluded from balances).`,
          });
          status = "VOID";
        }

        // --- payer ---
        let paidByMemberId: string | null = null;
        if (row.paidBy.trim() === "") {
          pending.push({
            type: "MISSING_PAYER",
            message: `No payer recorded (note: "${row.notes}").`,
            action: `Imported but quarantined until a payer is assigned.`,
          });
          status = "VOID";
        } else {
          const payer = await ensurePayer(row.paidBy);
          paidByMemberId = payer.id;
          if (normalizeName(row.paidBy) !== row.paidBy.trim())
            pending.push({
              type: "NAME_NORMALIZED",
              message: `Payer "${row.paidBy}" normalized to "${payer.name}".`,
              action: `Matched to the existing member.`,
            });
        }

        // --- split type + details mismatch ---
        const stRaw = row.splitType.trim().toLowerCase();
        let splitType: SplitType =
          stRaw === "unequal"
            ? "UNEQUAL"
            : stRaw === "percentage"
              ? "PERCENTAGE"
              : stRaw === "share"
                ? "SHARE"
                : "EQUAL";
        const details = parseDetails(row.splitDetails);
        if (splitType === "EQUAL" && row.splitDetails.trim() !== "") {
          pending.push({
            type: "SPLIT_TYPE_DETAILS_MISMATCH",
            message: `Split type is "equal" but per-person values were provided.`,
            action: `Honored the split type (equal); ignored the extra values.`,
          });
        }

        // --- participants + weights ---
        const participantNames = splitNames(row.splitWith);
        const splitMembers: SplitMemberInput[] = [];
        const usedDate = dateInvalid ? new Date() : date;

        for (const rawName of participantNames) {
          const norm = normalizeName(rawName);
          let member = byName.get(norm);
          if (!member) {
            // Policy: an unknown participant joins as a GUEST and is INCLUDED in
            // the split, so the expense is divided across everyone who was
            // actually present. (Previously they were excluded and their share
            // redistributed to members, which inflated members' balances.) Still
            // flagged so the addition is visible in the import report.
            member = await tx.member.create({
              data: {
                groupId: group.id,
                name: norm || rawName.trim(),
                isGuest: true,
              },
            });
            byName.set(norm, member);
            pending.push({
              type: "NON_MEMBER_PARTICIPANT",
              message: `"${rawName}" is not a listed flatmate.`,
              action: `Added as a guest and included in this split.`,
            });
          }
          if (!isActiveOn(member, usedDate)) {
            pending.push({
              type: "MEMBER_INACTIVE_AT_DATE",
              message: `${member.name} was not an active member on ${row.date}.`,
              action: `Removed from this split; the cost is shared among active members.`,
            });
            continue;
          }

          // Weight per split type.
          let weight = 1;
          if (splitType === "SHARE") {
            weight = Number(details.get(norm) ?? "0");
          } else if (splitType === "PERCENTAGE") {
            weight = Number(details.get(norm) ?? "0");
          } else if (splitType === "UNEQUAL") {
            const partMinor = toMinor(details.get(norm) ?? "0") ?? 0;
            weight = partMinor;
          }
          if (weight <= 0 && splitType !== "EQUAL") {
            // Missing/zero detail for a participant: fall back to an equal weight
            // so nobody silently drops out, and flag the mismatch.
            pending.push({
              type: "SPLIT_TYPE_DETAILS_MISMATCH",
              message: `No ${splitType.toLowerCase()} value for ${member.name}.`,
              action: `Used an equal share for them.`,
            });
            weight = 1;
          }
          splitMembers.push({ memberId: member.id, weight });
        }

        // Percentage sanity (uses ORIGINAL participant values, before exclusions
        // change the mix).
        if (splitType === "PERCENTAGE") {
          let sum = 0;
          for (const n of participantNames)
            sum += Number(details.get(normalizeName(n)) ?? "0");
          if (Math.round(sum) !== 100)
            pending.push({
              type: "PERCENTAGE_SUM_INVALID",
              message: `Percentages add up to ${sum}, not 100.`,
              action: `Treated the percentages as relative weights so the full amount is still split.`,
            });
        }

        // Payer not among participants (informational).
        if (
          paidByMemberId &&
          !splitMembers.some((s) => s.memberId === paidByMemberId)
        ) {
          pending.push({
            type: "PAYER_NOT_IN_SPLIT",
            message: `The payer is not one of the participants.`,
            action: `Left as-is; the payer is owed the full amount.`,
          });
        }

        if (splitMembers.length === 0) {
          pending.push({
            type: "NON_MEMBER_PARTICIPANT",
            message: `No valid participants remain for this expense.`,
            action: `Imported as void (excluded from balances).`,
          });
          status = "VOID";
          // Give it a single zero-weight placeholder is not possible; create with
          // the payer as sole participant so the row still exists for audit.
          if (paidByMemberId)
            splitMembers.push({ memberId: paidByMemberId, weight: 1 });
        }

        const expenseId = await createExpense({
          db: tx,
          groupId: group.id,
          baseCurrency: base,
          description: row.description || "(no description)",
          date: usedDate,
          currency,
          amountMinor: amountMinor ?? 0,
          splitType,
          paidByMemberId,
          members: splitMembers,
          notes: row.notes || null,
          status,
          importBatchId: batch.id,
          sourceRow: row.rowNumber,
        });

        if (status === "ACTIVE") activeExpenses++;
        else quarantined++;

        for (const p of pending)
          await record(row, p.type, p.message, p.action, { expenseId });
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          importedExpenses: activeExpenses,
          importedSettlements: settlementsCreated,
          skippedRows: quarantined,
        },
      });

      return { batchId: batch.id, groupId: group.id };
    },
    { timeout: 60000, maxWait: 15000 },
  );
}
