// Shared TypeScript types for AI-related data.
// Keeping these in one place makes it easier to reuse them.

// A single thumbnail concept used across the app
export type ThumbnailConcept = {
  id: number;
  strategy: string;
  overlayText: string;
  composition: string;
  emotion: string;
  colors: string;
  // Optional generated image URL (persisted per concept)
  imageUrl?: string;
  // Optional CTR score (1–10) estimating how strong this concept is
  score?: number;
  // Short explanation of why this concept may perform well
  scoreReason?: string;
  // Short phrase describing the single strongest visual element
  // Example: "chef holding a sushi roll", "split screen beginner vs pro"
  visualHook?: string;
  // CTR breakdown: 1–10 scores for key factors
  curiosityScore?: number;
  emotionScore?: number;
  clarityScore?: number;
  competitionScore?: number;
  // Title suggestion for full packaging (thumbnail + title)
  titleSuggestion?: string;
  titleReason?: string;
  titleFitScore?: number;
};

// Stress test: what could make the best thumbnail underperform and how to improve
export type StressTest = {
  risk: string;
  improvement: string;
};

// AI recommendation for which variant to use
export type Recommendation = {
  bestVariantId: number;
  explanation: string;
  ctrReasoning: string;
  stressTest?: StressTest;
};

// The full response shape returned by the CTR pack API
export type GeneratePackResponse = {
  thumbnails: ThumbnailConcept[];
  title: string;
  niche: string;
  audience: string;
  recommendation?: Recommendation;
};

// Result of comparing two packs' recommended variants
export type PackComparisonResult = {
  winnerPackGeneratedAt: string;
  reason: string;
};

// Request body for generating an image from a thumbnail concept
export type GenerateImageRequestBody = {
  // High-level video context to guide the image
  title?: string;
  niche?: string;
  audience?: string;
  // Concept-level fields
  strategy?: string;
  visualHook?: string;
  overlayText?: string;
  composition?: string;
  emotion?: string;
  colors?: string;
};

// Response body returned by the image API
export type GenerateImageResponseBody = {
  imageUrl: string;
};

