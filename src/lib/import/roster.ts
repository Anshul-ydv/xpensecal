// The known roster for the provided expenses_export.csv.
//
// Join/leave dates are NOT columns in the CSV — they come from the assignment
// narrative ("Meera moved out at the end of March, and Sam moved in mid-April";
// "Dev joined them for a trip"). Encoding the roster the flatmates told us about
// is what lets the importer detect membership-timeline problems:
//   - Meera appearing in an April split after she left  -> MEMBER_INACTIVE_AT_DATE
//   - Sam being charged for anything before he moved in  -> MEMBER_INACTIVE_AT_DATE
// Anyone in the CSV who is NOT on this roster (e.g. "Dev's friend Kabir") is
// treated as a non-member guest and excluded from splits.
//
// Dates are ISO strings; null means open-ended.
export type RosterEntry = {
  name: string;
  joinedAt: string | null;
  leftAt: string | null;
};

export const SAMPLE_ROSTER: RosterEntry[] = [
  // The original flatmates have shared expenses "since February"; the first
  // recorded expense (February rent) is 2026-02-01, so that is their join date.
  { name: "Aisha", joinedAt: "2026-02-01", leftAt: null },
  { name: "Rohan", joinedAt: "2026-02-01", leftAt: null },
  { name: "Priya", joinedAt: "2026-02-01", leftAt: null },
  // Dev is a trip guest, not a permanent flatmate. His first shared expense is
  // the 2026-02-08 weekend dinner ("Dev visiting for the weekend"), so that is
  // his join date; leftAt stays open (he simply stops appearing after the trip).
  { name: "Dev", joinedAt: "2026-02-08", leftAt: null },
  // Meera was a flatmate since February and moved out at the end of March.
  { name: "Meera", joinedAt: "2026-02-01", leftAt: "2026-03-31" },
  // Sam moved in mid-April; his first activity (deposit) is 2026-04-08.
  { name: "Sam", joinedAt: "2026-04-08", leftAt: null },
];
