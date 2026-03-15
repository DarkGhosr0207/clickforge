/**
 * Runway image provider for thumbnail generation.
 *
 * EVALUATION-ONLY: Runway output URLs may expire after 24–48 hours. Saved project
 * history that stores these URLs can break when they expire. Use this provider
 * for testing/comparison only until durable storage (e.g. fetching and storing
 * the image bytes or uploading to your own CDN) is implemented.
 */

import { buildThumbnailImagePrompt } from "./thumbnailImagePrompt";
import type {
  GenerateImageRequestBody,
  GenerateImageResponseBody,
} from "./types";

const RUNWAY_BASE = "https://api.dev.runwayml.com/v1";
const RUNWAY_VERSION = "2024-11-06";

/** 16:9 thumbnail-friendly ratio; matches common YouTube thumbnail dimensions. */
const THUMBNAIL_RATIO = "1280:720";

/**
 * We use gen4_image (not turbo) and omit referenceImages for pure text-to-image.
 * Runway's API docs list referenceImages as required for some models; if the API
 * rejects requests without references, we would need to add a single reference
 * and document that it can bias outputs (see REFERENCE_IMAGE_BIAS note below).
 */
const RUNWAY_MODEL = "gen4_image";

// Only use if Runway API requires referenceImages (can bias or distort results):
// const PLACEHOLDER_REFERENCE_URI =
//   "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function createTextToImageTask(promptText: string): Promise<string> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is not set");
  }

  const body: {
    model: string;
    promptText: string;
    ratio: string;
    referenceImages?: Array<{ uri: string; tag: string }>;
  } = {
    model: RUNWAY_MODEL,
    promptText: promptText.slice(0, 1000),
    ratio: THUMBNAIL_RATIO,
  };

  // REFERENCE_IMAGE_BIAS: Runway's docs mark referenceImages as required for
  // some models. We omit them for unbiased text-to-image. If the API returns
  // a validation error requiring referenceImages, uncomment PLACEHOLDER_REFERENCE_URI
  // above and: body.referenceImages = [{ uri: PLACEHOLDER_REFERENCE_URI, tag: "ref" }];
  // Using a placeholder can bias or distort outputs; document that if you enable it.

  const res = await fetch(`${RUNWAY_BASE}/text_to_image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Runway text_to_image failed: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  if (!data?.id) {
    throw new Error("Runway did not return a task id");
  }
  return data.id;
}

async function pollTaskUntilDone(taskId: string): Promise<string[]> {
  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY is not set");
  }

  const maxAttempts = 60;
  const intervalMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${RUNWAY_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });

    if (!res.ok) {
      throw new Error(`Runway tasks fetch failed: ${res.status}`);
    }

    const task = (await res.json()) as {
      status?: string;
      output?: string[];
    };

    if (task.status === "SUCCEEDED" && Array.isArray(task.output) && task.output.length > 0) {
      return task.output;
    }
    if (task.status === "FAILED" || task.status === "CANCELED") {
      throw new Error(`Runway task ${task.status}`);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Runway task timed out");
}

/**
 * Generate a thumbnail image using Runway's text_to_image API (evaluation-only).
 * Uses the same prompt shape as the OpenAI provider and returns { imageUrl }.
 * Note: imageUrl is an ephemeral Runway URL; it may expire in 24–48 hours.
 */
export async function generateThumbnailImageRunway(
  body: GenerateImageRequestBody
): Promise<GenerateImageResponseBody> {
  const promptText = buildThumbnailImagePrompt(body);
  const taskId = await createTextToImageTask(promptText);
  const outputUrls = await pollTaskUntilDone(taskId);
  const imageUrl = outputUrls[0];
  if (!imageUrl) {
    throw new Error("Runway did not return an image URL");
  }
  return { imageUrl };
}
