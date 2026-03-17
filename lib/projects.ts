import { prisma } from "@/lib/db";
import type { Recommendation, ThumbnailConcept } from "@/lib/ai/types";

export type ProjectForFrontend = {
  projectId: string;
  videoTitle: string;
  niche: string;
  audience: string;
  createdAt: string;
  lastUpdatedAt: string;
  packs: {
    generatedAt: string;
    data: {
      thumbnails: Array<{
        id: number;
        strategy: string;
        overlayText: string;
        composition: string;
        emotion: string;
        colors: string;
        visualHook?: string;
        score?: number;
          isTopPick?: boolean;
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
      recommendation?: Recommendation | null;
    };
  }[];
};

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
}) {
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

function pickTopConceptIndex(thumbnails: ThumbnailConcept[]): number | null {
  let best: { id: number; score: number } | null = null;
  for (const t of thumbnails) {
    if (typeof t.score !== "number") continue;
    if (!best || t.score > best.score || (t.score === best.score && t.id < best.id)) {
      best = { id: t.id, score: t.score };
    }
  }
  return best?.id ?? null;
}

export async function getProjectsForUser(clerkUserId: string): Promise<ProjectForFrontend[]> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return [];

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { lastUpdatedAt: "desc" },
    include: {
      packs: {
        orderBy: { createdAt: "asc" },
        include: {
          concepts: {
            orderBy: { conceptIndex: "asc" },
          },
        },
      },
    },
  });

  return projects.map((p) => ({
    projectId: p.id,
    videoTitle: p.videoTitle,
    niche: p.niche,
    audience: p.audience,
    createdAt: p.createdAt.toISOString(),
    lastUpdatedAt: p.lastUpdatedAt.toISOString(),
    packs: p.packs.map((pack) => ({
      generatedAt: pack.generatedAt,
      data: {
        thumbnails: pack.concepts.map((c) => conceptFromDbToThumbnail(c)),
        recommendation: (pack.recommendation as Recommendation | null) ?? null,
      },
    })),
  }));
}

type SavePackPayload = {
  videoTitle: string;
  niche: string;
  audience: string;
  activeProjectId?: string | null;
  pack: {
    generatedAt: string;
    recommendation?: Recommendation | null;
    thumbnails: ThumbnailConcept[];
  };
};

export async function savePackForUser(
  clerkUserId: string,
  payload: SavePackPayload
): Promise<ProjectForFrontend[]> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  const { videoTitle, niche, audience, activeProjectId, pack } = payload;
  let project: { id: string } | null = null;

  if (activeProjectId) {
    const byId = await prisma.project.findUnique({
      where: { id: activeProjectId, userId: user.id },
    });
    if (byId && byId.videoTitle === videoTitle && byId.niche === niche && byId.audience === audience) {
      project = byId;
    }
  }
  if (!project) {
    project = await prisma.project.findFirst({
      where: { userId: user.id, videoTitle, niche, audience },
    });
  }
  const now = new Date();
  const topPickId = pickTopConceptIndex(pack.thumbnails);
  if (!project) {
    project = await prisma.project.create({
      data: {
        userId: user.id,
        videoTitle,
        niche,
        audience,
        lastUpdatedAt: now,
      },
    });
  }

  await prisma.pack.create({
    data: {
      projectId: project.id,
      generatedAt: pack.generatedAt,
      recommendation: (pack.recommendation ?? null) as object,
      concepts: {
        create: pack.thumbnails.map((t) => ({
          conceptIndex: t.id,
          strategy: t.strategy,
          overlayText: t.overlayText,
          composition: t.composition,
          emotion: t.emotion,
          colors: t.colors,
          visualHook: t.visualHook ?? null,
          scoreReason: t.scoreReason ?? null,
          curiosityScore: t.curiosityScore ?? null,
          emotionScore: t.emotionScore ?? null,
          clarityScore: t.clarityScore ?? null,
          competitionScore: t.competitionScore ?? null,
          score: t.score ?? null,
          isTopPick: topPickId != null && t.id === topPickId,
          titleSuggestion: t.titleSuggestion ?? null,
          titleReason: t.titleReason ?? null,
          titleFitScore: t.titleFitScore ?? null,
          imageUrl: t.imageUrl ?? null,
        })),
      },
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { lastUpdatedAt: now },
  });

  return getProjectsForUser(clerkUserId);
}

export async function deleteProjectForUser(
  clerkUserId: string,
  projectId: string
): Promise<ProjectForFrontend[]> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return [];
  await prisma.project.deleteMany({
    where: { id: projectId, userId: user.id },
  });
  return getProjectsForUser(clerkUserId);
}

export async function deletePackForUser(
  clerkUserId: string,
  projectId: string,
  packGeneratedAt: string
): Promise<ProjectForFrontend[]> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return [];
  const pack = await prisma.pack.findFirst({
    where: { projectId, generatedAt: packGeneratedAt, project: { userId: user.id } },
    select: { id: true },
  });
  if (pack) {
    await prisma.pack.delete({ where: { id: pack.id } });
  }
  const remainingPacks = await prisma.pack.count({ where: { projectId } });
  if (remainingPacks === 0) {
    await prisma.project.deleteMany({
      where: { id: projectId, userId: user.id },
    });
  }
  return getProjectsForUser(clerkUserId);
}

export async function updateConceptImageForUser(
  clerkUserId: string,
  projectId: string,
  packGeneratedAt: string,
  conceptIndex: number,
  imageUrl: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return;
  const pack = await prisma.pack.findFirst({
    where: { projectId, generatedAt: packGeneratedAt, project: { userId: user.id } },
    include: { concepts: true },
  });
  if (!pack) return;
  const concept = pack.concepts.find((c) => c.conceptIndex === conceptIndex);
  if (concept) {
    await prisma.concept.update({
      where: { id: concept.id },
      data: { imageUrl },
    });
  }
}

export async function updatePackThumbnailsForUser(
  clerkUserId: string,
  projectId: string,
  packGeneratedAt: string,
  thumbnails: ThumbnailConcept[]
): Promise<ProjectForFrontend[]> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) return getProjectsForUser(clerkUserId);
  const pack = await prisma.pack.findFirst({
    where: { projectId, generatedAt: packGeneratedAt, project: { userId: user.id } },
    include: { concepts: true },
  });
  if (!pack) return getProjectsForUser(clerkUserId);
  await prisma.concept.deleteMany({ where: { packId: pack.id } });
  const topPickId = pickTopConceptIndex(thumbnails);
  await prisma.concept.createMany({
    data: thumbnails.map((t) => ({
      packId: pack.id,
      conceptIndex: t.id,
      strategy: t.strategy,
      overlayText: t.overlayText,
      composition: t.composition,
      emotion: t.emotion,
      colors: t.colors,
      visualHook: t.visualHook ?? null,
      scoreReason: t.scoreReason ?? null,
      curiosityScore: t.curiosityScore ?? null,
      emotionScore: t.emotionScore ?? null,
      clarityScore: t.clarityScore ?? null,
      competitionScore: t.competitionScore ?? null,
      score: t.score ?? null,
      isTopPick: topPickId != null && t.id === topPickId,
      titleSuggestion: t.titleSuggestion ?? null,
      titleReason: t.titleReason ?? null,
      titleFitScore: t.titleFitScore ?? null,
      imageUrl: t.imageUrl ?? null,
    })),
  });
  return getProjectsForUser(clerkUserId);
}
