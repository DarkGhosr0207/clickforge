import { NextRequest, NextResponse } from "next/server";
import { generateThumbnailImage } from "@/lib/ai/generateThumbnailImage";
import type { GenerateImageRequestBody } from "@/lib/ai/types";

// This route now focuses on:
// - reading and validating input
// - calling the shared AI helper
// - returning JSON in the same format as before
export async function POST(request: NextRequest) {
  try {
    // Read and type the JSON body from the client
    const body = (await request.json()) as GenerateImageRequestBody;
    const {
      title,
      niche,
      audience,
      strategy,
      visualHook,
      overlayText,
      composition,
      emotion,
      colors,
    } = body;

    // These fields are required to build a strong thumbnail prompt.
    // Title, niche, audience, and visualHook are highly recommended,
    // but we keep them optional so we don't break older clients.
    if (!strategy || !overlayText || !composition || !emotion || !colors) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: strategy, overlayText, composition, emotion, colors",
        },
        { status: 400 }
      );
    }

    // Call the shared AI service function.
    // It will talk to OpenAI and return the image URL.
    const result = await generateThumbnailImage(body);

    // Return JSON in exactly the same shape as before.
    return NextResponse.json(result);
  } catch (error) {
    // If the OpenAI client is not configured or something else goes wrong,
    // we log the error and return a 500, just like before.
    console.error("Error in /api/generate-image:", error);
    return NextResponse.json(
      { error: "Failed to generate image." },
      { status: 500 }
    );
  }
}
