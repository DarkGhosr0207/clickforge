import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateThumbnailImageWithProvider } from "@/lib/ai/generateThumbnailImageDispatch";
import type { GenerateImageRequestBody } from "@/lib/ai/types";
import { getOrCreateUser, decrementUserCredits } from "@/lib/user";

// Image generation is only allowed for authenticated users. Credits are checked up front,
// then deducted only after a successful AI result with a valid image URL.
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

    if (!result?.imageUrl) {
      return NextResponse.json(
        {
          error:
            "Image generation failed: no image returned. Your credits were not deducted.",
        },
        { status: 500 }
      );
    }

    const newCredits = await decrementUserCredits(userId);
    if (newCredits === null) {
      return NextResponse.json({ error: "Out of credits" }, { status: 402 });
    }

    return NextResponse.json({ imageUrl: result.imageUrl, credits: newCredits });
  } catch (error) {
    console.error("Generation failed, credits preserved:", error);
    return NextResponse.json(
      { error: "Failed to generate image." },
      { status: 500 }
    );
  }
}
