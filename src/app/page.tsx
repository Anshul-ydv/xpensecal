import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// The root simply routes to the dashboard when logged in, or to login otherwise.
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
