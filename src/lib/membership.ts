// Helpers for reasoning about time-bounded group membership.
//
// A member is "active" on a date when that date falls within their
// [joinedAt, leftAt] window. Nulls mean open-ended:
//   - joinedAt == null  -> member since the beginning of time
//   - leftAt   == null  -> still a member
//
// This is what lets balances ignore expenses dated before a member joined or
// after they left (Sam's "why would March electricity affect my balance?" and
// the "Meera still in the April group list" anomaly).

export type MembershipWindow = {
  joinedAt: Date | null;
  leftAt: Date | null;
};

export function isActiveOn(member: MembershipWindow, date: Date): boolean {
  if (member.joinedAt && date < startOfDay(member.joinedAt)) return false;
  if (member.leftAt && date > endOfDay(member.leftAt)) return false;
  return true;
}

// Membership windows are compared at day granularity: someone who joined on a
// given day is active for the whole of that day, and someone who left on a day
// is active through the end of it.
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
