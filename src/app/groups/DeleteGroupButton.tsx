"use client";

import { useActionState } from "react";
import { deleteGroupAction, type ActionState } from "./actions";

// Deleting a group removes all of its expenses, members, and settlements, so we
// confirm first (destructive, non-reversible).
export function DeleteGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteGroupAction,
    null,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${groupName}"? This permanently removes all its expenses, members, and settlements.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <button
        type="submit"
        disabled={pending}
        title="Delete group"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-neg disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error && (
        <span className="ml-2 text-xs text-neg">{state.error}</span>
      )}
    </form>
  );
}
