import { PrismaClient } from "@prisma/client";

// In development Next.js hot-reloads modules, which would otherwise create a new
// PrismaClient (and a new DB connection pool) on every reload and exhaust the
// database's connection limit. We cache a single instance on globalThis so the
// same client is reused across reloads. In production a fresh instance is fine.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
