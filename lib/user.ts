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

const DEFAULT_CREDITS = 10;
const DEFAULT_PLAN: Plan = "free";

export type GetOrCreateUserResult = {
  user: UserRecord;
  wasCreated: boolean;
};

/**
 * Get or create a user by Clerk ID. On first authenticated access, creates a
 * record with credits = 10 and plan = "free". Email is stored when provided.
 * Call from API routes after auth() — pass the Clerk user's email if available.
 */
export async function getOrCreateUser(
  clerkUserId: string,
  emailFromClerk?: string | null
): Promise<UserRecord> {
  const result = await getOrCreateUserWithFlag(clerkUserId, emailFromClerk);
  return result.user;
}

/**
 * Same as getOrCreateUser but returns { user, wasCreated } for logging.
 */
export async function getOrCreateUserWithFlag(
  clerkUserId: string,
  emailFromClerk?: string | null
): Promise<GetOrCreateUserResult> {
  const existing = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (existing) {
    const email = emailFromClerk ?? existing.email;
    if (email != null && existing.email !== email) {
      const updated = await prisma.user.update({
        where: { clerkUserId },
        data: { email },
      });
      console.log("[getOrCreateUser] found, updated email", {
        clerkUserId,
        email: updated.email,
        userId: updated.id,
        plan: updated.plan,
        credits: updated.credits,
      });
      return { user: updated, wasCreated: false };
    }
    console.log("[getOrCreateUser] found", {
      clerkUserId,
      email: existing.email,
      userId: existing.id,
      plan: existing.plan,
      credits: existing.credits,
    });
    return { user: existing, wasCreated: false };
  }

  const created = await prisma.user.create({
    data: {
      clerkUserId,
      email: emailFromClerk ?? null,
      credits: DEFAULT_CREDITS,
      plan: DEFAULT_PLAN,
    },
  });
  console.log("[getOrCreateUser] created", {
    clerkUserId,
    email: created.email,
    userId: created.id,
    plan: created.plan,
    credits: created.credits,
  });
  return { user: created, wasCreated: true };
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
