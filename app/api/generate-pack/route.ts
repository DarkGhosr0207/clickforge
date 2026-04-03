import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateThumbnailPack } from "@/lib/ai/generateThumbnailPack";
import { decrementUserCredits } from "@/lib/user";

// This route now focuses on:
// - reading and validating input
// - calling the shared AI helper
// - returning JSON in the same shape as before
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read the JSON body sent from the frontend
    const body = (await request.json()) as {
      title?: string;
      niche?: string;
      audience?: string;
    };

    const { title, niche, audience } = body;

    // Basic validation: all three fields are required
    if (!title || !niche || !audience) {
      return NextResponse.json(
        { error: "Missing required fields: title, niche, audience" },
        { status: 400 }
      );
    }

    // Call the shared AI service function.
    // It will handle OpenAI calls, logging, and JSON parsing.
    const result = await generateThumbnailPack({ title, niche, audience });

    const newCredits = await decrementUserCredits(userId);
    if (newCredits === null) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // Return the result in exactly the same JSON shape as before.
    return NextResponse.json(result);
  } catch (error) {
    // If the OpenAI client is not configured or something else goes wrong,
    // we log the error and return a 500, just like before.
    console.error("Error in /api/generate-pack:", error);
    return NextResponse.json(
      { error: "Failed to generate thumbnail concepts." },
      { status: 500 }
    );
  }
}