"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { SplitType } from "@prisma/client";
import { createExpenseAction, type ActionState } from "./actions";

export type FormMember = { id: string; name: string };

// Human hint for the per-participant value input, by split type.
const VALUE_HINT: Record<Exclude<SplitType, "EQUAL">, string> = {
  SHARE: "shares (e.g. 2)",
  PERCENTAGE: "percent (must total 100)",
  UNEQUAL: "amount",
};

export function NewExpenseForm({
  groupId,
  members,
}: {
  groupId: string;
  members: FormMember[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createExpenseAction,
    null,
  );
  const [splitType, setSplitType] = useState<SplitType>("EQUAL");
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful submission so the list can refresh clean.
  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
      setSplitType("EQUAL");
    }
  }, [state]);

  const needsValue = splitType !== "EQUAL";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-4">
      <h3 className="font-semibold">Add an expense</h3>
      <input type="hidden" name="groupId" value={groupId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs sm:col-span-2">
          <span className="text-muted">Description</span>
          <input
            name="description"
            required
            placeholder="e.g. Groceries BigBasket"
            className="field"
          />
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

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Paid by</span>
          <select name="paidByMemberId" required className="field">
            <option value="">Select…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

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

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Currency</span>
            <select name="currency" defaultValue="INR" className="field">
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-muted">Split</span>
            <select
              name="splitType"
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as SplitType)}
              className="field"
            >
              <option value="EQUAL">Equal</option>
              <option value="UNEQUAL">Unequal (amounts)</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="SHARE">Shares (ratio)</option>
            </select>
          </label>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs text-muted">
          Participants{needsValue ? ` — enter ${VALUE_HINT[splitType]}` : ""}
        </legend>
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`include_${m.id}`}
                defaultChecked
                className="h-4 w-4 accent-accent"
              />
              {m.name}
            </label>
            {needsValue && (
              <input
                name={`value_${m.id}`}
                inputMode="decimal"
                placeholder={VALUE_HINT[splitType]}
                className="field w-40"
              />
            )}
          </div>
        ))}
      </fieldset>

      {state && "error" in state && (
        <p className="text-sm text-neg">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-pos">Expense added.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary self-start disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
