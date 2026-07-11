"use client";

import { useActionState } from "react";
import { createGroupAction, type ActionState } from "./actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createGroupAction,
    null,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-5 dark:border-white/15"
    >
      <h2 className="font-medium">Create a group</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="name"
          placeholder="Group name (e.g. Flat 402)"
          required
          className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
        />
        <input
          name="baseCurrency"
          defaultValue="INR"
          maxLength={3}
          title="Base currency (3-letter code)"
          className="w-24 rounded-md border border-black/15 px-3 py-2 text-sm uppercase outline-none focus:border-black/40 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
