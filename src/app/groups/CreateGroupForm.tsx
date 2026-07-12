"use client";

import { useActionState } from "react";
import { createGroupAction, type ActionState } from "./actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createGroupAction,
    null,
  );

  return (
    <form action={formAction} className="card flex flex-col gap-3.5">
      <h2 className="font-semibold">Create a group</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="name"
          placeholder="Group name (e.g. Flat 402)"
          required
          className="field flex-1"
        />
        <input
          name="baseCurrency"
          defaultValue="INR"
          maxLength={3}
          title="Base currency (3-letter code)"
          className="field w-24 uppercase"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create"}
        </button>
      </div>
      {state?.error && (
        <p className="text-sm text-neg">{state.error}</p>
      )}
    </form>
  );
}
