import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import type { Recommendation } from "@/lib/ai/types";
import { getProjectsForUser, savePackForUser } from "@/lib/projects";

/**
 * GET /api/projects
 * Returns all projects for the authenticated user (with packs and concepts).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await getProjectsForUser(userId);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Saves a new pack (and optionally creates a project). Body: { videoTitle, niche, audience, activeProjectId?, pack: { generatedAt, recommendation?, thumbnails } }
 * Returns updated projects list for the user.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      videoTitle?: string;
      niche?: string;
      audience?: string;
      activeProjectId?: string | null;
      pack?: {
        generatedAt?: string;
        recommendation?: unknown;
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
    };

    const { videoTitle, niche, audience, activeProjectId, pack } = body;
    if (!videoTitle || !niche || !audience || !pack?.generatedAt || !Array.isArray(pack.thumbnails)) {
      return NextResponse.json(
        { error: "Missing required fields: videoTitle, niche, audience, pack.generatedAt, pack.thumbnails" },
        { status: 400 }
      );
    }

    const projects = await savePackForUser(userId, {
      videoTitle,
      niche,
      audience,
      activeProjectId: activeProjectId ?? undefined,
      pack: {
        generatedAt: pack.generatedAt,
        recommendation: (pack.recommendation as Recommendation | null) ?? null,
        thumbnails: pack.thumbnails,
      },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to save pack" },
      { status: 500 }
    );
  }
}
