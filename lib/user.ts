import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import type { Plan } from "@prisma/client";

export type UserRecord = {
  id: string;
  clerkUserId: string;
  email: string | null;
  credits: number;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get or create a user by Clerk ID. On first sign-in, creates a record with credits = 10
 * and fetches the primary email from Clerk for the new user.
 */
export async function getOrCreateUser(clerkUserId: string): Promise<UserRecord> {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId },
  });
  if (existing) {
    if (existing.email === null) {
      const clerkUser = await currentUser();
      if (clerkUser?.id === clerkUserId) {
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
        if (email != null) {
          const updated = await prisma.user.update({
            where: { clerkUserId },
            data: { email },
          });
          return updated;
        }
      }
    }
    return existing;
  }
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
  const created = await prisma.user.create({
    data: {
      clerkUserId,
      email,
      credits: 10,
      plan: "free",
    },
  });
  return created;
}

/**
 * Decrement credits for a user by 1. Returns new credits count or null if insufficient.
 */
export async function decrementUserCredits(clerkUserId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
  });
  if (!user || user.credits < 1) return null;
  const updated = await prisma.user.update({
    where: { clerkUserId },
    data: { credits: { decrement: 1 } },
  });
  return updated.credits;
}
