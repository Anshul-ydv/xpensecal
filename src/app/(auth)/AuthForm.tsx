"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "./actions";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
};

// Shared form for both login and register. Uses React's useActionState so the
// server action can return a validation/credential error that we render inline.
export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    null,
  );

  const isRegister = mode === "register";

  return (
    <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-neutral-900">
      <h1 className="mb-1 text-2xl font-semibold">
        {isRegister ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        {isRegister
          ? "Sign up to start tracking shared expenses."
          : "Log in to your XpenseCal account."}
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        {isRegister && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <input
              name="name"
              type="text"
              required
              autoComplete="name"
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
          />
        </label>

        {state?.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {pending
            ? "Please wait…"
            : isRegister
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="font-medium underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
