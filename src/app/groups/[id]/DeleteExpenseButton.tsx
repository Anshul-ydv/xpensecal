"use client";

import { useActionState } from "react";
import { deleteExpenseAction, type ActionState } from "./actions";

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const [, formAction, pending] = useActionState<ActionState, FormData>(
    deleteExpenseAction,
    null,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="expenseId" value={expenseId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </form>
  );
}
