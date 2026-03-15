import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateThumbnailImageWithProvider } from "@/lib/ai/generateThumbnailImageDispatch";
import type { GenerateImageRequestBody } from "@/lib/ai/types";
import { getOrCreateUser, decrementUserCredits } from "@/lib/user";

// Image generation is only allowed for authenticated users. Credits are checked and
// decremented before the expensive AI call so we never run generation without a credit.
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getOrCreateUser(userId);
    if (user.credits <= 0) {
      return NextResponse.json(
        { error: "Out of credits" },
        { status: 402 }
      );
    }

    const newCredits = await decrementUserCredits(userId);
    if (newCredits === null) {
      return NextResponse.json(
        { error: "Out of credits" },
        { status: 402 }
      );
    }

    const body = (await request.json()) as GenerateImageRequestBody;
    const {
      strategy,
      overlayText,
      composition,
      emotion,
      colors,
    } = body;

    if (!strategy || !overlayText || !composition || !emotion || !colors) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: strategy, overlayText, composition, emotion, colors",
        },
        { status: 400 }
      );
    }

    const result = await generateThumbnailImageWithProvider(body);

    return NextResponse.json({ imageUrl: result.imageUrl, credits: newCredits });
  } catch (error) {
    console.error("Error in /api/generate-image:", error);
    return NextResponse.json(
      { error: "Failed to generate image." },
      { status: 500 }
    );
  }
}
