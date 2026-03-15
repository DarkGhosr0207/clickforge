"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import localforage from "localforage";

// Configure IndexedDB/localForage for project storage once at module load.
if (typeof window !== "undefined") {
  localforage.config({
    name: "ctr-pack-generator",
    storeName: "projects",
  });
}
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

  // Load credits from localforage on first render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const stored = await localforage.getItem<number>("ctrCredits");
        if (typeof stored === "number") {
          setCredits(stored);
        }
      } catch (err) {
        console.error("Failed to load credits from localforage:", err);
      }
      setHasLoadedCredits(true);
    })();
  }, []);

  // Persist credits to localforage whenever they change (after initial load).
  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedCredits) return;
    (async () => {
      try {
        await localforage.setItem("ctrCredits", credits);
      } catch (err) {
        console.error("Failed to persist credits to localforage:", err);
      }
    })();
  }, [credits, hasLoadedCredits]);

  // Load projects from IndexedDB via localforage on first render.
  // Also perform a one-time migration from localStorage if needed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        let stored = await localforage.getItem<Project[]>("ctrProjects");

        // Optional migration: if IndexedDB is empty but localStorage has data,
        // move it into localforage and then clear localStorage.
        if (!stored) {
          const raw = window.localStorage.getItem("ctrProjects");
          if (raw) {
            try {
              const fromLocal = JSON.parse(raw) as Project[];
              stored = fromLocal;
              await localforage.setItem("ctrProjects", fromLocal);
              window.localStorage.removeItem("ctrProjects");
            } catch (err) {
              console.error("Failed to migrate ctrProjects from localStorage:", err);
            }
          }
        }

        if (stored) {
          setProjects(stored);
        }
      } catch (err) {
        console.error("Failed to load projects from localforage:", err);
        setProjects([]);
      }
      // Mark that the initial load attempt has completed (success or failure)
      setHasLoadedProjects(true);
    })();
  }, []);

  // Persist projects to IndexedDB whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Avoid overwriting existing stored data with an empty array
    // before the initial load has completed.
    if (!hasLoadedProjects) return;
    (async () => {
      try {
        await localforage.setItem("ctrProjects", projects);
      } catch (err) {
        // If storage fails, log but don't crash the app.
        console.error("Failed to persist projects to localforage:", err);
      }
    })();
  }, [projects, hasLoadedProjects]);

  // Find the highest CTR score so we can highlight a "Top Pick".
  const maxScore =
    concepts.length > 0
      ? concepts.reduce((highest, concept) => {
          if (typeof concept.score === "number") {
            return concept.score > highest ? concept.score : highest;
          }
          return highest;
        }, 0)
      : 0;

  // This function will generate an image for a single concept (card)
  const handleGenerateImage = async (conceptId: number) => {
    if (credits <= 0) {
      setImageCreditError("No image credits left.");
      return;
    }

    // Find the index of the concept we want to update
    const index = concepts.findIndex((concept) => concept.id === conceptId);
    if (index === -1) return;

    setImageCreditError(null);

    // Clear any previous image error for this concept
    const updatedConcepts = [...concepts];
    updatedConcepts[index] = {
      ...updatedConcepts[index],
      imageError: null,
      isImageLoading: true,
    };
    setConcepts(updatedConcepts);

    const concept = updatedConcepts[index];

    try {
      // Send a POST request to the image generation API
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // High-level video context
          title: videoTitle,
          niche,
          audience,
          // Concept-level details
          strategy: concept.strategy,
          visualHook: concept.visualHook,
          overlayText: concept.overlayText,
          composition: concept.composition,
          emotion: concept.emotion,
          colors: concept.colors,
        }),
      });

      if (!response.ok) {
        // If the response is not OK, show a simple error on this card
        const conceptsWithError = [...updatedConcepts];
        conceptsWithError[index] = {
          ...conceptsWithError[index],
          imageError: "Failed to generate image. Please try again.",
          isImageLoading: false,
        };
        setConcepts(conceptsWithError);
        return;
      }

      // Read the JSON body from the response
      const data: { imageUrl: string } = await response.json();

      // Update this specific concept with the new image URL (for UI only)
      const conceptsWithImage = [...updatedConcepts];
      conceptsWithImage[index] = {
        ...conceptsWithImage[index],
        imageUrl: data.imageUrl,
        isImageLoading: false,
      };
      setConcepts(conceptsWithImage);
      setCredits((c) => c - 1);

      // Also persist the image URL into the appropriate pack of the current project
      // so that refreshing the page or switching packs keeps this image.
      setProjects((prev) => {
        if (prev.length === 0) return prev;

        // Try to find the active project first; if not available, match by title/niche/audience.
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

        const nextProjects = prev.map((project) => {
          if (project.projectId !== projectToUpdate.projectId) return project;
          if (project.packs.length === 0) return project;

          const packs = [...project.packs];

          // Prefer the currently active pack; if not found, fall back to the latest pack.
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

          return {
            ...project,
            packs,
          };
        });
        return nextProjects;
      });
    } catch (err) {
      // Handle network errors or unexpected problems
      const conceptsWithError = [...updatedConcepts];
      conceptsWithError[index] = {
        ...conceptsWithError[index],
        imageError: "Unable to reach the server. Please try again.",
        isImageLoading: false,
      };
      setConcepts(conceptsWithError);
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
      setConcepts((prev) =>
        prev.map((c) => {
          const replacement = data.thumbnails.find((t) => t.id === c.id);
          if (replacement) {
            return { ...replacement, imageUrl: c.imageUrl, isImageLoading: c.isImageLoading, imageError: c.imageError };
          }
          return c;
        })
      );
    } catch (err) {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setImprovingConceptIds([]);
    }
  };

  // Helper to select a project and load its latest pack
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

    const latestPack = project.packs[project.packs.length - 1];
    if (latestPack) {
      setConcepts(latestPack.data.thumbnails);
      setRecommendation(latestPack.data.recommendation ?? null);
      setActivePackGeneratedAt(latestPack.generatedAt);
      setComparisonResult(null);
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

  const handleDownloadImage = (url: string, id: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `thumbnail-variant-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        `CTR Score: ${typeof c.score === "number" ? c.score : "—"}/10`,
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
      `CTR Score: ${typeof concept.score === "number" ? `${concept.score}/10` : "—/10"}`,
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
      setConcepts(data.thumbnails);
      setRecommendation(data.recommendation ?? null);
      setComparisonResult(null);

      // Save this pack into the projects history
      const now = new Date().toISOString();
      setProjects((prev) => {
        // Decide which project to attach this pack to:
        // - If there is an active project AND the form still matches its core fields,
        //   reuse that project.
        // - Otherwise, try to find another project with matching title/niche/audience.
        // - If none exists, create a new project.
        let project: Project | undefined;

        if (activeProjectId) {
          const activeProject = prev.find((p) => p.projectId === activeProjectId);
          if (
            activeProject &&
            activeProject.videoTitle === videoTitle &&
            activeProject.niche === niche &&
            activeProject.audience === audience
          ) {
            project = activeProject;
          }
        }

        if (!project) {
          project = prev.find(
            (p) =>
              p.videoTitle === videoTitle &&
              p.niche === niche &&
              p.audience === audience
          );
        }

        if (!project) {
          // Create a new project
          const projectId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const newProject: Project = {
            projectId,
            videoTitle,
            niche,
            audience,
            createdAt: now,
            lastUpdatedAt: now,
            packs: [
              {
                generatedAt: now,
                data,
              },
            ],
          };
          setActiveProjectId(projectId);
          setActivePackGeneratedAt(now);
          return [...prev, newProject];
        }

        // Append a new pack to the existing project
        const updatedProjects = prev.map((p) => {
          if (p.projectId !== project!.projectId) return p;
          return {
            ...p,
            lastUpdatedAt: now,
            packs: [
              ...p.packs,
              {
                generatedAt: now,
                data,
              },
            ],
          };
        });
        setActiveProjectId(project.projectId);
        setActivePackGeneratedAt(now);
        return updatedProjects;
      });
    } catch (err) {
      // This catches network errors or other unexpected problems
      setError("Unable to reach the server. Please check your connection and try again.");
    } finally {
      // No matter what happens above, we stop the loading state here
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-10 text-gray-900">
      <div className="mx-auto max-w-6xl">
        {/* Entry header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-4xl font-bold tracking-tight">ClickForge</h1>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition">
                Home
              </Link>
              <span className="text-sm font-medium text-gray-600">Credits left: {credits}</span>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            Generate strategic YouTube thumbnail concepts designed to improve click-through rate.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveProjectId(null);
                setActivePackGeneratedAt(null);
                setConcepts([]);
                setRecommendation(null);
                setComparisonResult(null);
                setError(null);
                generatorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-2xl bg-black px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Start New Pack
            </button>
            <button
              type="button"
              onClick={() => {
                projectsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="rounded-2xl border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Continue Project
            </button>
          </div>
        </div>

        {/* Home mode: projects + generator when no project is active */}
        {activeProjectId === null && (
          <>
            {/* Projects history */}
            <div ref={projectsRef} className="mb-8">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">Your Projects</h2>
              {projects.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No projects yet. Generate a CTR pack to create your first project.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {projects.map((project) => {
                    const packCount = project.packs.length;
                    const lastUpdated = new Date(project.lastUpdatedAt).toLocaleString();
                    const isActive = project.projectId === activeProjectId;
                    return (
                      <button
                        key={project.projectId}
                        type="button"
                        onClick={() => handleSelectProject(project.projectId)}
                        className={`min-w-[220px] rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          isActive
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                        }`}
                      >
                        <p className="truncate font-semibold">
                          {project.videoTitle || "Untitled project"}
                        </p>
                        <p className={`mt-1 text-xs ${isActive ? "text-gray-200" : "text-gray-500"}`}>
                          {project.niche} • {project.audience}
                        </p>
                        <p className={`mt-1 text-xs ${isActive ? "text-gray-200" : "text-gray-500"}`}>
                          {packCount} pack{packCount === 1 ? "" : "s"} • Last updated {lastUpdated}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Generator form */}
            <div
              ref={generatorRef}
              className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium">Video title</label>
                  <input
                    type="text"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                    placeholder="e.g. I opened a sushi bar in Barcelona"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Niche</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g. restaurant, business, sports, travel"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">Audience</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. food lovers, entrepreneurs, beginners"
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-black"
                  />
                </div>
              </div>

              {/* Quick example prompts */}
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-gray-500">Try an example:</p>
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
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
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
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
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
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
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
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Living in Bali for a month
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Generating..." : "Generate CTR Pack"}
                </button>
              </div>

              {error && (
                <p className="mt-4 text-sm text-red-600">
                  {error}
                </p>
              )}
            </div>
          </>
        )}

        {/* Workspace mode content when concepts exist */}
        {concepts.length > 0 && (
          <div>
            {/* Active project header and workspace controls */}
            {activeProjectId &&
              (() => {
                const project = projects.find((p) => p.projectId === activeProjectId);
                if (!project) return null;
                return (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-700">
                      Project:{" "}
                      <span className="font-semibold text-gray-900">
                        {project.videoTitle || "Untitled project"}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Generate New Pack
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingQuery((prev) => !prev)}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
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
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        New Project
                      </button>
                    </div>
                  </div>
                );
              })()}

            {/* Inline query editor for the active project */}
            {activeProjectId &&
              isEditingQuery &&
              (() => {
                const project = projects.find((p) => p.projectId === activeProjectId);
                if (!project) return null;
                return (
                  <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
                    <p className="mb-2 font-medium text-gray-900">Edit query</p>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block font-medium">Video title</label>
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
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium">Niche</label>
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
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium">Audience</label>
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
                          className="w-full rounded-xl border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

            <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-2xl font-semibold">Thumbnail Concepts</h2>
              <div className="flex items-center gap-3">
                {concepts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(buildAllConceptsText());
                      setCopiedAllConcepts(true);
                      setTimeout(() => setCopiedAllConcepts(false), 1500);
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copiedAllConcepts ? "Copied ✓" : "Copy all concepts"}
                  </button>
                )}
                <p className="text-sm text-gray-500">{concepts.length} variants generated</p>
              </div>
            </div>

            {/* Saved packs for the active project */}
            {activeProjectId && (
              <div className="mb-4">
                <p className="mb-1 text-sm font-medium text-gray-900">Saved Packs</p>
                {(() => {
                  const project = projects.find((p) => p.projectId === activeProjectId);
                  if (!project || project.packs.length === 0) {
                    return (
                      <p className="text-xs text-gray-500">
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
                          <button
                            key={pack.generatedAt}
                            type="button"
                            onClick={() => handleSelectPack(pack.generatedAt)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                              isActivePack
                                ? "border-black bg-black text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {label} • {when}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {recommendation && (
              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">AI Recommendation</h3>
                <p className="mb-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Best Variant:</span>{" "}
                  {recommendation.bestVariantId}
                </p>
                <div className="mb-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">Explanation</p>
                  <p className="mt-1">{recommendation.explanation}</p>
                </div>
                <div className="mb-3 text-sm text-gray-700">
                  <p className="font-medium text-gray-900">CTR Analysis</p>
                  <p className="mt-1">{recommendation.ctrReasoning}</p>
                </div>
                {recommendation.stressTest && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">Stress Test</p>
                    <p className="mt-1.5 text-xs font-medium text-gray-600">What could fail:</p>
                    <p className="mt-0.5">{recommendation.stressTest.risk}</p>
                    <p className="mt-2 text-xs font-medium text-gray-600">How to improve:</p>
                    <p className="mt-0.5">{recommendation.stressTest.improvement}</p>
                  </div>
                )}
              </div>
            )}

            {activeProjectId && comparisonResult && (
              <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Pack Comparison</h3>
                <p className="mb-2 text-sm text-gray-700">
                  <span className="font-medium text-gray-900">Winner:</span>{" "}
                  {(() => {
                    const project = projects.find((p) => p.projectId === activeProjectId);
                    if (!project) return "Unknown pack";
                    const index = project.packs.findIndex(
                      (p) => p.generatedAt === comparisonResult.winnerPackGeneratedAt
                    );
                    return index >= 0 ? `Pack ${index + 1}` : "Unknown pack";
                  })()}
                </p>
                <p className="text-sm text-gray-700">{comparisonResult.reason}</p>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImproveWeakVariants}
                disabled={loading || improvingConceptIds.length > 0}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Compare with previous pack
                  </button>
                )}
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {concepts.map((concept) => (
                <div
                  key={concept.id}
                  className="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  {improvingConceptIds.includes(concept.id) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80">
                      <span className="text-sm font-medium text-gray-600">Regenerating...</span>
                    </div>
                  )}

                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Strategy</p>
                      <h3 className="text-xl font-semibold">{concept.strategy}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-600">
                        Variant {concept.id}
                      </span>
                      {typeof concept.score === "number" && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700">
                          CTR Score: {concept.score} / 10
                        </span>
                      )}
                      {typeof concept.score === "number" &&
                        concept.score === maxScore &&
                        maxScore > 0 && (
                          <span className="mt-1 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-900">
                            🏆 Top Pick
                          </span>
                        )}
                    </div>
                  </div>

                  <p className="mb-2 text-xs font-medium text-gray-600">
                    {concept.isImageLoading
                      ? "Rendering visual..."
                      : concept.imageUrl
                        ? "Generated image ✓"
                        : "No image yet"}
                  </p>
                  {concept.isImageLoading && (
                    <p className="mb-2 text-[11px] text-gray-500">
                      This can take up to 45 seconds
                    </p>
                  )}

                  {concept.isImageLoading && (
                    <div
                      className="mb-4 h-40 w-full animate-pulse rounded-xl border border-gray-200 bg-gray-200"
                      aria-hidden
                    />
                  )}

                  {concept.imageUrl && !concept.isImageLoading && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200">
                      <img
                        src={concept.imageUrl}
                        alt={concept.strategy}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  )}

                  {concept.imageUrl && !concept.isImageLoading && (
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-gray-600">Visibility Test</p>
                      <div className="flex flex-wrap gap-3">
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <img
                            src={concept.imageUrl}
                            alt={`${concept.strategy} at 120px`}
                            className="h-[68px] w-[120px] object-cover"
                          />
                          <p className="border-t border-gray-100 bg-gray-50 px-2 py-1 text-[10px] text-gray-500">120px (mobile)</p>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <img
                            src={concept.imageUrl}
                            alt={`${concept.strategy} at 180px`}
                            className="h-[101px] w-[180px] object-cover"
                          />
                          <p className="border-t border-gray-100 bg-gray-50 px-2 py-1 text-[10px] text-gray-500">180px (suggested)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-4 rounded-xl bg-gray-100 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Overlay text</p>
                    <p className="mt-2 text-2xl font-bold">{concept.overlayText}</p>
                  </div>

                  <div className="space-y-3 text-sm text-gray-700">
                    <div>
                      <p className="font-medium text-gray-900">Composition</p>
                      <p>{concept.composition}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Emotion</p>
                      <p>{concept.emotion}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Colors</p>
                      <p>{concept.colors}</p>
                    </div>

                    {(concept.titleSuggestion ||
                      concept.titleReason ||
                      typeof concept.titleFitScore === "number") && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {concept.titleSuggestion && (
                          <>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                              Suggested Title
                            </p>
                            <p className="mt-1 font-medium text-gray-900">{concept.titleSuggestion}</p>
                            <button
                              type="button"
                              onClick={() => {
                                if (concept.titleSuggestion) {
                                  navigator.clipboard.writeText(concept.titleSuggestion);
                                  setCopiedTitleId(concept.id);
                                  setTimeout(() => setCopiedTitleId(null), 1500);
                                }
                              }}
                              className="mt-2 rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium hover:bg-gray-50 transition"
                            >
                              {copiedTitleId === concept.id ? "Copied ✓" : "Copy title"}
                            </button>
                          </>
                        )}
                        {concept.titleReason && (
                          <>
                            <p className="mt-2 text-xs font-medium text-gray-600">Why this title works</p>
                            <p className="mt-0.5 text-gray-700">{concept.titleReason}</p>
                          </>
                        )}
                        {typeof concept.titleFitScore === "number" && (
                          <p className="mt-2 text-xs text-gray-600">
                            Title Fit: {concept.titleFitScore}/10
                          </p>
                        )}
                      </div>
                    )}

                    {concept.scoreReason && (
                      <div>
                        <p className="font-medium text-gray-900">Why this could work</p>
                        <p className="text-gray-700">{concept.scoreReason}</p>
                      </div>
                    )}

                    {(typeof concept.curiosityScore === "number" ||
                      typeof concept.emotionScore === "number" ||
                      typeof concept.clarityScore === "number" ||
                      typeof concept.competitionScore === "number") && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                        <p className="mb-1.5 font-medium text-gray-700">CTR Breakdown</p>
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

                  {concept.imageError && (
                    <p className="mt-3 text-xs text-red-600">
                      {concept.imageError}
                    </p>
                  )}

                  {credits <= 0 && (
                    <p className="mt-2 text-xs text-red-600">
                      No image credits left
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(buildConceptIdeaText(concept));
                        setCopiedIdeaId(concept.id);
                        setTimeout(() => setCopiedIdeaId(null), 1500);
                      }}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      {copiedIdeaId === concept.id ? "Copied ✓" : "Copy idea"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(buildImagePrompt(concept));
                        setCopiedPromptId(concept.id);
                        setTimeout(() => setCopiedPromptId(null), 1500);
                      }}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      {copiedPromptId === concept.id ? "Copied prompt ✓" : "Copy image prompt"}
                    </button>
                    <button
                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleGenerateImage(concept.id)}
                      disabled={credits <= 0 || concept.isImageLoading}
                    >
                      {concept.isImageLoading
                        ? "Generating..."
                        : concept.imageUrl
                          ? "Regenerate image"
                          : "Generate image"}
                    </button>
                    {concept.imageUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(concept.imageUrl!, concept.id)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

