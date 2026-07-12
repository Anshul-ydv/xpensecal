"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSettlementAction, type ActionState } from "./actions";
import type { FormMember } from "./NewExpenseForm";

export type RecentSettlement = {
  id: string;
  fromName: string;
  toName: string;
  date: string;
  amount: string;
  note: string | null;
};

export function NewSettlementForm({
  groupId,
  members,
  recent = [],
}: {
  groupId: string;
  members: FormMember[];
  recent?: RecentSettlement[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSettlementAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) formRef.current?.reset();
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
    <form ref={formRef} action={formAction} className="card flex flex-col gap-3.5">
      <h3 className="font-semibold">Record a settlement</h3>
      <p className="text-xs text-muted">
        A direct payment from one member to another (not a shared expense).
      </p>
      <input type="hidden" name="groupId" value={groupId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">From (payer)</span>
          <select name="fromMemberId" required className="field">
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">To (receiver)</span>
          <select name="toMemberId" required className="field">
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Date</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="field"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Amount</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              required
              placeholder="0.00"
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Currency</span>
            <select name="currency" defaultValue="INR" className="field">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-xs sm:col-span-2">
          <span className="text-muted">Note (optional)</span>
          <input name="note" className="field" />
        </label>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-neg">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-pos">Settlement recorded.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record settlement"}
      </button>
    </form>

    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Previous settlements</h3>
        {recent.length > 0 && <span className="badge">{recent.length}</span>}
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">No settlements yet.</p>
      ) : (
        <ul className="-mr-1 flex max-h-52 flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {recent.map((s) => (
            <li key={s.id} className="rounded-lg bg-elevated px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">{s.fromName}</span>{" "}
                  <span className="text-muted">paid</span>{" "}
                  <span className="font-medium">{s.toName}</span>
                </p>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {s.amount}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">
                {s.date}
                {s.note ? ` · ${s.note}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
    </div>
  );
}
