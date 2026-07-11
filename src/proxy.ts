import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Next.js 16 renamed `middleware` to `proxy` (runs on the Node.js runtime).
// This is a fast, defense-in-depth gate: it verifies the session token's
// signature/expiry (no DB call) before protected pages render. The pages
// themselves still load the real user via getCurrentUser().

// Path prefixes that require a logged-in user.
const PROTECTED_PREFIXES = ["/dashboard", "/groups", "/import"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals; only run on real page requests.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
