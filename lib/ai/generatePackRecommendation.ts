import { getOpenAIClient } from "./client";
import type { Recommendation, StressTest, ThumbnailConcept } from "./types";
import { pickTopVariantId } from "./pickTopVariantId";

/**
 * Generates a fresh AI recommendation (and stress test) for an existing pack.
 * Intended for post-edit flows like "Improve Weak Variants" so recommendation
 * stays in sync with updated concepts.
 */
export async function generatePackRecommendation(params: {
  title: string;
  niche: string;
  audience: string;
  thumbnails: ThumbnailConcept[];
}): Promise<Recommendation | null> {
  const { title, niche, audience, thumbnails } = params;
  const openai = getOpenAIClient();

  const bestVariantId = pickTopVariantId(thumbnails);
  if (typeof bestVariantId !== "number") return null;
  const best = thumbnails.find((t) => t.id === bestVariantId);
  if (!best) return null;

  const summary = thumbnails.map((t) => ({
    id: t.id,
    strategy: t.strategy,
    visualHook: t.visualHook,
    overlayText: t.overlayText,
    score: t.score,
    curiosityScore: t.curiosityScore,
    emotionScore: t.emotionScore,
    clarityScore: t.clarityScore,
    competitionScore: t.competitionScore,
    titleSuggestion: t.titleSuggestion,
    titleFitScore: t.titleFitScore,
  }));

  const recCompletion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an experienced YouTube thumbnail strategist giving advice to a creator. " +
          "Explain your recommendation in natural, human language—like a growth expert talking to a friend. " +
          "Return strict JSON only. Do not sound analytical or robotic.",
      },
      {
        role: "user",
        content: `Video: "${title}". Niche: "${niche}". Audience: "${audience}".

Here are the 5 thumbnail concepts:

${JSON.stringify(summary, null, 2)}

The winning variant has already been chosen by the product using a deterministic rule (highest CTR score, tie-break by lowest id).
Your job is to explain WHY this chosen winner is strong for CTR in plain language a creator would understand.

Chosen winner: Variant ${bestVariantId}

Winner details:
- Strategy: ${best.strategy}
- Visual hook: ${best.visualHook ?? "—"}
- Overlay text idea: ${best.overlayText}
- Composition: ${best.composition}
- Emotion: ${best.emotion}
- Colors: ${best.colors}
- Title suggestion: ${best.titleSuggestion ?? "—"}

Return JSON:
{
  "explanation": "2-3 sentences in a natural, human tone. Say why this concept grabs attention and why viewers would want to click—like you're advising a creator, not writing a report.",
  "ctrReasoning": "Short, practical note: what grabs attention, why it makes people curious or emotional, how the thumbnail and title work together, and why it stands out in this niche. Use simple, clear language. No jargon or numbers."
}

Rules:
- Do NOT choose a different variant. Do NOT output any variant id.
- explanation: 2-3 sentences, natural and creator-friendly. Do NOT reference numeric scores or numbers like (8/10).
- ctrReasoning: simple, clear, practical. Do NOT mention scores or internal metrics. Do NOT wrap the JSON in backticks.`,
      },
    ],
  });

  const recRaw = recCompletion.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(recRaw) as Pick<Recommendation, "explanation" | "ctrReasoning">;
    if (!parsed.explanation || !parsed.ctrReasoning) return null;

    const rec: Recommendation = {
      bestVariantId,
      explanation: parsed.explanation,
      ctrReasoning: parsed.ctrReasoning,
    };

    const stressCompletion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an experienced YouTube thumbnail strategist. " +
            "Give creators practical, human advice. Return strict JSON only. Do not mention scores or metrics.",
        },
        {
          role: "user",
          content: `Video: "${title}". Niche: "${niche}". Audience: "${audience}".

This is the recommended thumbnail concept (locked winner):
- Variant: ${bestVariantId}
- Strategy: ${best.strategy}
- Visual hook: ${best.visualHook ?? "—"}
- Overlay text idea: ${best.overlayText}
- Composition: ${best.composition}
- Emotion: ${best.emotion}
- Colors: ${best.colors}
- Title suggestion: ${best.titleSuggestion ?? "—"}

Run a quick stress test: what could make this thumbnail underperform, and how could the creator improve it before using it?

Return JSON:
{
  "risk": "1-2 sentences: what could make this thumbnail underperform. Natural, creator-friendly language. No scores.",
  "improvement": "1-2 sentences: specific, practical suggestion to improve it. Natural language."
}

Rules: risk and improvement must be concise, practical, and human. Do NOT wrap in backticks.`,
        },
      ],
    });

    const stressRaw = stressCompletion.choices[0]?.message?.content ?? "";
    try {
      const stressParsed = JSON.parse(stressRaw) as StressTest;
      if (stressParsed.risk && stressParsed.improvement) {
        rec.stressTest = stressParsed;
      }
    } catch {
      console.warn("[generatePackRecommendation] Could not parse stress test:", stressRaw);
    }

    return rec;
  } catch {
    console.warn("[generatePackRecommendation] Could not parse recommendation:", recRaw);
    return null;
  }
}

