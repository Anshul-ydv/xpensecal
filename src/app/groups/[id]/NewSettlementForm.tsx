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
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-5 dark:border-white/15"
    >
      <h3 className="font-medium">Record a settlement</h3>
      <p className="text-xs text-neutral-500">
        A direct payment from one member to another (not a shared expense).
      </p>
      <input type="hidden" name="groupId" value={groupId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">From (payer)</span>
          <select
            name="fromMemberId"
            required
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">To (receiver)</span>
          <select
            name="toMemberId"
            required
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Date</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-500">Amount</span>
            <input
              name="amount"
              inputMode="decimal"
              required
              placeholder="0.00"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-500">Currency</span>
            <select
              name="currency"
              defaultValue="INR"
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="text-neutral-500">Note (optional)</span>
          <input
            name="note"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Settlement recorded.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Saving…" : "Record settlement"}
      </button>
    </form>
  );
}
