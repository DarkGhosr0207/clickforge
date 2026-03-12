"use client";

import { useEffect, useState } from "react";
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

  // Load projects from localStorage on first render
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("ctrProjects");
      if (raw) {
        const parsed = JSON.parse(raw) as Project[];
        setProjects(parsed);
      }
    } catch {
      // Ignore parsing errors and start fresh
      setProjects([]);
    }
  }, []);

  // Persist projects whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("ctrProjects", JSON.stringify(projects));
    } catch {
      // Ignore write errors for now
    }
  }, [projects]);

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
    // Find the index of the concept we want to update
    const index = concepts.findIndex((concept) => concept.id === conceptId);
    if (index === -1) return;

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

      // Update this specific concept with the new image URL
      const conceptsWithImage = [...updatedConcepts];
      conceptsWithImage[index] = {
        ...conceptsWithImage[index],
        imageUrl: data.imageUrl,
        isImageLoading: false,
      };
      setConcepts(conceptsWithImage);

      // Also persist the image URL into the currently active pack of the active project
      // so that refreshing the page or switching packs keeps this image.
      setProjects((prev) => {
        // If we don't know which project or pack is active, just keep state as-is.
        if (!activeProjectId || !activePackGeneratedAt) return prev;

        return prev.map((project) => {
          if (project.projectId !== activeProjectId) return project;
          if (project.packs.length === 0) return project;

          const packs = [...project.packs];
          const packIndex = packs.findIndex(
            (p) => p.generatedAt === activePackGeneratedAt
          );
          if (packIndex === -1) return project;

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
        // Try to use an existing active project, or match by title/niche/audience
        let project = activeProjectId
          ? prev.find((p) => p.projectId === activeProjectId)
          : prev.find(
              (p) =>
                p.videoTitle === videoTitle &&
                p.niche === niche &&
                p.audience === audience
            );

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
        {/* Projects history */}
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">Projects</h2>
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

        <div className="mb-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            MVP Prototype
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            CTR Pack Generator
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-gray-600">
            Generate strategic YouTube thumbnail concepts and visuals designed to improve click-through rate.
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

          {/* Quick example prompts to make it easier to try the app */}
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

          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate CTR Pack"}
            </button>
          </div>

          {/* Show a friendly error message if something goes wrong */}
          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {concepts.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Thumbnail Concepts</h2>
              <p className="text-sm text-gray-500">{concepts.length} variants generated</p>
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
                        const label = `Pack ${index + 1}`;
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
                  <span className="font-medium text-gray-900">Best Variant:</span> {recommendation.bestVariantId}
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

            {/* Pack comparison */}
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
              {activeProjectId && activePackGeneratedAt && (() => {
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
                          { id: pack.data.thumbnails[0]?.id ?? 1, score: pack.data.thumbnails[0]?.score ?? 0 }
                        ).id;
                      const bestConcept = pack.data.thumbnails.find((t) => t.id === bestId) ?? pack.data.thumbnails[0];
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
                      {/* Small badge for CTR score, if available */}
                      {typeof concept.score === "number" && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-[11px] font-medium text-green-700">
                          CTR Score: {concept.score} / 10
                        </span>
                      )}
                      {/* Highlight the highest-scoring concept as the top pick */}
                      {typeof concept.score === "number" &&
                        concept.score === maxScore &&
                        maxScore > 0 && (
                          <span className="mt-1 rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-900">
                            🏆 Top Pick
                          </span>
                        )}
                    </div>
                  </div>

                  {/* If we have an image URL, show the generated image */}
                  {concept.imageUrl && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-gray-200">
                      <img
                        src={concept.imageUrl}
                        alt={concept.strategy}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="mb-4 rounded-xl bg-gray-100 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Overlay text
                    </p>
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
                    {/* Title suggestion for full packaging */}
                    {(concept.titleSuggestion || concept.titleReason || typeof concept.titleFitScore === "number") && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {concept.titleSuggestion && (
                          <>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Suggested Title</p>
                            <p className="mt-1 font-medium text-gray-900">{concept.titleSuggestion}</p>
                          </>
                        )}
                        {concept.titleReason && (
                          <>
                            <p className="mt-2 text-xs font-medium text-gray-600">Why this title works</p>
                            <p className="mt-0.5 text-gray-700">{concept.titleReason}</p>
                          </>
                        )}
                        {typeof concept.titleFitScore === "number" && (
                          <p className="mt-2 text-xs text-gray-600">Title Fit: {concept.titleFitScore}/10</p>
                        )}
                      </div>
                    )}
                    {/* Short explanation of why this concept may perform well */}
                    {concept.scoreReason && (
                      <div>
                        <p className="font-medium text-gray-900">Why this could work</p>
                        <p className="text-gray-700">{concept.scoreReason}</p>
                      </div>
                    )}
                    {/* CTR breakdown: show only when at least one score is present */}
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

                  {/* Per-card error message for image generation */}
                  {concept.imageError && (
                    <p className="mt-3 text-xs text-red-600">
                      {concept.imageError}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
                      Copy idea
                    </button>
                    <button
                      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => handleGenerateImage(concept.id)}
                      disabled={concept.isImageLoading}
                    >
                      {concept.isImageLoading ? "Generating..." : "Generate image"}
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

