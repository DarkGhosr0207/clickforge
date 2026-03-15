import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUserWithFlag } from "@/lib/user";

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
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;

    const { user, wasCreated } = await getOrCreateUserWithFlag(userId, email);

    console.log("[GET /api/user]", {
      clerkUserId: user.clerkUserId,
      email: user.email,
      foundOrCreated: wasCreated ? "created" : "found",
      userId: user.id,
      plan: user.plan,
      credits: user.credits,
    });

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
