import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { updatePackThumbnailsForUser } from "@/lib/projects";

/**
 * PATCH /api/projects/packs/thumbnails
 * Replaces a pack's concepts (e.g. after Improve Weak Variants). Body: { projectId, packGeneratedAt, thumbnails }
 */
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      packGeneratedAt?: string;
      thumbnails?: Array<{
        id: number;
        strategy: string;
        overlayText: string;
        composition: string;
        emotion: string;
        colors: string;
        visualHook?: string;
        score?: number;
        scoreReason?: string;
        curiosityScore?: number;
        emotionScore?: number;
        clarityScore?: number;
        competitionScore?: number;
        titleSuggestion?: string;
        titleReason?: string;
        titleFitScore?: number;
        imageUrl?: string;
      }>;
    };
    const { projectId, packGeneratedAt, thumbnails } = body;
    if (!projectId || !packGeneratedAt || !Array.isArray(thumbnails)) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, packGeneratedAt, thumbnails" },
        { status: 400 }
      );
    }

    const projects = await updatePackThumbnailsForUser(
      userId,
      projectId,
      packGeneratedAt,
      thumbnails
    );
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[PATCH /api/projects/packs/thumbnails]", err);
    return NextResponse.json(
      { error: "Failed to update pack thumbnails" },
      { status: 500 }
    );
  }
}
