import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user";

/**
 * GET /api/user
 * Returns the current authenticated user record (get-or-create on first sign-in).
 * Unauthenticated requests return 401.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getOrCreateUser(userId);
    // Debug: verify which row is returned and what plan is sent (match clerkUserId in Prisma Studio).
    console.log("[GET /api/user] clerkUserId:", user.clerkUserId, "plan:", user.plan, "typeof plan:", typeof user.plan);
    return NextResponse.json({
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      credits: user.credits,
      plan: user.plan,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/user]", err);
    return NextResponse.json(
      { error: "Failed to load user" },
      { status: 500 }
    );
  }
}
