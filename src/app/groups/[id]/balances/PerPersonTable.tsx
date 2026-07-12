"use client";

import { Fragment, useState } from "react";
import type { MemberBalance } from "@/lib/balances";
import { formatMoney, formatMinor } from "@/lib/money";
import { Avatar } from "./Avatar";

// Per-person balances as a rectangular table. Clicking a row expands a detail
// panel showing exactly how that member's net number is made up (Rohan's "no
// magic numbers" request).
export function PerPersonTable({
  members,
  base,
}: {
  members: MemberBalance[];
  base: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[34rem] border-collapse">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-5 py-3.5 font-medium">Member</th>
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 text-right font-medium">Net</th>
            <th className="w-12 px-3 py-3.5" aria-label="Expand" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const owed = m.netMinor > 0;
            const settled = m.netMinor === 0;
            const isOpen = !!open[m.memberId];
            const amountClass = settled
              ? "text-muted"
              : owed
                ? "text-pos"
                : "text-neg";
            return (
              <Fragment key={m.memberId}>
                <tr
                  onClick={() => toggle(m.memberId)}
                  className={`cursor-pointer border-t border-border transition-colors hover:bg-elevated ${
                    isOpen ? "bg-elevated" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} />
                      <span className="font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-sm ${amountClass}`}>
                      {settled ? "settled up" : owed ? "is owed" : "owes"}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-4 text-right text-base font-semibold tabular-nums ${amountClass}`}
                  >
                    {settled ? "—" : formatMoney(Math.abs(m.netMinor), base)}
                  </td>
                  <td className="px-3 py-4 text-muted">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className={`h-4 w-4 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                      aria-hidden
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-border bg-bg">
                    <td colSpan={4} className="px-5 py-5">
                      <div className="flex flex-col gap-3">
                        <BreakdownBlock
                          title={`Paid for the group (+${formatMinor(m.paidMinor)})`}
                          empty="Paid for nothing"
                          lines={m.contributions.paidExpenses.map((p) => ({
                            left: `${p.date} · ${p.description}`,
                            right: `+${formatMinor(p.amountMinor)}`,
                          }))}
                        />
                        <BreakdownBlock
                          title={`Their share of expenses (−${formatMinor(m.owedMinor)})`}
                          empty="No shares"
                          lines={m.contributions.owedSplits.map((s) => ({
                            left: `${s.date} · ${s.description}${
                              s.rawShare ? ` (${s.rawShare})` : ""
                            }`,
                            right: `−${formatMinor(s.owedMinor)}`,
                          }))}
                        />
                        {m.contributions.settlementsPaid.length > 0 && (
                          <BreakdownBlock
                            title={`Settlements they paid (+${formatMinor(m.settlePaidMinor)})`}
                            empty=""
                            lines={m.contributions.settlementsPaid.map((s) => ({
                              left: `${s.date} · paid ${s.otherName}`,
                              right: `+${formatMinor(s.amountMinor)}`,
                            }))}
                          />
                        )}
                        {m.contributions.settlementsReceived.length > 0 && (
                          <BreakdownBlock
                            title={`Settlements they received (−${formatMinor(m.settleReceivedMinor)})`}
                            empty=""
                            lines={m.contributions.settlementsReceived.map(
                              (s) => ({
                                left: `${s.date} · from ${s.otherName}`,
                                right: `−${formatMinor(s.amountMinor)}`,
                              }),
                            )}
                          />
                        )}
                        <p className="border-t border-border pt-2 text-right font-semibold">
                          Net: {formatMoney(m.netMinor, base)}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BreakdownBlock({
  title,
  empty,
  lines,
}: {
  title: string;
  empty: string;
  lines: { left: string; right: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted">{title}</p>
      {lines.length === 0 ? (
        empty ? (
          <p className="text-xs text-muted opacity-70">{empty}</p>
        ) : null
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {lines.map((l, i) => (
            <li
              key={i}
              className="flex justify-between gap-4 border-b border-dashed border-border pb-1"
            >
              <span>{l.left}</span>
              <span className="tabular-nums">{l.right}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
