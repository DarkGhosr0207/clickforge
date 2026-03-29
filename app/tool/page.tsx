"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import localforage from "localforage";

// Configure IndexedDB/localForage for project storage once at module load.
if (typeof window !== "undefined") {
  localforage.config({
    name: "ctrlab",
    storeName: "projects",
  });
}
import { downloadImage } from "@/lib/downloadImage";
import type {
  ThumbnailConcept as BaseThumbnailConcept,
  GeneratePackResponse,
  Recommendation,
  PackComparisonResult,
} from "@/lib/ai/types";

// Extend the shared ThumbnailConcept type with UI-only fields.
// These are used purely on the frontend for loading and error states.
type ThumbnailConcept = BaseThumbnailConcept & {
  imageUrl?: string;
  isImageLoading?: boolean;
  imageError?: string | null;
};

// Saved pack for a project (one generation run)
type SavedPack = {
  generatedAt: string;
  data: GeneratePackResponse;
};

// Simple project model for local history
type Project = {
  projectId: string;
  videoTitle: string;
  niche: string;
  audience: string;
  createdAt: string;
  lastUpdatedAt: string;
  packs: SavedPack[];
};

// Temporary storage key for guest-generated pack (carried over after sign-up/sign-in).
const PENDING_GUEST_PACK_KEY = "ctrPendingGuestPack";

/** IndexedDB name used before the CTRLab rebrand (localForage default instance). */
const LEGACY_LOCALFORAGE_DB = "ctr-pack-generator";

let localForageMigrationPromise: Promise<void> | null = null;

/**
 * One-time migration: copy guest keys from the legacy DB into the current `ctrlab` store if missing.
 */
function ensureLocalForageMigrated(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!localForageMigrationPromise) {
    localForageMigrationPromise = (async () => {
      const legacy = localforage.createInstance({
        name: LEGACY_LOCALFORAGE_DB,
        storeName: "projects",
      });
      const keysToMigrate = ["ctrCredits", PENDING_GUEST_PACK_KEY] as const;
      for (const key of keysToMigrate) {
        const current = await localforage.getItem(key);
        if (current != null) continue;
        const fromLegacy = await legacy.getItem(key);
        if (fromLegacy != null) {
          await localforage.setItem(key, fromLegacy);
        }
      }
    })();
  }
  return localForageMigrationPromise;
}

type PendingGuestPack = {
  videoTitle: string;
  niche: string;
  audience: string;
  generatedAt: string;
  data: GeneratePackResponse;
};

