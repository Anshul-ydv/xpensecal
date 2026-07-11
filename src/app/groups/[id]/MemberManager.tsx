"use client";

import { useActionState } from "react";
import {
  addMemberAction,
  updateMemberAction,
  deleteMemberAction,
  type ActionState,
} from "../actions";

export type MemberDTO = {
  id: string;
  name: string;
  joinedAt: string | null; // YYYY-MM-DD
  leftAt: string | null; // YYYY-MM-DD
  locked: boolean; // has financial records -> cannot be deleted
};

function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addMemberAction,
    null,
  );
  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs sm:col-span-2">
          <span className="text-neutral-500">Name</span>
          <input
            name="name"
            required
            placeholder="e.g. Aisha"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Joined</span>
          <input
            name="joinedAt"
            type="date"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Left</span>
          <input
            name="leftAt"
            type="date"
            className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
        >
          {pending ? "Adding…" : "Add member"}
        </button>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  );
}

function MemberRow({ member }: { member: MemberDTO }) {
  const [updateState, updateForm, updating] = useActionState<
    ActionState,
    FormData
  >(updateMemberAction, null);
  const [deleteState, deleteForm] = useActionState<ActionState, FormData>(
    deleteMemberAction,
    null,
  );

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/15">
      <div className="flex items-center justify-between">
        <span className="font-medium">{member.name}</span>
        {member.locked ? (
          <span className="text-xs text-neutral-400">in use · can’t delete</span>
        ) : (
          <form action={deleteForm}>
            <input type="hidden" name="memberId" value={member.id} />
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </form>
        )}
      </div>
      {/* Membership window: setting these dates is how members join/leave over time. */}
      <form action={updateForm} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="memberId" value={member.id} />
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Joined</span>
          <input
            name="joinedAt"
            type="date"
            defaultValue={member.joinedAt ?? ""}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-500">Left</span>
          <input
            name="leftAt"
            type="date"
            defaultValue={member.leftAt ?? ""}
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          disabled={updating}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:hover:bg-white/10"
        >
          {updating ? "Saving…" : "Save dates"}
        </button>
      </form>
      {(updateState?.error || deleteState?.error) && (
        <p className="text-sm text-red-600">
          {updateState?.error ?? deleteState?.error}
        </p>
      )}
    </li>
  );
}

export function MemberManager({
  groupId,
  members,
}: {
  groupId: string;
  members: MemberDTO[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <AddMemberForm groupId={groupId} />
      {members.length === 0 ? (
        <p className="text-sm text-neutral-500">No members yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </ul>
      )}
    </div>
  );
}
