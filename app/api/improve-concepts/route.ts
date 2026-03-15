import { NextRequest, NextResponse } from "next/server";
import { improveThumbnailConcepts } from "@/lib/ai/generateThumbnailPack";

/** POST body: { title, niche, audience, conceptsToImprove: [concept1, concept2] } */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      niche?: string;
      audience?: string;
      conceptsToImprove?: Array<{
        id: number;
        strategy: string;
        visualHook?: string;
        overlayText: string;
        composition: string;
        emotion: string;
        colors: string;
        score?: number;
      }>;
    };

    const { title, niche, audience, conceptsToImprove } = body;

    if (!title || !niche || !audience) {
      return NextResponse.json(
        { error: "Missing required fields: title, niche, audience" },
        { status: 400 }
      );
    }

    if (!Array.isArray(conceptsToImprove) || conceptsToImprove.length !== 2) {
      return NextResponse.json(
        { error: "conceptsToImprove must be an array of exactly 2 concepts" },
        { status: 400 }
      );
    }

    const [a, b] = conceptsToImprove;
    if (!a?.id || !a?.strategy || !a?.overlayText || !a?.composition || !a?.emotion || !a?.colors ||
        !b?.id || !b?.strategy || !b?.overlayText || !b?.composition || !b?.emotion || !b?.colors) {
      return NextResponse.json(
        { error: "Each concept must have id, strategy, overlayText, composition, emotion, colors" },
        { status: 400 }
      );
    }

    const result = await improveThumbnailConcepts({
      title,
      niche,
      audience,
      conceptsToImprove: [
        { id: a.id, strategy: a.strategy, visualHook: a.visualHook, overlayText: a.overlayText, composition: a.composition, emotion: a.emotion, colors: a.colors, score: a.score },
        { id: b.id, strategy: b.strategy, visualHook: b.visualHook, overlayText: b.overlayText, composition: b.composition, emotion: b.emotion, colors: b.colors, score: b.score },
      ],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/improve-concepts:", error);
    return NextResponse.json(
      { error: "Failed to improve concepts." },
      { status: 500 }
    );
  }
}
