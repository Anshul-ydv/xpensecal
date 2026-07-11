import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Name of the httpOnly cookie holding the signed session token.
export const SESSION_COOKIE = "xpensecal_session";
// Session lifetime: 7 days.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// The signing secret. We fail loudly at call time if it is missing rather than
// silently signing with an empty key.
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set a long random string in the environment.",
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
};

// ---- password hashing -----------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  // Cost factor 10 is a sensible default: strong enough while keeping login fast.
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---- token signing / verification -----------------------------------------

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId === "string") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    // Invalid signature, expired, or malformed token.
    return null;
  }
}

// ---- session cookie management ---------------------------------------------
// Cookies can only be written in a Server Action or Route Handler.

export async function createSession(userId: string): Promise<void> {
  const token = await signSession({ userId });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// ---- current user ----------------------------------------------------------

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
};

// Reads and verifies the session cookie, then loads the user. Returns null if
// there is no valid session or the user no longer exists.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
  return user;
}

// Convenience for protected pages/actions: returns the user or redirects to login.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
