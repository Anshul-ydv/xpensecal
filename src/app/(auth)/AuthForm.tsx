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
    <div className="card w-full max-w-sm p-8">
      <p className="mb-6 text-sm font-semibold tracking-tight text-muted">
        XpenseCal
      </p>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">
        {isRegister ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-sm text-muted">
        {isRegister
          ? "Sign up to start tracking shared expenses."
          : "Log in to your XpenseCal account."}
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        {isRegister && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Name</span>
            <input name="name" type="text" required autoComplete="name" className="field" />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="field" />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            className="field"
          />
        </label>

        {state?.error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-neg">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary mt-2 disabled:opacity-60"
        >
          {pending
            ? "Please wait…"
            : isRegister
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
