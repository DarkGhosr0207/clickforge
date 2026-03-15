import { getOpenAIClient } from "./client";
import { buildThumbnailImagePrompt } from "./thumbnailImagePrompt";
import type {
  GenerateImageRequestBody,
  GenerateImageResponseBody,
} from "./types";

// This function contains the AI logic for generating a thumbnail-style image.
// It takes the descriptive fields and returns a single image URL.
export async function generateThumbnailImage(
  body: GenerateImageRequestBody
): Promise<GenerateImageResponseBody> {
  const openai = getOpenAIClient();
  const prompt = buildThumbnailImagePrompt(body);

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

