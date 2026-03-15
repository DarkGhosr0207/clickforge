import { generateThumbnailImage as generateThumbnailImageOpenAI } from "./generateThumbnailImage";
import { generateThumbnailImageRunway } from "./generateThumbnailImageRunway";
import type {
  GenerateImageRequestBody,
  GenerateImageResponseBody,
} from "./types";

const PROVIDER_OPENAI = "openai";
const PROVIDER_RUNWAY = "runway";

/**
 * Selects the image provider from env and calls it.
 * Default/fallback: OpenAI. Use IMAGE_PROVIDER=runway to use Runway.
 */
export async function generateThumbnailImageWithProvider(
  body: GenerateImageRequestBody
): Promise<GenerateImageResponseBody> {
  const envProvider = (process.env.IMAGE_PROVIDER ?? "").toLowerCase().trim();
  const useRunway =
    envProvider === PROVIDER_RUNWAY && !!process.env.RUNWAY_API_KEY;

  if (useRunway) {
    console.log("[image generation] provider: runway");
    return generateThumbnailImageRunway(body);
  }

  console.log("[image generation] provider: openai");
  return generateThumbnailImageOpenAI(body);
}
