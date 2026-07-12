import Link from "next/link";
import { logoutAction } from "./(auth)/actions";

// Shared top navigation for authenticated pages. Server component: the logout
// button posts the logout server action.
export function AppHeader({ userName }: { userName: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3.5">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight"
        >
          XpenseCal
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/groups"
            className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Groups
          </Link>
          <Link
            href="/import"
            className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-elevated hover:text-fg"
          >
            Import
          </Link>
          <span className="mx-2 hidden text-muted sm:inline">{userName}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost">
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
