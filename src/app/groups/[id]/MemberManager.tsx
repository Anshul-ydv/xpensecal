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
  isGuest: boolean; // shares expenses but is not a permanent flatmate
};

function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addMemberAction,
    null,
  );
  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs sm:col-span-2">
          <span className="text-muted">Name</span>
          <input name="name" required placeholder="e.g. Aisha" className="field" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Joined</span>
          <input name="joinedAt" type="date" className="field" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Left</span>
          <input name="leftAt" type="date" className="field" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isGuest"
          className="h-4 w-4 accent-accent"
        />
        <span>
          Guest{" "}
          <span className="text-muted">
            — shares expenses like everyone, but isn&apos;t a permanent flatmate
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add member"}
        </button>
        {state?.error && (
          <p className="text-sm text-neg">{state.error}</p>
        )}
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
    <li className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          {member.name}
          {member.isGuest && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-300">
              guest
            </span>
          )}
        </span>
        {member.locked ? (
          <span className="badge">in use · can’t delete</span>
        ) : (
          <form action={deleteForm}>
            <input type="hidden" name="memberId" value={member.id} />
            <button
              type="submit"
              className="text-xs text-neg hover:underline"
            >
              Delete
            </button>
          </form>
        )}
      </div>
      {/* Membership window: setting these dates is how members join/leave over time. */}
      <form action={updateForm} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="memberId" value={member.id} />
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Joined</span>
          <input
            name="joinedAt"
            type="date"
            defaultValue={member.joinedAt ?? ""}
            className="field"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="text-muted">Left</span>
          <input
            name="leftAt"
            type="date"
            defaultValue={member.leftAt ?? ""}
            className="field"
          />
        </label>
        <button
          type="submit"
          disabled={updating}
          className="btn btn-ghost disabled:opacity-60"
        >
          {updating ? "Saving…" : "Save dates"}
        </button>
      </form>
      {(updateState?.error || deleteState?.error) && (
        <p className="text-sm text-neg">
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
        <p className="text-sm text-muted">No members yet.</p>
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
