import type { GenerateImageRequestBody } from "./types";

const MODERATION_REPLACEMENTS: [RegExp, string][] = [
  [/\btension\b/gi, "dramatic contrast"],
  [/\brisk\b/gi, "bold challenge"],
  [/\bstress\b/gi, "intense focus"],
  [/\bfear\b/gi, "wide-eyed surprise"],
  [/\bdanger\b/gi, "urgent situation"],
  [/\bpanic\b/gi, "extreme surprise"],
  [/\bshock\b/gi, "amazement"],
  [/\bdisbelief\b/gi, "astonishment"],
  [/\bhorror\b/gi, "extreme surprise"],
  [/\bterror\b/gi, "extreme surprise"],
  [/\bthreat\b/gi, "bold challenge"],
  [/\bviolen(t|ce)\b/gi, "intense"],
  [/\bdead(ly)?\b/gi, "extreme"],
  [/\bfail(ure|ed|ing)?\b/gi, "unexpected outcome"],
  [/\bcrash\b/gi, "sudden change"],
  [/\bdisaster\b/gi, "unexpected challenge"],
];

function sanitizeForModeration(text: string): string {
  let result = text;
  for (const [pattern, replacement] of MODERATION_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Reusable prompt template for highly clickable YouTube thumbnail image generation.
 * Emphasizes human-first composition, strong emotions, tight framing, and
 * thumbnail readability while avoiding stock-photo and object-only looks.
 */
export function buildThumbnailImagePrompt(body: GenerateImageRequestBody): string {
  const {
    title,
    niche,
    audience,
    strategy,
    visualHook,
    overlayText,
    composition,
    emotion,
    colors,
  } = body;

  const focalIdea = sanitizeForModeration(visualHook?.trim() || strategy?.trim() || "the main idea");
  const mood = sanitizeForModeration(emotion?.trim() || "engaged and curious");
  const colorNote = sanitizeForModeration(colors?.trim() || "vibrant, high-contrast");
  const compositionNote = sanitizeForModeration(composition?.trim() || "clear and dynamic");
  const overlayIdea = sanitizeForModeration(overlayText?.trim() ?? "");
  const safeTitle = sanitizeForModeration(title ?? "Untitled");
  const safeNiche = sanitizeForModeration(niche ?? "general");

  const sceneParts: string[] = [
    `Video context: "${safeTitle}" for niche "${safeNiche}", audience "${audience ?? "broad"}".`,
    `Core idea: ${focalIdea}.`,
    `Mood / reaction to convey: ${mood}.`,
    `Composition note: ${compositionNote}.`,
    `Colors: ${colorNote}.`,
  ];
  if (overlayIdea) {
    sceneParts.push(`Overlay text idea for context only (do NOT draw or render any text in the image): "${overlayIdea}".`);
  }

  const sceneDescription = sceneParts.join(" ");

  return `Create a highly clickable YouTube thumbnail image. Do NOT render any text, logos, or UI in the image.

Scene:
${sceneDescription}

YouTube Thumbnail Composition Rules:
- One dominant human subject reacting to the situation (prefer a person; avoid object-only or empty scenes).
- Exaggerated emotional facial expression (e.g. excitement, amazement, astonishment, curiosity) typical of popular YouTube thumbnails.
- Large, readable face; the subject's face should occupy a significant part of the frame.
- Single clear focal point; the subject is immediately understandable.
- Tight framing or close-up (or medium close-up); avoid wide or distant shots.
- Simple, uncluttered background that does not compete with the subject.
- Strong contrast lighting and color so the subject stands out and reads at very small size.
- Dynamic and engaging composition; the image must remain clear and understandable at mobile thumbnail size.

Reaction Amplification:
The subject's emotional reaction should be intentionally exaggerated and expressive, similar to popular YouTube thumbnails. The face and expression are the main hook.

Avoid:
- Object-only thumbnails (e.g. just a coffee cup, empty room, or product with no person).
- Empty or generic environments.
- Wide cinematic shots where the face is small or unclear.
- Generic stock-photo look or corporate headshot style.
- Multiple competing focal points or busy, cluttered scenes.`;
}
