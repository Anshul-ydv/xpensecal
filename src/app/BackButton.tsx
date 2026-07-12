"use client";

import { useRouter } from "next/navigation";

// Back navigation. Uses real browser history when there is any; otherwise (e.g.
// the page was opened directly or is the first entry) it navigates to a sensible
// parent so the button never dead-ends.
export function BackButton({
  fallback = "/dashboard",
  className = "",
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();

  function onBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className={`inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </button>
  );
}
