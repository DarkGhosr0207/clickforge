import type { ThumbnailConcept } from "./types";

/**
 * Deterministic winner selection (source of truth for Top Pick + Recommendation):
 * - highest score wins
 * - tie-break by lowest variant id
 */
export function pickTopVariantId(thumbnails: Array<Pick<ThumbnailConcept, "id" | "score">>): number | null {
  let best: { id: number; score: number } | null = null;
  for (const t of thumbnails) {
    if (typeof t.score !== "number") continue;
    if (!best || t.score > best.score || (t.score === best.score && t.id < best.id)) {
      best = { id: t.id, score: t.score };
    }
  }
  return best?.id ?? null;
}