export default function Home() {
  const [videoTitle, setVideoTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState<ThumbnailConcept[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [improvingConceptIds, setImprovingConceptIds] = useState<number[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activePackGeneratedAt, setActivePackGeneratedAt] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PackComparisonResult | null>(null);
  const [credits, setCredits] = useState(10);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [imageCreditError, setImageCreditError] = useState<string | null>(null);
  const [hasLoadedProjects, setHasLoadedProjects] = useState(false);
  const [hasLoadedCredits, setHasLoadedCredits] = useState(false);
  const [isEditingQuery, setIsEditingQuery] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [copiedTitleId, setCopiedTitleId] = useState<number | null>(null);
  const [copiedAllConcepts, setCopiedAllConcepts] = useState(false);
  const [copiedIdeaId, setCopiedIdeaId] = useState<number | null>(null);
  const generatorRef = useRef<HTMLDivElement | null>(null);
  const projectsRef = useRef<HTMLDivElement | null>(null);
  /** Horizontal variant row: Top Pick first for visibility (presentation-only sort). */
  const variantScrollRef = useRef<HTMLDivElement | null>(null);

  // Clerk auth: guest (signed out) = teaser; signed in = full experience (all concepts, analytics, images, persistence).
  const { isSignedIn } = useAuth();
  const isAuthenticated = !!isSignedIn;
  const isGuest = !isAuthenticated;
  const visibleConcepts = isAuthenticated ? concepts : concepts.slice(0, 2);

  const conceptsForDisplay = useMemo(() => {
    return [...visibleConcepts].sort((a, b) => {
      if (a.isTopPick && !b.isTopPick) return -1;
      if (!a.isTopPick && b.isTopPick) return 1;
      return a.id - b.id;
    });
  }, [visibleConcepts]);

  /** Horizontal variant strip: visible index range + scroll edges (UI only). */
  const [variantStripView, setVariantStripView] = useState<{
    start: number;
    end: number;
    total: number;
    atStart: boolean;
    atEnd: boolean;
  }>({ start: 1, end: 1, total: 0, atStart: true, atEnd: true });

  const updateVariantStripView = useCallback(() => {
    const el = variantScrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-variant-card]");
    const total = cards.length;
    if (total === 0) {
      setVariantStripView((prev) =>
        prev.total === 0 && prev.start === 1 && prev.end === 1 && prev.atStart && prev.atEnd
          ? prev
          : { start: 1, end: 1, total: 0, atStart: true, atEnd: true }
      );
      return;
    }
    const cr = el.getBoundingClientRect();
    let minI = Infinity;
    let maxI = -1;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const overlap = Math.min(r.right, cr.right) - Math.max(r.left, cr.left);
      // Wider overlap gate + fraction of card width reduces flicker at strip edges.
      const minOverlap = Math.max(28, Math.min(r.width, cr.width) * 0.1);
      if (overlap >= minOverlap) {
        minI = Math.min(minI, i);
        maxI = Math.max(maxI, i);
      }
    });
    const atStart = el.scrollLeft <= 10;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    const next =
      maxI < 0 || minI === Infinity
        ? { start: 1, end: total, total, atStart, atEnd }
        : { start: minI + 1, end: maxI + 1, total, atStart, atEnd };

    setVariantStripView((prev) => {
      if (
        prev.start === next.start &&
        prev.end === next.end &&
        prev.total === next.total &&
        prev.atStart === next.atStart &&
        prev.atEnd === next.atEnd
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const scrollVariantStripBy = useCallback((direction: -1 | 1) => {
    const root = variantScrollRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>("[data-variant-card]");
    if (!first) return;
    const styles = window.getComputedStyle(root);
    const gapRaw = styles.columnGap || styles.gap;
    const gap = Number.parseFloat(gapRaw) || 20;
    const delta = first.offsetWidth + gap;
    root.scrollBy({ left: direction * delta, behavior: "smooth" });
  }, []);

  // Layout: three states — library, guest results, or project workspace.
  const isProjectOpen = !!activeProjectId;
  const isGuestResultsOpen = !isAuthenticated && concepts.length > 0;
  const isLibraryView = !isProjectOpen && !isGuestResultsOpen;

  // Reusable loader for authenticated user (plan + credits). Refreshes when tab regains focus or becomes visible.
  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { credits: number; plan?: string };
        // Debug: confirm what plan was returned and that state is updated.
        console.log("[loadCurrentUser] plan from API:", data.plan, "setting:", data.plan === "pro" ? "pro" : "free");
        setCredits(data.credits);
        setPlan(data.plan === "pro" ? "pro" : "free");
      }
    } catch (err) {
      console.error("Failed to load user:", err);
    }
  }, []);

  // Credits: initial load — signed-in from API, guests from local storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthenticated) {
      loadCurrentUser().finally(() => setHasLoadedCredits(true));
    } else {
      (async () => {
        try {
          await ensureLocalForageMigrated();
          const stored = await localforage.getItem<number>("ctrCredits");
          if (typeof stored === "number") setCredits(stored);
        } catch (err) {
          console.error("Failed to load credits from localforage:", err);
        }
        setHasLoadedCredits(true);
      })();
    }
  }, [isAuthenticated, loadCurrentUser]);

  // Refresh plan/credits when window regains focus or tab becomes visible (authenticated only).
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return;
    const onRefresh = () => void loadCurrentUser();
    window.addEventListener("focus", onRefresh);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onRefresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isAuthenticated, loadCurrentUser]);

  // On auth: import pending guest pack into a real project in Postgres and open workspace.
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return;
    (async () => {
      try {
        await ensureLocalForageMigrated();
        const pending = await localforage.getItem<PendingGuestPack>(PENDING_GUEST_PACK_KEY);
        if (!pending) return;
        const { videoTitle: title, niche: n, audience: a, generatedAt, data } = pending;
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoTitle: title,
            niche: n,
            audience: a,
            pack: {
              generatedAt,
              recommendation: data.recommendation ?? null,
              thumbnails: data.thumbnails,
            },
          }),
        });
        if (!res.ok) {
          console.error("Failed to save guest pack to backend");
          return;
        }
        const { projects: nextProjects } = (await res.json()) as { projects: Project[] };
        setProjects(nextProjects);
        const projectWithPack = nextProjects.find((p) =>
          p.packs.some((pack) => pack.generatedAt === generatedAt)
        );
        if (projectWithPack) {
          setActiveProjectId(projectWithPack.projectId);
          setActivePackGeneratedAt(generatedAt);
        }
        setVideoTitle(title);
        setNiche(n);
        setAudience(a);
        setConcepts(data.thumbnails);
        setRecommendation(data.recommendation ?? null);
        setComparisonResult(null);
        setImprovingConceptIds([]);
        setError(null);
        await localforage.removeItem(PENDING_GUEST_PACK_KEY);
      } catch (err) {
        console.error("Failed to import pending guest pack:", err);
      }
    })();
  }, [isAuthenticated]);

  // Persist credits to localforage only for guests (signed-in users use backend).
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedCredits || isAuthenticated) return;
    (async () => {
      try {
        await localforage.setItem("ctrCredits", credits);
      } catch (err) {
        console.error("Failed to persist credits to localforage:", err);
      }
    })();
  }, [credits, hasLoadedCredits, isAuthenticated]);

  // Horizontal variant row: smooth-scroll to start when pack or variant count changes (Top Pick is first).
  useEffect(() => {
    const el = variantScrollRef.current;
    if (!el || conceptsForDisplay.length === 0) return;
    requestAnimationFrame(() => {
      el.scrollTo({ left: 0, behavior: "smooth" });
      requestAnimationFrame(() => updateVariantStripView());
    });
  }, [activePackGeneratedAt, conceptsForDisplay.length, isProjectOpen, updateVariantStripView]);

  // Track visible variant index range + scroll edges for carousel UI.
  useEffect(() => {
    const el = variantScrollRef.current;
    if (!el) return;
    const onScrollOrResize = () => updateVariantStripView();
    el.addEventListener("scroll", onScrollOrResize, { passive: true });
    const ro = new ResizeObserver(() => updateVariantStripView());
    ro.observe(el);
    window.addEventListener("resize", onScrollOrResize);
    requestAnimationFrame(() => updateVariantStripView());
    return () => {
      el.removeEventListener("scroll", onScrollOrResize);
      ro.disconnect();
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [
    updateVariantStripView,
    conceptsForDisplay.length,
    concepts.length,
    isAuthenticated,
    activePackGeneratedAt,
  ]);

  // Load projects: authenticated users from backend; guests have no project library.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      if (isAuthenticated) {
        try {
          const res = await fetch("/api/projects");
          if (res.ok) {
            const data = (await res.json()) as { projects: Project[] };
            setProjects(data.projects);
          }
        } catch (err) {
          console.error("Failed to load projects from API:", err);
          setProjects([]);
        }
      }
      setHasLoadedProjects(true);
    })();
  }, [isAuthenticated]);

  const formatCtrScore = (score: number) => score.toFixed(1);

  const pickTopConceptIndex = (thumbnails: Array<{ id: number; score?: number }>): number | null => {
    let best: { id: number; score: number } | null = null;
    for (const t of thumbnails) {
      if (typeof t.score !== "number") continue;
      if (!best || t.score > best.score || (t.score === best.score && t.id < best.id)) {
        best = { id: t.id, score: t.score };
      }
    }
    return best?.id ?? null;
  };

  const attachTopPick = <T extends { id: number; score?: number }>(thumbnails: T[]): T[] => {
    const topPickId = pickTopConceptIndex(thumbnails);
    return thumbnails.map((t) => ({
      ...t,
      isTopPick: topPickId != null && t.id === topPickId,
    }));
  };

  const getBestVariantIdFromConcepts = (thumbnails: Array<{ id: number; score?: number; isTopPick?: boolean }>) => {
    const topPick = thumbnails.find((t) => t.isTopPick);
    if (topPick) return topPick.id;
    return pickTopConceptIndex(thumbnails);
  };

  // This function will generate an image for a single concept (card).
  // Uses functional setConcepts updates so multiple in-flight requests don't overwrite each other.
  const handleGenerateImage = async (conceptId: number) => {
    if (credits <= 0) {
      setImageCreditError("No image credits left.");
      return;
    }

    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return;

    setImageCreditError(null);
    setConcepts((prev) =>
      prev.map((c) =>
        c.id === conceptId
          ? { ...c, imageError: null, isImageLoading: true }
          : c
      )
    );

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: videoTitle,
          niche,
          audience,
          strategy: concept.strategy,
          visualHook: concept.visualHook,
          overlayText: concept.overlayText,
          composition: concept.composition,
          emotion: concept.emotion,
          colors: concept.colors,
        }),
      });

      if (response.status === 402) {
        setCredits(0);
        setImageCreditError("You're out of credits.");
        setConcepts((prev) =>
          prev.map((c) =>
            c.id === conceptId
              ? { ...c, imageError: "You're out of credits.", isImageLoading: false }
              : c
          )
        );
        return;
      }

      if (!response.ok) {
        setConcepts((prev) =>
          prev.map((c) =>
            c.id === conceptId
              ? {
                  ...c,
                  imageError: "Failed to generate image. Please try again.",
                  isImageLoading: false,
                }
              : c
          )
        );
        return;
      }

      const data = (await response.json()) as { imageUrl: string; credits?: number };

      setConcepts((prev) =>
        prev.map((c) =>
          c.id === conceptId
            ? { ...c, imageUrl: data.imageUrl, isImageLoading: false }
            : c
        )
      );

      if (typeof data.credits === "number") {
        setCredits(data.credits);
      }

      setProjects((prev) => {
        if (prev.length === 0) return prev;

        const projectToUpdate =
          (activeProjectId && prev.find((p) => p.projectId === activeProjectId)) ||
          prev.find(
            (p) =>
              p.videoTitle === videoTitle &&
              p.niche === niche &&
              p.audience === audience
          );

        if (!projectToUpdate || projectToUpdate.packs.length === 0) {
          return prev;
        }

        return prev.map((project) => {
          if (project.projectId !== projectToUpdate.projectId) return project;
          if (project.packs.length === 0) return project;

          const packs = [...project.packs];
          let packIndex =
            activePackGeneratedAt != null
              ? packs.findIndex((p) => p.generatedAt === activePackGeneratedAt)
              : -1;
          if (packIndex === -1) {
            packIndex = packs.length - 1;
          }

          const packToUpdate = packs[packIndex];
          const updatedThumbnails = packToUpdate.data.thumbnails.map((t) =>
            t.id === conceptId ? { ...t, imageUrl: data.imageUrl } : t
          );

          packs[packIndex] = {
            ...packToUpdate,
            data: {
              ...packToUpdate.data,
              thumbnails: updatedThumbnails,
            },
          };

          return { ...project, packs };
        });
      });

      if (isAuthenticated && activeProjectId && activePackGeneratedAt != null) {
        fetch("/api/projects/packs/concept-image", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: activeProjectId,
            packGeneratedAt: activePackGeneratedAt,
            conceptIndex: conceptId,
            imageUrl: data.imageUrl,
          }),
        }).catch((err) => console.error("Failed to persist concept image:", err));
      }
    } catch (err) {
      setConcepts((prev) =>
        prev.map((c) =>
          c.id === conceptId
            ? {
                ...c,
                imageError: "Unable to reach the server. Please try again.",
                isImageLoading: false,
              }
            : c
        )
      );
    }
  };

  // Improve the two lowest-scoring concepts by regenerating them via the API.
  const handleImproveWeakVariants = async () => {
    if (concepts.length < 2) return;
    const sorted = [...concepts].sort((x, y) => (x.score ?? 0) - (y.score ?? 0));
    const [first, second] = sorted;
    const ids = [first.id, second.id];
    setImprovingConceptIds(ids);
    setError(null);

    try {
      const response = await fetch("/api/improve-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          niche,
          audience,
          conceptsToImprove: [
            { id: first.id, strategy: first.strategy, visualHook: first.visualHook, overlayText: first.overlayText, composition: first.composition, emotion: first.emotion, colors: first.colors, score: first.score },
            { id: second.id, strategy: second.strategy, visualHook: second.visualHook, overlayText: second.overlayText, composition: second.composition, emotion: second.emotion, colors: second.colors, score: second.score },
          ],
        }),
      });

      if (!response.ok) {
        setError("Failed to improve variants. Please try again.");
        setImprovingConceptIds([]);
        return;
      }

      const data: { thumbnails: ThumbnailConcept[] } = await response.json();
      const improvedConcepts = concepts.map((c) => {
        const replacement = data.thumbnails.find((t) => t.id === c.id);
        if (replacement) {
          return { ...replacement, imageUrl: undefined, imageError: null, isImageLoading: false };
        }
        return c;
      });
      const improvedWithTopPick = attachTopPick(improvedConcepts);
      setConcepts(improvedWithTopPick);

      // Clear stale recommendation until the persisted pack update returns a fresh one.
      setRecommendation(null);

      if (isAuthenticated && activeProjectId && activePackGeneratedAt != null) {
        try {
          const patchRes = await fetch("/api/projects/packs/thumbnails", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: activeProjectId,
              packGeneratedAt: activePackGeneratedAt,
              thumbnails: improvedConcepts.map((c) => ({
                id: c.id,
                strategy: c.strategy,
                overlayText: c.overlayText,
                composition: c.composition,
                emotion: c.emotion,
                colors: c.colors,
                visualHook: c.visualHook,
                score: c.score,
                scoreReason: c.scoreReason,
                curiosityScore: c.curiosityScore,
                emotionScore: c.emotionScore,
                clarityScore: c.clarityScore,
                competitionScore: c.competitionScore,
                titleSuggestion: c.titleSuggestion,
                titleReason: c.titleReason,
                titleFitScore: c.titleFitScore,
                imageUrl: c.imageUrl,
              })),
            }),
          });
          if (patchRes.ok) {
            const { projects: nextProjects } = (await patchRes.json()) as { projects: Project[] };
            setProjects(nextProjects);
            // Pull the freshly regenerated, persisted recommendation for the active pack.
            const updatedProject = nextProjects.find((p) => p.projectId === activeProjectId);
            const updatedPack = updatedProject?.packs.find((p) => p.generatedAt === activePackGeneratedAt);
            setRecommendation(updatedPack?.data.recommendation ?? null);
          }
        } catch (err) {
          console.error("Failed to persist improved concepts:", err);
        }
      }
    } catch (err) {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setImprovingConceptIds([]);
    }
  };

  // Helper to select a project and load its latest pack (by generatedAt descending).
  const handleSelectProject = (projectId: string) => {
    const project = projects.find((p) => p.projectId === projectId);
    if (!project) return;

    setActiveProjectId(projectId);
    setVideoTitle(project.videoTitle);
    setNiche(project.niche);
    setAudience(project.audience);
    setError(null);
    setImprovingConceptIds([]);
    setComparisonResult(null);

    const sortedPacks = [...project.packs].sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
    const latestPack = sortedPacks[0];
    if (latestPack) {
      setConcepts(latestPack.data.thumbnails);
      setRecommendation(latestPack.data.recommendation ?? null);
      setActivePackGeneratedAt(latestPack.generatedAt);
    } else {
      setConcepts([]);
      setRecommendation(null);
      setActivePackGeneratedAt(null);
    }
  };

  // Select a specific pack within the active project
  const handleSelectPack = (generatedAt: string) => {
    const project = projects.find((p) => p.projectId === activeProjectId);
    if (!project) return;
    const pack = project.packs.find((p) => p.generatedAt === generatedAt);
    if (!pack) return;

    setActivePackGeneratedAt(generatedAt);
    setConcepts(pack.data.thumbnails);
    setRecommendation(pack.data.recommendation ?? null);
    setImprovingConceptIds([]);
    setComparisonResult(null);
  };

  const handleDeleteProject = async (projectId?: string, confirmMessage?: string) => {
    const idToDelete = projectId ?? activeProjectId;
    if (!idToDelete) return;
    const message =
      confirmMessage ?? "Delete this project and all saved packs?";
    if (!window.confirm(message)) return;
    if (isAuthenticated) {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(idToDelete)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          const { projects: nextProjects } = (await res.json()) as { projects: Project[] };
          setProjects(nextProjects);
        } else {
          setProjects((prev) => prev.filter((p) => p.projectId !== idToDelete));
        }
      } catch (err) {
        console.error("Failed to delete project:", err);
        setProjects((prev) => prev.filter((p) => p.projectId !== idToDelete));
      }
    } else {
      setProjects((prev) => prev.filter((p) => p.projectId !== idToDelete));
    }
    if (idToDelete === activeProjectId) {
      setActiveProjectId(null);
      setActivePackGeneratedAt(null);
      setConcepts([]);
      setRecommendation(null);
      setComparisonResult(null);
      setImprovingConceptIds([]);
      setError(null);
      generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleDeletePack = async (projectId: string, packGeneratedAt: string) => {
    if (!window.confirm("Delete this saved pack?")) return;
    const project = projects.find((p) => p.projectId === projectId);
    if (!project) return;

    const wasActivePack = packGeneratedAt === activePackGeneratedAt;

    const applyActiveState = (nextProjects: Project[]) => {
      if (!wasActivePack) return;
      const updatedProject = nextProjects.find((p) => p.projectId === projectId);
      const remaining = updatedProject?.packs ?? [];
      if (remaining.length > 0) {
        const latest = remaining[remaining.length - 1];
        setActivePackGeneratedAt(latest.generatedAt);
        setConcepts(latest.data.thumbnails);
        setRecommendation(latest.data.recommendation ?? null);
        setComparisonResult(null);
        setImprovingConceptIds([]);
      } else {
        setActiveProjectId(null);
        setActivePackGeneratedAt(null);
        setConcepts([]);
        setRecommendation(null);
        setComparisonResult(null);
        setImprovingConceptIds([]);
        setError(null);
      }
    };

    if (isAuthenticated) {
      try {
        const url = `/api/projects/${encodeURIComponent(projectId)}/packs?generatedAt=${encodeURIComponent(packGeneratedAt)}`;
        const res = await fetch(url, { method: "DELETE" });
        if (res.ok) {
          const { projects: nextProjects } = (await res.json()) as { projects: Project[] };
          setProjects(nextProjects);
          applyActiveState(nextProjects);
        } else {
          const remainingPacks = project.packs.filter((p) => p.generatedAt !== packGeneratedAt);
          const nextProjects =
            remainingPacks.length === 0
              ? projects.filter((p) => p.projectId !== projectId)
              : projects.map((p) =>
                  p.projectId === projectId
                    ? { ...p, lastUpdatedAt: new Date().toISOString(), packs: remainingPacks }
                    : p
                );
          setProjects(nextProjects);
          applyActiveState(nextProjects);
        }
      } catch (err) {
        console.error("Failed to delete pack:", err);
        const remainingPacks = project.packs.filter((p) => p.generatedAt !== packGeneratedAt);
        const nextProjects =
          remainingPacks.length === 0
            ? projects.filter((p) => p.projectId !== projectId)
            : projects.map((p) =>
                p.projectId === projectId
                  ? { ...p, lastUpdatedAt: new Date().toISOString(), packs: remainingPacks }
                  : p
              );
        setProjects(nextProjects);
        applyActiveState(nextProjects);
      }
    } else {
      const remainingPacks = project.packs.filter((p) => p.generatedAt !== packGeneratedAt);
      const nextProjects =
        remainingPacks.length === 0
          ? projects.filter((p) => p.projectId !== projectId)
          : projects.map((p) =>
              p.projectId === projectId
                ? { ...p, lastUpdatedAt: new Date().toISOString(), packs: remainingPacks }
                : p
            );
      setProjects(nextProjects);
      applyActiveState(nextProjects);
    }
  };

  const handleDownloadImage = (url: string, id: number) => {
    downloadImage(url, `ctrlab-thumbnail-${id}.png`);
  };

  const buildAllConceptsText = (): string => {
    const lines = [
      "VIDEO IDEA:",
      videoTitle || "(none)",
      "",
      ...concepts.flatMap((c) => [
        `CONCEPT ${c.id}`,
        `Strategy: ${c.strategy ?? ""}`,
        `Overlay: ${c.overlayText ?? ""}`,
        `Composition: ${c.composition ?? ""}`,
        `Emotion: ${c.emotion ?? ""}`,
        `Colors: ${c.colors ?? ""}`,
        "",
        "Title:",
        c.titleSuggestion ?? "—",
        "",
        `CTR Score: ${typeof c.score === "number" ? formatCtrScore(c.score) : "—"}/10`,
        "",
      ]),
    ];
    return lines.join("\n");
  };

  const buildConceptIdeaText = (concept: ThumbnailConcept): string => {
    const lines = [
      `Strategy: ${concept.strategy ?? ""}`,
      `Overlay: ${concept.overlayText ?? ""}`,
      `Composition: ${concept.composition ?? ""}`,
      `Emotion: ${concept.emotion ?? ""}`,
      `Colors: ${concept.colors ?? ""}`,
      `Suggested Title: ${concept.titleSuggestion ?? "—"}`,
      `CTR Score: ${typeof concept.score === "number" ? `${formatCtrScore(concept.score)}/10` : "—/10"}`,
    ];
    return lines.join("\n");
  };

  const buildImagePrompt = (concept: ThumbnailConcept): string => {
    const lines = [
      "Create a high-conversion YouTube thumbnail image.",
      "",
      `Video title: ${videoTitle || "(none)"}`,
      `Niche: ${niche || "(none)"}`,
      `Audience: ${audience || "(none)"}`,
      `Strategy: ${concept.strategy || "(none)"}`,
      `Visual hook: ${concept.visualHook || "(none)"}`,
      `Overlay text context: ${concept.overlayText || "(none)"}`,
      `Composition: ${concept.composition || "(none)"}`,
      `Emotion: ${concept.emotion || "(none)"}`,
      `Colors: ${concept.colors || "(none)"}`,
      "",
      "Style requirements:",
      "- modern YouTube thumbnail",
      "- strong focal point",
      "- high contrast",
      "- visually clear at small size",
      "- no YouTube UI",
      "- no unrelated objects",
      "- no text rendered inside the image",
    ];
    return lines.join("\n");
  };

  // Helper to quickly fill the form with an example prompt.
  const handleExampleClick = (example: {
    title: string;
    niche: string;
    audience: string;
  }) => {
    setVideoTitle(example.title);
    setNiche(example.niche);
    setAudience(example.audience);
    // Clear any previous error once we provide a complete example
    setError(null);
  };

  const handleGenerate = async () => {
    // Clear any previous error message
    setError(null);

    // Simple front-end validation: make sure all fields are filled
    if (!videoTitle || !niche || !audience) {
      setError("Please fill in the title, niche, and audience before generating.");
      return;
    }

    // At this point we know we have valid input, so we can
    // call our API route.
    setLoading(true);

    try {
      // Send a POST request to our Next.js API route
      const response = await fetch("/api/generate-pack", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // The body must be a JSON string
        body: JSON.stringify({
          title: videoTitle,
          niche,
          audience,
        }),
      });

      // If the response is not OK (status code not in the 200s),
      // we show a simple error message.
      if (!response.ok) {
        setError("Something went wrong while generating your CTR pack. Please try again.");
        setLoading(false);
        return;
      }

      // Read the JSON body from the response and type it
      const data: GeneratePackResponse = await response.json();

      // Update our concepts state with the thumbnails from the API
      setConcepts(attachTopPick(data.thumbnails));
      setRecommendation(data.recommendation ?? null);
      setComparisonResult(null);

      // Persist guest pack temporarily so it can be carried over after sign-up/sign-in.
      if (!isAuthenticated) {
        const now = new Date().toISOString();
        const pending: PendingGuestPack = {
          videoTitle,
          niche,
          audience,
          generatedAt: now,
          data,
        };
        try {
          await localforage.setItem(PENDING_GUEST_PACK_KEY, pending);
        } catch (err) {
          console.error("Failed to save pending guest pack:", err);
        }
      }

      // Save this pack to backend (authenticated users only) and refresh state from server.
      if (isAuthenticated) {
        const now = new Date().toISOString();
        try {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videoTitle,
              niche,
              audience,
              activeProjectId: activeProjectId || undefined,
              pack: {
                generatedAt: now,
                recommendation: data.recommendation ?? null,
                thumbnails: data.thumbnails,
              },
            }),
          });
          if (res.ok) {
            const { projects: nextProjects } = (await res.json()) as { projects: Project[] };
            setProjects(nextProjects);
            const projectWithNewPack = nextProjects.find((p) =>
              p.packs.some((pack) => pack.generatedAt === now)
            );
            if (projectWithNewPack) {
              setActiveProjectId(projectWithNewPack.projectId);
              setActivePackGeneratedAt(now);
            }
          }
        } catch (err) {
          console.error("Failed to save pack to backend:", err);
        }
      }
    } catch (err) {
      // This catches network errors or other unexpected problems
      setError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      // No matter what happens above, we stop the loading state here
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-[#0B0B0F] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(50vh,520px)] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 85% 55% at 50% -15%, rgba(99, 102, 241, 0.22), transparent 58%)",
        }}
      />
      {/* Sticky top bar — matches landing page */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/60 shadow-[0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="min-w-0 shrink">
            <span className="block text-xl font-bold tracking-tight text-white md:text-2xl">CTRLAB</span>
            <span className="mt-0.5 block text-sm font-medium text-gray-400">Test what gets clicks</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-gray-400 transition hover:text-white">
              Home
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-gray-400 transition hover:text-white">
              Pricing
            </Link>
            {isAuthenticated && (
              <>
                {!hasLoadedCredits ? (
                  <>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Loading…
                    </span>
                    <span className="text-sm font-medium text-gray-400">Credits: …</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      {plan === "pro" ? "Pro plan" : "Free plan"}
                    </span>
                    <span className="text-sm font-medium text-gray-300">Credits left: {credits}</span>
                  </>
                )}
                <UserButton
                  appearance={{
                    elements: { avatarBox: "h-8 w-8" },
                  }}
                />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-6 py-10 pb-16">
        <p className="mb-10 max-w-2xl text-sm leading-relaxed text-gray-400">
          Generate strategic YouTube thumbnail concepts designed to improve click-through rate.
        </p>

        {/* Project Library view: generator + project library (no project open, no guest results) */}
        {isLibraryView && (
          <>
            {/* Generator form */}
            <div
              ref={generatorRef}
              className="mb-10 rounded-2xl border border-white/[0.08] bg-[#141419] p-8 shadow-xl shadow-black/30"
            >
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Video title</label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="e.g. I opened a sushi bar in Barcelona"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Niche</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g. restaurant, business, sports, travel"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Audience</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. food lovers, entrepreneurs, beginners"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                  />
                </div>
              </div>

              {/* Quick example prompts */}
              <div className="mt-6 space-y-2 text-sm">
                <p className="text-gray-400">Try an example:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleExampleClick({
                        title: "I opened a sushi bar in Barcelona",
                        niche: "restaurant",
                        audience: "food lovers",
                      })
                    }
                    className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.08]"
                  >
                    I opened a sushi bar in Barcelona
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleExampleClick({
                        title: "I tried cold plunges for 30 days",
                        niche: "fitness",
                        audience: "beginners",
                      })
                    }
                    className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.08]"
                  >
                    I tried cold plunges for 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleExampleClick({
                        title: "Why most startups fail in year one",
                        niche: "business",
                        audience: "entrepreneurs",
                      })
                    }
                    className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.08]"
                  >
                    Why most startups fail in year one
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleExampleClick({
                        title: "Living in Bali for a month",
                        niche: "travel",
                        audience: "travel lovers",
                      })
                    }
                    className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.08]"
                  >
                    Living in Bali for a month
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-xl bg-[#6366F1] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    boxShadow:
                      "0 0 0 1px rgba(255,255,255,0.08) inset, 0 12px 32px -8px rgba(99, 102, 241, 0.5)",
                  }}
                >
                  {loading ? "Generating..." : "Generate CTR Pack"}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-400">
                  {error}
                </p>
              )}
            </div>

            {/* Project Library: all projects, sorted by last updated */}
            {isAuthenticated && (
              <div ref={projectsRef} className="mb-10">
                <h2 className="mb-4 text-lg font-semibold text-white">Project Library</h2>
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No projects yet. Generate a CTR pack above to create your first project.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[...projects]
                      .sort(
                        (a, b) =>
                          new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime()
                      )
                      .map((project) => {
                        const packCount = project.packs.length;
                        const created = new Date(project.createdAt).toLocaleDateString();
                        const lastUpdated = new Date(project.lastUpdatedAt).toLocaleString();
                        return (
                          <div
                            key={project.projectId}
                            className="rounded-2xl border border-white/[0.08] bg-[#141419] p-5 shadow-lg shadow-black/20"
                          >
                            <p className="truncate font-semibold text-white">
                              {project.videoTitle || "Untitled project"}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {project.niche} • {project.audience}
                            </p>
                            <p className="mt-1 text-xs text-gray-400">
                              {packCount} pack{packCount === 1 ? "" : "s"}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              Created {created} · Updated {lastUpdated}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectProject(project.projectId)}
                                className="rounded-xl bg-[#6366F1] px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-indigo-500/25 hover:brightness-110"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteProject(
                                    project.projectId,
                                    "Delete this project and all its packs?"
                                  )
                                }
                                className="rounded-xl border border-red-500/40 bg-transparent px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Results view: project workspace (authenticated) or guest results (guest with concepts) */}
        {(isProjectOpen || isGuestResultsOpen) && (
          <div>
            {/* Guest results: back to generator to return to library */}
            {isGuestResultsOpen && !isProjectOpen && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setConcepts([]);
                    setRecommendation(null);
                    setError(null);
                    generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                >
                  Back to generator
                </button>
              </div>
            )}

            {/* Active project header and workspace controls (authenticated only) */}
            {isProjectOpen && isAuthenticated && (
              (() => {
                const project = projects.find((p) => p.projectId === activeProjectId);
                if (!project) return null;
                return (
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-400">
                      Project:{" "}
                      <span className="font-semibold text-white">
                        {project.videoTitle || "Untitled project"}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Generate a new pack for this project? This will create a new saved pack."
                            )
                          )
                            return;
                          handleGenerate();
                        }}
                        disabled={loading}
                        className="rounded-xl bg-[#6366F1] px-4 py-2 text-xs font-medium text-white shadow-md shadow-indigo-500/25 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading ? "Generating new pack..." : "Generate New Pack"}
                      </button>
                      <span className="h-4 w-px bg-white/10" aria-hidden />
                      <button
                        type="button"
                        onClick={() => setIsEditingQuery((prev) => !prev)}
                        className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                      >
                        {isEditingQuery ? "Close Query Editor" : "Edit Query"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveProjectId(null);
                          setActivePackGeneratedAt(null);
                          setComparisonResult(null);
                          setConcepts([]);
                          setRecommendation(null);
                          setError(null);
                          generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                      >
                        Back to projects
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteProject(undefined, "Delete this project and all saved packs?")
                        }
                        className="rounded-xl border border-red-500/40 bg-transparent px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10"
                      >
                        Delete Project
                      </button>
                    </div>
                  </div>
                );
              })())}

            {/* Inline query editor for the active project (authenticated only) */}
            {isAuthenticated &&
              isEditingQuery &&
              (() => {
                const project = projects.find((p) => p.projectId === activeProjectId);
                if (!project) return null;
                return (
                  <div className="mb-6 rounded-2xl border border-white/[0.08] bg-[#141419] p-6 text-xs text-gray-300">
                    <p className="mb-3 font-medium text-white">Edit query</p>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block font-medium text-gray-400">Video title</label>
                        <input
                          type="text"
                          value={project.videoTitle}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjects((prev) =>
                              prev.map((p) =>
                                p.projectId === project.projectId ? { ...p, videoTitle: value } : p
                              )
                            );
                            setVideoTitle(value);
                          }}
                          className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium text-gray-400">Niche</label>
                        <input
                          type="text"
                          value={project.niche}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjects((prev) =>
                              prev.map((p) =>
                                p.projectId === project.projectId ? { ...p, niche: value } : p
                              )
                            );
                            setNiche(value);
                          }}
                          className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium text-gray-400">Audience</label>
                        <input
                          type="text"
                          value={project.audience}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProjects((prev) =>
                              prev.map((p) =>
                                p.projectId === project.projectId ? { ...p, audience: value } : p
                              )
                            );
                            setAudience(value);
                          }}
                          className="w-full rounded-xl border border-white/[0.12] bg-[#0B0B0F] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Thumbnail Concepts
              </h2>
              <div className="flex items-center gap-3">
                {isAuthenticated && concepts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(buildAllConceptsText());
                      setCopiedAllConcepts(true);
                      setTimeout(() => setCopiedAllConcepts(false), 1500);
                    }}
                    className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    {copiedAllConcepts ? "Copied ✓" : "Copy all concepts"}
                  </button>
                )}
                <p className="text-sm text-gray-400">{concepts.length} variants generated</p>
              </div>
            </div>

            {/* Out-of-credits empty state (authenticated only) */}
            {isAuthenticated && credits <= 0 && concepts.length > 0 && (
              <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[#141419] p-6">
                <h3 className="text-lg font-semibold text-white">You&apos;re out of image credits</h3>
                <p className="mt-2 text-sm text-gray-400">
                  You&apos;ve used all your free credits for image generation.
                  More credits and upgrade options are coming soon.
                </p>
                <button
                  type="button"
                  disabled
                  className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-500"
                >
                  Notify me when more credits are available
                </button>
              </div>
            )}

            {/* Saved packs for the active project (authenticated only) */}
            {isAuthenticated && activeProjectId && (
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-white">Saved Packs</p>
                {(() => {
                  const project = projects.find((p) => p.projectId === activeProjectId);
                  if (!project || project.packs.length === 0) {
                    return (
                      <p className="text-xs text-gray-400">
                        No packs saved yet for this project.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-wrap gap-2">
                      {project.packs.map((pack, index) => {
                        const isActivePack = pack.generatedAt === activePackGeneratedAt;
                        const isLatest = index === project.packs.length - 1;
                        const label = isLatest ? `Pack ${index + 1} (Latest)` : `Pack ${index + 1}`;
                        const when = new Date(pack.generatedAt).toLocaleString();
                        return (
                          <span key={pack.generatedAt} className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSelectPack(pack.generatedAt)}
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                isActivePack
                                  ? "border-[#6366F1] bg-[#6366F1] text-white shadow-md shadow-indigo-500/20"
                                  : "border-white/[0.1] bg-white/[0.04] text-gray-300 hover:border-white/20 hover:bg-white/[0.08]"
                              }`}
                            >
                              {label} • {when}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePack(project.projectId, pack.generatedAt);
                              }}
                              className="rounded-full border border-white/[0.1] bg-white/[0.04] p-1 text-xs text-gray-400 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                              title="Delete this saved pack"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {!isAuthenticated && concepts.length > 0 && (
              <div className="mb-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#141419]/80 p-5">
                  <p className="text-sm font-medium text-gray-400">
                    CTR analysis available with a free account
                  </p>
                </div>
                <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#141419]/80 p-5">
                  <p className="text-sm font-medium text-gray-400">
                    Top pick available with a free account
                  </p>
                </div>
              </div>
            )}

            {isAuthenticated && concepts.length > 0 && (
              <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[#141419] p-6 shadow-xl shadow-black/30">
                <h3 className="mb-4 text-lg font-semibold text-white">AI Recommendation</h3>
                {!recommendation ? (
                  <p className="text-sm text-gray-400">
                    Recommendation needs to be regenerated after improving variants.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-sm text-gray-300">
                      <span className="font-medium text-[#a5b4fc]">Best Variant:</span>{" "}
                      {recommendation.bestVariantId}
                    </p>
                    <div className="mb-4 text-sm text-gray-300">
                      <p className="font-medium text-white">Explanation</p>
                      <p className="mt-1.5 leading-relaxed text-gray-400">{recommendation.explanation}</p>
                    </div>
                    <div className="mb-4 text-sm text-gray-300">
                      <p className="font-medium text-white">CTR Analysis</p>
                      <p className="mt-1.5 leading-relaxed text-gray-400">{recommendation.ctrReasoning}</p>
                    </div>
                    {recommendation.stressTest && (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-4 py-3 text-sm text-gray-300">
                        <p className="font-medium text-white">Stress Test</p>
                        <p className="mt-2 text-xs font-medium text-gray-500">What could fail:</p>
                        <p className="mt-1 text-gray-400">{recommendation.stressTest.risk}</p>
                        <p className="mt-3 text-xs font-medium text-gray-500">How to improve:</p>
                        <p className="mt-1 text-gray-400">{recommendation.stressTest.improvement}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {isAuthenticated && activeProjectId && comparisonResult && (
              <div className="mb-8 rounded-2xl border border-white/[0.08] bg-[#141419] p-6 shadow-xl shadow-black/30">
                <h3 className="mb-4 text-lg font-semibold text-white">Pack Comparison</h3>
                <p className="mb-2 text-sm text-gray-300">
                  <span className="font-medium text-[#a5b4fc]">Winner:</span>{" "}
                  {(() => {
                    const project = projects.find((p) => p.projectId === activeProjectId);
                    if (!project) return "Unknown pack";
                    const index = project.packs.findIndex(
                      (p) => p.generatedAt === comparisonResult.winnerPackGeneratedAt
                    );
                    return index >= 0 ? `Pack ${index + 1}` : "Unknown pack";
                  })()}
                </p>
                <p className="text-sm leading-relaxed text-gray-400">{comparisonResult.reason}</p>
              </div>
            )}

            {isAuthenticated && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImproveWeakVariants}
                disabled={loading || improvingConceptIds.length > 0}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {improvingConceptIds.length > 0 ? "Improving..." : "Improve Weak Variants"}
              </button>
              {activeProjectId &&
                activePackGeneratedAt &&
                (() => {
                  const project = projects.find((p) => p.projectId === activeProjectId);
                  return project && project.packs.length >= 2;
                })() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const project = projects.find((p) => p.projectId === activeProjectId);
                      if (!project || project.packs.length < 2 || !activePackGeneratedAt) return;
                      const packs = project.packs;
                      const currentIndex = packs.findIndex((p) => p.generatedAt === activePackGeneratedAt);
                      if (currentIndex <= 0) return;
                      const prevPack = packs[currentIndex - 1];
                      const currentPack = packs[currentIndex];

                      const getBest = (pack: SavedPack) => {
                        const rec = pack.data.recommendation;
                        const bestId =
                          rec?.bestVariantId ??
                          pack.data.thumbnails.reduce(
                            (best, t) =>
                              typeof t.score === "number" && t.score > best.score
                                ? { id: t.id, score: t.score }
                                : best,
                            {
                              id: pack.data.thumbnails[0]?.id ?? 1,
                              score: pack.data.thumbnails[0]?.score ?? 0,
                            }
                          ).id;
                        const bestConcept =
                          pack.data.thumbnails.find((t) => t.id === bestId) ?? pack.data.thumbnails[0];
                        return {
                          id: bestConcept.id,
                          strategy: bestConcept.strategy,
                          visualHook: bestConcept.visualHook,
                          overlayText: bestConcept.overlayText,
                          titleSuggestion: bestConcept.titleSuggestion,
                          score: bestConcept.score,
                          titleFitScore: bestConcept.titleFitScore,
                          curiosityScore: bestConcept.curiosityScore,
                          emotionScore: bestConcept.emotionScore,
                          clarityScore: bestConcept.clarityScore,
                          competitionScore: bestConcept.competitionScore,
                        };
                      };

                      try {
                        const response = await fetch("/api/compare-packs", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: project.videoTitle,
                            niche: project.niche,
                            audience: project.audience,
                            packA: { generatedAt: prevPack.generatedAt, best: getBest(prevPack) },
                            packB: { generatedAt: currentPack.generatedAt, best: getBest(currentPack) },
                          }),
                        });

                        if (!response.ok) {
                          setError("Failed to compare packs. Please try again.");
                          return;
                        }

                        const data: PackComparisonResult = await response.json();
                        setComparisonResult(data);
                      } catch (err) {
                        setError("Unable to reach the server. Please try again.");
                      }
                    }}
                    className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    Compare with previous pack
                  </button>
                )}
            </div>
            )}

            {(() => {
              const variantStripExpectedCount =
                conceptsForDisplay.length +
                (!isAuthenticated && concepts.length > 0 ? 3 : 0);
              if (variantStripExpectedCount === 0) return null;
              const stripTotal = variantStripView.total || variantStripExpectedCount || 1;
              const rangeStart =
                variantStripView.total > 0 ? variantStripView.start : 1;
              const rangeEnd =
                variantStripView.total > 0 ? variantStripView.end : Math.min(stripTotal, 3);
              const mobilePositionIndex =
                rangeStart === rangeEnd
                  ? rangeStart
                  : Math.round((rangeStart + rangeEnd) / 2);
              return (
            <div className="mb-0.5 sm:mb-1">
              <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-3">
                <button
                  type="button"
                  aria-label="Scroll variants left"
                  disabled={variantStripView.atStart}
                  onClick={() => scrollVariantStripBy(-1)}
                  className="shrink-0 rounded-md border border-white/[0.12] bg-white/[0.04] p-1 text-gray-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35 sm:rounded-lg sm:p-1.5"
                >
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 18l-6-6 6-6"
                    />
                  </svg>
                </button>
                <div className="min-w-0 flex-1 px-0.5 sm:px-1">
                  {/* Mobile: compact position; desktop: full range */}
                  <div className="flex flex-col items-center gap-0 sm:gap-1">
                    <p className="text-center leading-tight text-gray-200">
                      <span className="inline-flex items-baseline gap-0.5 sm:hidden">
                        <span className="text-[13px] font-semibold tabular-nums tracking-tight text-white">
                          {mobilePositionIndex}
                        </span>
                        <span className="text-[11px] font-medium tabular-nums text-gray-500">
                          /{stripTotal}
                        </span>
                      </span>
                      <span className="hidden text-sm sm:inline">
                        <span className="font-medium tabular-nums">
                          {rangeStart}–{rangeEnd}
                        </span>
                        <span className="text-gray-500"> of </span>
                        <span className="tabular-nums text-gray-400">{stripTotal}</span>
                        <span className="text-gray-500"> visible</span>
                      </span>
                    </p>
                  </div>
                  <div
                    className="mx-auto mt-1 flex max-w-[min(100%,14rem)] gap-px sm:mt-1.5 sm:max-w-xs sm:gap-0.5"
                    role="presentation"
                  >
                    {Array.from({ length: stripTotal }, (_, i) => {
                      const inView =
                        variantStripView.total > 0 &&
                        i >= variantStripView.start - 1 &&
                        i <= variantStripView.end - 1;
                      return (
                        <div
                          key={i}
                          className={`h-1 min-w-[4px] flex-1 rounded-sm transition-[background-color] duration-300 ease-out sm:h-1.5 sm:min-w-[5px] ${
                            inView ? "bg-[#6366F1]/80" : "bg-white/[0.1]"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Scroll variants right"
                  disabled={variantStripView.atEnd}
                  onClick={() => scrollVariantStripBy(1)}
                  className="shrink-0 rounded-md border border-white/[0.12] bg-white/[0.04] p-1 text-gray-200 transition hover:border-white/25 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35 sm:rounded-lg sm:p-1.5"
                >
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 18l6-6-6-6"
                    />
                  </svg>
                </button>
              </div>

            <div className="relative -mx-1 px-1">
              {/* Edge fade — more content remains readable */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[#0B0B0F] via-[#0B0B0F]/50 to-transparent sm:w-8"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[#0B0B0F] via-[#0B0B0F]/50 to-transparent sm:w-8"
                aria-hidden
              />
              <div
                ref={variantScrollRef}
                className="flex flex-nowrap gap-5 overflow-x-auto overflow-y-visible scroll-smooth py-3 pl-1 pr-1 [-webkit-overflow-scrolling:touch] snap-x snap-proximity [scrollbar-width:thin]"
              >
              {conceptsForDisplay.map((concept) => (
                <div
                  data-variant-card
                  key={concept.id}
                  className={`relative rounded-2xl border p-6 ${
                    concept.isTopPick
                      ? "z-10 origin-top bg-[#18181f] md:scale-[1.03] border-[#6366F1]/55 shadow-[0_0_0_1px_rgba(99,102,241,0.4),0_8px_32px_-4px_rgba(99,102,241,0.28),0_28px_64px_-16px_rgba(0,0,0,0.55)]"
                      : "border-white/[0.06] bg-[#121217] opacity-[0.97] shadow-lg shadow-black/35"
                  } w-[min(22rem,calc(100vw-2.5rem))] min-w-[260px] max-w-[22rem] shrink-0 snap-start`}
                >
                  {isAuthenticated && improvingConceptIds.includes(concept.id) && (
                    <div
                      className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm ${
                        concept.isTopPick ? "bg-[#18181f]/92" : "bg-[#121217]/92"
                      }`}
                    >
                      <span className="text-sm font-medium text-gray-300">Regenerating...</span>
                    </div>
                  )}

                  {concept.isTopPick && (
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a5b4fc]/95">
                      Best option
                    </p>
                  )}
                  {isAuthenticated && concept.isTopPick && (
                    <div className="mb-4 inline-flex w-full max-w-full sm:w-auto">
                      <span className="inline-flex items-center rounded-xl bg-[#6366F1]/35 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]">
                        Most likely to win
                      </span>
                    </div>
                  )}

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-1">
                      <p
                        className={`text-sm ${concept.isTopPick ? "text-gray-300" : "text-gray-400"}`}
                      >
                        Strategy
                      </p>
                      <h3
                        className={`text-lg font-bold leading-snug tracking-tight sm:text-xl ${concept.isTopPick ? "text-white" : "text-gray-100"}`}
                      >
                        {concept.strategy}
                      </h3>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                          concept.isTopPick
                            ? "border-white/[0.1] bg-transparent text-gray-400"
                            : "border-white/[0.08] bg-transparent text-gray-500"
                        }`}
                      >
                        Variant {concept.id}
                      </span>
                      {isAuthenticated && typeof concept.score === "number" && (
                        <div className="pt-0.5">
                          <p className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-gray-500">
                            CTR
                          </p>
                          <div className="flex items-baseline justify-end gap-0.5 leading-none">
                            <span
                              className={`tabular-nums font-bold ${
                                concept.isTopPick
                                  ? "text-[1.35rem] text-[#e0e7ff] sm:text-2xl"
                                  : "text-lg font-semibold text-gray-200"
                              }`}
                            >
                              {formatCtrScore(concept.score)}
                            </span>
                            <span
                              className={`tabular-nums font-medium ${
                                concept.isTopPick
                                  ? "text-sm text-gray-400"
                                  : "text-xs text-gray-500"
                              }`}
                            >
                              /10
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {isAuthenticated && (
                  <p className="mb-2 text-xs font-medium text-gray-400">
                    {concept.isImageLoading
                      ? "Rendering visual..."
                      : concept.imageUrl
                        ? "Generated image ✓"
                        : "No image yet"}
                  </p>
                  )}
                  {isAuthenticated && concept.isImageLoading && (
                    <p className="mb-2 text-[11px] text-gray-500">
                      This can take up to 45 seconds
                    </p>
                  )}

                  {/* Fixed-height preview slot — avoids layout shift when images load */}
                  {isAuthenticated && (
                    <div className="relative mb-4 h-40 w-full shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0B0B0F]">
                      {concept.isImageLoading && (
                        <div
                          className="absolute inset-0 animate-pulse bg-white/[0.08]"
                          aria-hidden
                        />
                      )}
                      {!concept.isImageLoading && concept.imageUrl && (
                        <img
                          src={concept.imageUrl}
                          alt={concept.strategy}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      {!concept.isImageLoading && !concept.imageUrl && (
                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-gray-500">
                          No preview yet
                        </div>
                      )}
                    </div>
                  )}

                  {isAuthenticated && concept.imageUrl && !concept.isImageLoading && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-gray-400">Visibility Test</p>
                      <div className="flex flex-wrap gap-3">
                        <div className="overflow-hidden rounded-lg border border-white/[0.1]">
                          <img
                            src={concept.imageUrl}
                            alt={`${concept.strategy} at 120px`}
                            className="h-[68px] w-[120px] object-cover"
                          />
                          <p className="border-t border-white/[0.06] bg-[#0B0B0F] px-2 py-1 text-[10px] text-gray-400">
                            120px (mobile)
                          </p>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-white/[0.1]">
                          <img
                            src={concept.imageUrl}
                            alt={`${concept.strategy} at 180px`}
                            className="h-[101px] w-[180px] object-cover"
                          />
                          <p className="border-t border-white/[0.06] bg-[#0B0B0F] px-2 py-1 text-[10px] text-gray-400">
                            180px (suggested)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-5 rounded-xl border border-white/[0.08] bg-[#0B0B0F] p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Overlay text</p>
                    <p className="mt-2 text-2xl font-bold text-white">{concept.overlayText}</p>
                  </div>

                  <div className="space-y-4 text-sm text-gray-300">
                    <div>
                      <p className="font-medium text-white">Composition</p>
                      <p className="mt-1 leading-relaxed text-gray-400">{concept.composition}</p>
                    </div>
                    <div>
                      <p className="font-medium text-white">Emotion</p>
                      <p className="mt-1 leading-relaxed text-gray-400">{concept.emotion}</p>
                    </div>
                    <div>
                      <p className="font-medium text-white">Colors</p>
                      <p className="mt-1 leading-relaxed text-gray-400">{concept.colors}</p>
                    </div>

                    {(concept.titleSuggestion ||
                      concept.titleReason ||
                      typeof concept.titleFitScore === "number") && (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-4 py-3 text-sm text-gray-300">
                        {concept.titleSuggestion && (
                          <>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Suggested Title
                            </p>
                            <p className="mt-1 font-medium text-white">{concept.titleSuggestion}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (concept.titleSuggestion) {
                                  navigator.clipboard.writeText(concept.titleSuggestion);
                                  setCopiedTitleId(concept.id);
                                  setTimeout(() => setCopiedTitleId(null), 1500);
                                }
                              }}
                              className="mt-2 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-xs font-medium text-gray-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                            >
                              {copiedTitleId === concept.id ? "Copied ✓" : "Copy title"}
                            </button>
                          </>
                        )}
                        {concept.titleReason && (
                          <>
                            <p className="mt-2 text-xs font-medium text-gray-500">Why this title works</p>
                            <p className="mt-0.5 text-gray-400">{concept.titleReason}</p>
                          </>
                        )}
                        {isAuthenticated && typeof concept.titleFitScore === "number" && (
                          <p className="mt-2 text-xs text-gray-400">
                            Title Fit: {concept.titleFitScore}/10
                          </p>
                        )}
                      </div>
                    )}

                    {concept.scoreReason && (
                      <div>
                        <p className="font-medium text-white">Why this could work</p>
                        <p className="mt-1 text-gray-400">{concept.scoreReason}</p>
                      </div>
                    )}

                    {isAuthenticated && (typeof concept.curiosityScore === "number" ||
                      typeof concept.emotionScore === "number" ||
                      typeof concept.clarityScore === "number" ||
                      typeof concept.competitionScore === "number") && (
                      <div className="rounded-xl border border-white/[0.08] bg-[#0B0B0F] px-4 py-3 text-xs text-gray-400">
                        <p className="mb-2 font-medium text-gray-300">CTR Breakdown</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                          {typeof concept.curiosityScore === "number" && (
                            <span>Curiosity: {concept.curiosityScore}/10</span>
                          )}
                          {typeof concept.emotionScore === "number" && (
                            <span>Emotion: {concept.emotionScore}/10</span>
                          )}
                          {typeof concept.clarityScore === "number" && (
                            <span>Visual Clarity: {concept.clarityScore}/10</span>
                          )}
                          {typeof concept.competitionScore === "number" && (
                            <span>Competition: {concept.competitionScore}/10</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {isAuthenticated && concept.imageError && (
                    <p className="mt-3 text-xs text-red-400">
                      {concept.imageError}
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(buildConceptIdeaText(concept));
                        setCopiedIdeaId(concept.id);
                        setTimeout(() => setCopiedIdeaId(null), 1500);
                      }}
                      className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      {copiedIdeaId === concept.id ? "Copied ✓" : "Copy idea"}
                    </button>
                    {isAuthenticated && credits > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(buildImagePrompt(concept));
                        setCopiedPromptId(concept.id);
                        setTimeout(() => setCopiedPromptId(null), 1500);
                      }}
                      className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      {copiedPromptId === concept.id ? "Copied prompt ✓" : "Copy image prompt"}
                    </button>
                    )}
                    {isAuthenticated && credits <= 0 && (
                      <div className="rounded-xl border border-white/[0.1] bg-[#0B0B0F] px-4 py-3">
                        <p className="text-sm font-medium text-gray-300">Out of credits</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          You&apos;ve used all your free image credits.
                        </p>
                        <p className="mt-1 text-xs text-gray-500">More credits coming soon.</p>
                      </div>
                    )}
                    {isAuthenticated && credits > 0 && (
                    <button
                      className="rounded-xl bg-[#6366F1] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleGenerateImage(concept.id)}
                      disabled={concept.isImageLoading}
                    >
                      {concept.isImageLoading
                        ? "Generating..."
                        : concept.imageUrl
                          ? "Regenerate image"
                          : "Generate image"}
                    </button>
                    )}
                    {!isAuthenticated && (
                      <div className="flex flex-col gap-1">
                        <span className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-center text-sm font-medium text-gray-500">
                          Generate image
                        </span>
                        <p className="text-xs text-gray-500">Sign up to unlock</p>
                      </div>
                    )}
                    {isAuthenticated && concept.imageUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(concept.imageUrl!, concept.id)}
                        className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-gray-200 hover:border-white/20 hover:bg-white/[0.08]"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!isAuthenticated && concepts.length > 0 &&
                [1, 2, 3].map((i) => (
                  <div
                    data-variant-card
                    key={`locked-${i}`}
                    className="relative w-[min(22rem,calc(100vw-2.5rem))] min-w-[260px] max-w-[22rem] shrink-0 snap-start rounded-2xl border border-dashed border-white/[0.12] bg-[#141419]/60 p-5 opacity-95"
                  >
                    <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                      <p className="text-sm font-semibold text-gray-400">Locked concept</p>
                      <p className="text-xs text-gray-500">Sign up to unlock</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            );
            })()}

            {/* Guest upsell: unlock full pack */}
            {!isAuthenticated && concepts.length > 0 && (
              <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#141419] p-8 shadow-xl shadow-black/30">
                <h3 className="text-lg font-semibold text-white">Unlock the full CTR pack</h3>
                <p className="mt-3 text-sm text-gray-400">
                  Create a free account to unlock:
                </p>
                <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-gray-400">
                  <li>all 5 concepts</li>
                  <li>CTR analysis</li>
                  <li>top pick</li>
                  <li>image generation</li>
                  <li>saved projects</li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/sign-up"
                    className="rounded-xl bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110"
                  >
                    Create free account
                  </Link>
                  <Link
                    href="/sign-in"
                    className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

