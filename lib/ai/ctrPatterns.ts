// Simple library of CTR patterns for YouTube long-form thumbnails.
// Keeping this small and explicit makes it easy to tweak later.

export type CTRPattern = {
  id: string;
  name: string;
  description: string;
  // Which types of videos this pattern is especially good for
  bestFor: string[];
  // Platforms where this pattern works well (we start with YouTube long-form)
  platforms: string[];
};

export const CTR_PATTERNS: CTRPattern[] = [
  {
    id: "before-after",
    name: "Before / After Transformation",
    description:
      "Shows a clear visual change or transformation, usually with a split screen or side-by-side comparison.",
    bestFor: ["fitness", "makeover", "restaurants", "business case study", "education", "lifestyle"],
    platforms: ["youtube-longform"],
  },
  {
    id: "emotional-reaction",
    name: "Strong Emotional Reaction",
    description:
      "Close-up of a human face with a strong emotion (shock, joy, fear, frustration) reacting to the situation.",
    bestFor: ["sports", "challenge", "food", "travel", "lifestyle", "tech"],
    platforms: ["youtube-longform"],
  },
  {
    id: "curiosity-gap",
    name: "Curiosity Gap / Mystery",
    description:
      "Hints at something surprising or unexpected without fully revealing it, making viewers curious to click.",
    bestFor: ["business", "education", "money", "lifestyle", "travel"],
    platforms: ["youtube-longform"],
  },
  {
    id: "premium-beauty-shot",
    name: "Premium Beauty Shot",
    description:
      "High-quality, aesthetic hero shot of the core subject (food, product, location) with cinematic lighting.",
    bestFor: ["restaurants", "food", "travel", "product reviews", "design", "lifestyle"],
    platforms: ["youtube-longform"],
  },
  {
    id: "tension-risk",
    name: "Tension / Risk / Problem",
    description:
      "Shows a stressful or risky moment, clearly visualizing the problem or stakes the video will resolve.",
    bestFor: ["business", "entrepreneurship", "sports", "finance", "education", "coding"],
    platforms: ["youtube-longform"],
  },
  {
    id: "authority-expertise",
    name: "Authority / Expertise",
    description:
      "Positions the creator or subject as an expert or mentor, often with confident posture and clear symbols of authority.",
    bestFor: ["business", "education", "fitness coaching", "career advice", "tech", "productivity"],
    platforms: ["youtube-longform"],
  },
];

