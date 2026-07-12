import Link from "next/link";
import { logoutAction } from "./(auth)/actions";

// Shared top navigation for authenticated pages. Server component: the logout
// button posts the logout server action.
export function AppHeader({ userName }: { userName: string }) {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 p-4">
        <Link href="/dashboard" className="text-lg font-semibold">
          XpenseCal
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/groups" className="hover:underline">
            Groups
          </Link>
          <Link href="/import" className="hover:underline">
            Import
          </Link>
          <span className="hidden text-neutral-400 sm:inline">·</span>
          <span className="hidden text-neutral-500 sm:inline">{userName}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Log out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
