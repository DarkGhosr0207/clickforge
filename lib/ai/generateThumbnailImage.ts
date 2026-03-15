import { getOpenAIClient } from "./client";
import type {
  GenerateImageRequestBody,
  GenerateImageResponseBody,
} from "./types";

// This function contains the AI logic for generating a thumbnail-style image.
// It takes the descriptive fields and returns a single image URL.
export async function generateThumbnailImage(
  body: GenerateImageRequestBody
): Promise<GenerateImageResponseBody> {
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

  const openai = getOpenAIClient();

  // Build a rich prompt that uses both video-level context (title, niche, audience)
  // and concept-level details (strategy, visualHook, composition, emotion, colors).
  const prompt = `
You are generating a YouTube thumbnail image (no text rendered in the image).

Video title: ${title ?? "Untitled video"}
Niche: ${niche ?? "general"}
Audience: ${audience ?? "broad"}

Thumbnail strategy: ${strategy ?? "unspecified"}
Strongest visual hook: ${visualHook ?? "unspecified"}
Suggested overlay text idea (for context only, do NOT render this as text): ${overlayText ?? "unspecified"}
Composition notes: ${composition ?? "unspecified"}
Target emotion: ${emotion ?? "unspecified"}
Color palette: ${colors ?? "unspecified"}

Image goals:
- It should clearly look like a modern YouTube thumbnail, not a generic stock photo.
- Strong focal point and clear subject that is readable at small size.
- Prefer a human subject or strong emotional element when appropriate for the niche.
- Keep the scene tightly aligned with the niche and visualHook (no random or unrelated objects).

Visual style rules:
- cinematic composition
- dramatic lighting
- high contrast
- click-worthy thumbnail style

Critical constraints:
- Do NOT render any text in the image (no words, no logos, no UI).
- Do NOT include YouTube UI elements (no play button, no progress bar, no YouTube chrome).
- Do NOT include unrelated or random objects that do not match the niche and concept.
`;

  const imageResult = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    // Square is a good default and keeps things fast for the MVP.
    // The frontend will frame/crop as needed.
    size: "1024x1024",
  });

  const imageBase64 = imageResult.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI did not return image data");
  }

  return {
    imageUrl: `data:image/png;base64,${imageBase64}`,
  };
}

