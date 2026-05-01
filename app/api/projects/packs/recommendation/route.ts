import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ThumbnailConcept } from "@/lib/ai/types";
import { generatePackRecommendation } from "@/lib/ai/generatePackRecommendation";
import { getProjectsForUser } from "@/lib/projects";

function conceptFromDbToThumbnail(c: {
  conceptIndex: number;
  strategy: string;
  overlayText: string;
  composition: string;
  emotion: string;
  colors: string;
  visualHook: string | null;
  score: number | null;
  isTopPick: boolean;
  scoreReason: string | null;
  curiosityScore: number | null;
  emotionScore: number | null;
  clarityScore: number | null;
  competitionScore: number | null;
  titleSuggestion: string | null;
  titleReason: string | null;
  titleFitScore: number | null;
  imageUrl: string | null;
}): ThumbnailConcept {
  return {
    id: c.conceptIndex,
    strategy: c.strategy,
    overlayText: c.overlayText,
    composition: c.composition,
    emotion: c.emotion,
    colors: c.colors,
    ...(c.visualHook != null && { visualHook: c.visualHook }),
    ...(c.score != null && { score: c.score }),
    isTopPick: c.isTopPick,
    ...(c.scoreReason != null && { scoreReason: c.scoreReason }),
    ...(c.curiosityScore != null && { curiosityScore: c.curiosityScore }),
    ...(c.emotionScore != null && { emotionScore: c.emotionScore }),
    ...(c.clarityScore != null && { clarityScore: c.clarityScore }),
    ...(c.competitionScore != null && { competitionScore: c.competitionScore }),
    ...(c.titleSuggestion != null && { titleSuggestion: c.titleSuggestion }),
    ...(c.titleReason != null && { titleReason: c.titleReason }),
    ...(c.titleFitScore != null && { titleFitScore: c.titleFitScore }),
    ...(c.imageUrl != null && { imageUrl: c.imageUrl }),
  };
}

/**
 * POST /api/projects/packs/recommendation
 * Regenerates AI recommendation for a specific pack. Body: { projectId, packGeneratedAt }
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      packGeneratedAt?: string;
    };
    const { projectId, packGeneratedAt } = body;

    if (!projectId || !packGeneratedAt) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, packGeneratedAt" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const pack = await prisma.pack.findFirst({
      where: {
        projectId,
        generatedAt: packGeneratedAt,
        project: { userId: user.id },
      },
      include: { concepts: true, project: true },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    const thumbnails = pack.concepts
      .sort((a, b) => a.conceptIndex - b.conceptIndex)
      .map((c) => conceptFromDbToThumbnail(c));

    const nextRec = await generatePackRecommendation({
      title: pack.project.videoTitle,
      niche: pack.project.niche,
      audience: pack.project.audience,
      thumbnails,
    });

    await prisma.pack.update({
      where: { id: pack.id },
      data: {
        recommendation: (nextRec ?? null) as object,
        recommendedVariantId: nextRec?.bestVariantId ?? null,
        recommendationExplanation: nextRec?.explanation ?? null,
        recommendationCtrReasoning: nextRec?.ctrReasoning ?? null,
        recommendationStressRisk: nextRec?.stressTest?.risk ?? null,
        recommendationStressImprovement: nextRec?.stressTest?.improvement ?? null,
      },
    });

    const projects = await getProjectsForUser(clerkUserId);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[POST /api/projects/packs/recommendation]", err);
    return NextResponse.json(
      { error: "Failed to regenerate recommendation" },
      { status: 500 }
    );
  }
}

