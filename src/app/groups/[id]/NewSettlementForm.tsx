"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSettlementAction, type ActionState } from "./actions";
import type { FormMember } from "./NewExpenseForm";

export function NewSettlementForm({
  groupId,
  members,
}: {
  groupId: string;
  members: FormMember[];
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
  );
}
