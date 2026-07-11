import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Auth pages are only for logged-out users. If a valid session exists, send the
// user straight to their dashboard.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      {children}
    </div>
  );
}
