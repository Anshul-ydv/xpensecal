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
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-black/10 p-5 dark:border-white/15"
    >
      <h3 className="font-medium">Add an expense</h3>
      <input type="hidden" name="groupId" value={groupId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="text-neutral-500">Description</span>
          <input
            name="description"
            required
            placeholder="e.g. Groceries BigBasket"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
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

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Paid by</span>
          <select
            name="paidByMemberId"
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
          <span className="text-neutral-500">Amount</span>
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="0.00"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
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
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-500">Split</span>
            <select
              name="splitType"
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as SplitType)}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
            >
              <option value="EQUAL">Equal</option>
              <option value="UNEQUAL">Unequal (amounts)</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="SHARE">Shares (ratio)</option>
            </select>
          </label>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs text-neutral-500">
          Participants{needsValue ? ` — enter ${VALUE_HINT[splitType]}` : ""}
        </legend>
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`include_${m.id}`}
                defaultChecked
                className="h-4 w-4"
              />
              {m.name}
            </label>
            {needsValue && (
              <input
                name={`value_${m.id}`}
                inputMode="decimal"
                placeholder={VALUE_HINT[splitType]}
                className="w-40 rounded-md border border-black/15 px-2 py-1 text-sm dark:border-white/20"
              />
            )}
          </div>
        ))}
      </fieldset>

      {state && "error" in state && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Expense added.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding…" : "Add expense"}
      </button>
    </form>
  );
}
