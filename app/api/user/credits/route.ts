import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { decrementUserCredits } from "@/lib/user";

/**
 * PATCH /api/user/credits
 * Decrements the current user's credits by 1 (e.g. after image generation).
 * Returns new credits count or 402 if insufficient.
 */
export async function PATCH() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newCredits = await decrementUserCredits(userId);
    if (newCredits === null) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }
    return NextResponse.json({ credits: newCredits });
  } catch (err) {
    console.error("[PATCH /api/user/credits]", err);
    return NextResponse.json(
      { error: "Failed to update credits" },
      { status: 500 }
    );
  }
}
