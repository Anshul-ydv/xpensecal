import type {
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
} from "@prisma/client";

// Per-anomaly policy metadata.
//
// `severity` drives how loudly the report shows it.
// `requiresApproval` implements Meera's request ("I want to approve anything the
// app deletes or changes"): anything that deletes, supersedes, drops a
// participant, quarantines a row, or reinterprets its meaning starts as
// PENDING_APPROVAL. Purely cosmetic/deterministic fixes are AUTO_APPLIED.
export const ANOMALY_META: Record<
  AnomalyType,
  { severity: AnomalySeverity; requiresApproval: boolean; label: string }
> = {
  DUPLICATE_EXACT: {
    severity: "WARNING",
    requiresApproval: true,
    label: "Exact duplicate",
  },
  DUPLICATE_CONFLICTING: {
    severity: "ERROR",
    requiresApproval: true,
    label: "Conflicting duplicate",
  },
  SETTLEMENT_AS_EXPENSE: {
    severity: "WARNING",
    requiresApproval: true,
    label: "Settlement logged as an expense",
  },
  MISSING_PAYER: {
    severity: "ERROR",
    requiresApproval: true,
    label: "Missing payer",
  },
  MISSING_CURRENCY: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Missing currency",
  },
  FOREIGN_CURRENCY: {
    severity: "INFO",
    requiresApproval: false,
    label: "Foreign currency converted",
  },
  NEGATIVE_AMOUNT: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Negative amount (refund)",
  },
  ZERO_AMOUNT: {
    severity: "WARNING",
    requiresApproval: true,
    label: "Zero amount",
  },
  SUBUNIT_ROUNDING: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Sub-unit amount rounded",
  },
  DATE_OUT_OF_RANGE: {
    severity: "ERROR",
    requiresApproval: true,
    label: "Date out of range",
  },
  DATE_AMBIGUOUS: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Ambiguous date",
  },
  NON_MEMBER_PARTICIPANT: {
    severity: "WARNING",
    requiresApproval: true,
    label: "Non-member in split",
  },
  MEMBER_INACTIVE_AT_DATE: {
    severity: "WARNING",
    requiresApproval: true,
    label: "Member not active on this date",
  },
  PERCENTAGE_SUM_INVALID: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Percentages do not total 100",
  },
  SPLIT_TYPE_DETAILS_MISMATCH: {
    severity: "WARNING",
    requiresApproval: false,
    label: "Split type / details mismatch",
  },
  PAYER_NOT_IN_SPLIT: {
    severity: "INFO",
    requiresApproval: false,
    label: "Payer not among participants",
  },
  NAME_NORMALIZED: {
    severity: "INFO",
    requiresApproval: false,
    label: "Name normalized",
  },
};

export function statusFor(type: AnomalyType): AnomalyStatus {
  return ANOMALY_META[type].requiresApproval ? "PENDING_APPROVAL" : "AUTO_APPLIED";
}
