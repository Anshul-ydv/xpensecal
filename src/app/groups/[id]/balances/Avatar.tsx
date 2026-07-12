// Small presentational avatar shared by the balances page (server) and the
// per-person table (client). Pure — no interactivity, no server-only APIs.

// A stable, muted tint per person so members are easy to tell apart without
// turning the page into confetti.
const AVATAR_TINTS = [
  "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
];

export function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tintFor(
        name,
      )}`}
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
