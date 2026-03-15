import { getOpenAIClient } from "./client";
import type { GeneratePackResponse, Recommendation, StressTest } from "./types";
import { CTR_PATTERNS } from "./ctrPatterns";

// Weights for computing final CTR score from breakdown.
const SCORE_WEIGHTS = {
  curiosity: 0.35,
  emotion: 0.25,
  clarity: 0.25,
  competition: 0.15,
};

function computeScoreFromBreakdown(t: {
  curiosityScore?: number;
  emotionScore?: number;
  clarityScore?: number;
  competitionScore?: number;
}): number {
  const c = typeof t.curiosityScore === "number" ? t.curiosityScore : 0;
  const e = typeof t.emotionScore === "number" ? t.emotionScore : 0;
  const cl = typeof t.clarityScore === "number" ? t.clarityScore : 0;
  const co = typeof t.competitionScore === "number" ? t.competitionScore : 0;
  const finalScore =
    SCORE_WEIGHTS.curiosity * c +
    SCORE_WEIGHTS.emotion * e +
    SCORE_WEIGHTS.clarity * cl +
    SCORE_WEIGHTS.competition * co;
  return Math.round(finalScore * 10) / 10;
}

// This function contains the AI logic for generating a CTR thumbnail pack.
// The API route can call this function to keep the route itself nice and small.
export async function generateThumbnailPack(params: {
  title: string;
  niche: string;
  audience: string;
}): Promise<GeneratePackResponse> {
  const { title, niche, audience } = params;

  const openai = getOpenAIClient();

  // Lightweight logging so we can see what kind of requests
  // are flowing through this helper in the terminal.
  console.log("[generateThumbnailPack] title:", title);
  console.log("[generateThumbnailPack] niche:", niche);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert YouTube packaging strategist. " +
          "You understand many niches (sports, restaurants, food, business, travel, fitness, education, lifestyle, and more) " +
          "and how to design thumbnails that maximize click-through rate. " +
          "You must return strict JSON only.",
      },
      {
        role: "user",
        content: `You are given a small CTR pattern library for YouTube long-form thumbnails:

${JSON.stringify(CTR_PATTERNS, null, 2)}

Step 1: Infer the likely video intent and what the viewer cares about most from this input.

Title: "${title}"
Niche: "${niche}"
Audience: "${audience}"

Step 2: From the CTR pattern library above, choose the most relevant patterns for this video.
- Focus on patterns where the "bestFor" niche list overlaps with this video's niche or intent.
- When possible, map each of the 5 concepts to a different CTR pattern so the set feels diverse.

Step 3: Decide the 5 strongest and clearly different thumbnail angles for CTR
based on the chosen patterns. Make sure they are meaningfully different, not tiny variations.

Step 4: For each of the 5 thumbnails, define:
- strategy (one clear CTR strategy name)
- overlayText (short, punchy, human-sounding phrase – the creator will design this later)
- composition (where the subject is, camera angle, layout)
- emotion (what the viewer should feel)
- colors (1–3 key colors)
- visualHook (the single strongest visual element that makes this thumbnail stand out)
- scoreReason (short explanation why this concept might perform well)
- curiosityScore (1–10): how strongly the thumbnail creates a curiosity gap
- emotionScore (1–10): how strong the emotional reaction could be
- clarityScore (1–10): how clear and understandable the thumbnail is at small size
- competitionScore (1–10): how well the concept stands out compared to typical thumbnails in this niche
- titleSuggestion: a YouTube long-form title that fits this concept’s strategy, visualHook, and audience intent; human-sounding, clickable, not overly long; avoid generic AI-sounding titles
- titleReason: short explanation why this title and thumbnail work together as a packaging pair
- titleFitScore (1–10): how well the title and thumbnail work together for CTR

Return JSON:
{
 "thumbnails":[
  {
    "id":1,
    "strategy":"",
    "overlayText":"",
    "composition":"",
    "emotion":"",
    "colors":"",
    "visualHook":"",
    "scoreReason": "",
    "curiosityScore": 0,
    "emotionScore": 0,
    "clarityScore": 0,
    "competitionScore": 0,
    "titleSuggestion": "",
    "titleReason": "",
    "titleFitScore": 0
  },
  {
    "id":2,
    "strategy":"",
    "overlayText":"",
    "composition":"",
    "emotion":"",
    "colors":"",
    "visualHook":"",
    "scoreReason": "",
    "curiosityScore": 0,
    "emotionScore": 0,
    "clarityScore": 0,
    "competitionScore": 0,
    "titleSuggestion": "",
    "titleReason": "",
    "titleFitScore": 0
  },
  {
    "id":3,
    "strategy":"",
    "overlayText":"",
    "composition":"",
    "emotion":"",
    "colors":"",
    "visualHook":"",
    "scoreReason": "",
    "curiosityScore": 0,
    "emotionScore": 0,
    "clarityScore": 0,
    "competitionScore": 0,
    "titleSuggestion": "",
    "titleReason": "",
    "titleFitScore": 0
  },
  {
    "id":4,
    "strategy":"",
    "overlayText":"",
    "composition":"",
    "emotion":"",
    "colors":"",
    "visualHook":"",
    "scoreReason": "",
    "curiosityScore": 0,
    "emotionScore": 0,
    "clarityScore": 0,
    "competitionScore": 0,
    "titleSuggestion": "",
    "titleReason": "",
    "titleFitScore": 0
  },
  {
    "id":5,
    "strategy":"",
    "overlayText":"",
    "composition":"",
    "emotion":"",
    "colors":"",
    "visualHook":"",
    "scoreReason": "",
    "curiosityScore": 0,
    "emotionScore": 0,
    "clarityScore": 0,
    "competitionScore": 0,
    "titleSuggestion": "",
    "titleReason": "",
    "titleFitScore": 0
  }
 ],
 "title":"${title}",
 "niche":"${niche}",
 "audience":"${audience}"
}

Rules:
- "thumbnails" must contain exactly 5 items.
- The 5 concepts must be clearly different in strategy and visualHook, not tiny variations.
- "scoreReason" must briefly explain why this concept fits this specific request (title, niche, audience), not just why it is good in general.
- For each thumbnail, include curiosityScore, emotionScore, clarityScore, and competitionScore (each 1–10, numbers only). Do NOT include "score"; it will be computed from these.
- For each thumbnail, include titleSuggestion (string), titleReason (string), and titleFitScore (1–10, number). The title should be optimized for YouTube long-form CTR and fit the concept’s strategy and audience; keep it human-sounding and clickable.
- "visualHook" must clearly describe the single strongest visual element (e.g. "stressed owner in empty restaurant", "chef holding a sushi roll", "split screen beginner vs pro").
- Overlay text should usually be short and natural; avoid awkward AI-sounding phrases.
- Do NOT make every concept look like a transformation thumbnail unless the request strongly suggests transformation.
- Do NOT include any extra top-level fields.
- Do NOT wrap the JSON in backticks.`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  console.log("Raw model output:", rawContent);

  const parsed = JSON.parse(rawContent) as GeneratePackResponse;

  // Compute final CTR score from breakdown scores (model no longer outputs score).
  parsed.thumbnails = parsed.thumbnails.map((t) => ({
    ...t,
    score: computeScoreFromBreakdown(t),
  }));

  // Ask the model to recommend the best variant based on the pack.
  const summary = parsed.thumbnails.map((t) => ({
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

Pick the single best variant for YouTube long-form CTR, then explain your choice in plain language a creator would understand.

Return JSON:
{
  "bestVariantId": number,
  "explanation": "2-3 sentences in a natural, human tone. Say why this concept grabs attention and why viewers would want to click—like you're advising a creator, not writing a report.",
  "ctrReasoning": "Short, practical note: what grabs attention, why it makes people curious or emotional, how the thumbnail and title work together, and why it stands out in this niche. Use simple, clear language. No jargon or numbers."
}

Rules:
- bestVariantId must be one of the concept ids (1, 2, 3, 4, or 5).
- explanation: 2-3 sentences, natural and creator-friendly. Do NOT reference numeric scores, curiosityScore, emotionScore, clarityScore, competitionScore, or numbers like (8/10). Focus on what grabs attention, why viewers feel curious or emotional, how thumbnail and title work together, why it stands out in the niche.
- ctrReasoning: simple, clear, practical—something a creator gets instantly. Do NOT mention scores or internal metrics. Do NOT say things like 'balances high curiosity and emotion' or 'scores well on clarity'. Sound like a human strategist, not an AI.
- Do NOT wrap the JSON in backticks.`,
      },
    ],
  });

  const recRaw = recCompletion.choices[0]?.message?.content ?? "";
  try {
    const recParsed = JSON.parse(recRaw) as Recommendation;
    if (typeof recParsed.bestVariantId === "number" && recParsed.explanation && recParsed.ctrReasoning) {
      parsed.recommendation = recParsed;

      // Stress test: analyze the best variant for potential weaknesses and improvements.
      const best = parsed.thumbnails.find((t) => t.id === recParsed.bestVariantId);
      if (best) {
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

This is the recommended thumbnail concept:
- Strategy: ${best.strategy}
- Visual hook: ${best.visualHook ?? "—"}
- Overlay text idea: ${best.overlayText}
- Composition: ${best.composition}
- Emotion: ${best.emotion}
- Colors: ${best.colors}
- Title suggestion: ${best.titleSuggestion ?? "—"}

Run a quick stress test: what could make this thumbnail underperform, and how could the creator improve it before using it?

Think about realistic issues: weak emotional impact, too much text, unclear visual hook, poor clarity at small size, concept too generic for the niche, weak title-thumbnail alignment. Give one practical risk and one practical improvement.

Return JSON:
{
  "risk": "1-2 sentences: what could make this thumbnail underperform. Natural, creator-friendly language. No scores.",
  "improvement": "1-2 sentences: specific, practical suggestion to improve it. Natural language."
}

Rules: risk and improvement must be 1-2 sentences each, concise, human, and practical. Do NOT reference internal scores or metrics. Do NOT wrap in backticks.`,
            },
          ],
        });

        const stressRaw = stressCompletion.choices[0]?.message?.content ?? "";
        try {
          const stressParsed = JSON.parse(stressRaw) as StressTest;
          if (stressParsed.risk && stressParsed.improvement) {
            parsed.recommendation.stressTest = stressParsed;
          }
        } catch {
          console.warn("[generateThumbnailPack] Could not parse stress test:", stressRaw);
        }
      }
    }
  } catch {
    console.warn("[generateThumbnailPack] Could not parse recommendation:", recRaw);
  }

  return parsed;
}

/** Regenerate the two given (weak) concepts with stronger alternatives. Returns 2 concepts with same structure and computed score. */
export async function improveThumbnailConcepts(params: {
  title: string;
  niche: string;
  audience: string;
  conceptsToImprove: Array<{
    id: number;
    strategy: string;
    visualHook?: string;
    overlayText: string;
    composition: string;
    emotion: string;
    colors: string;
    score?: number;
  }>;
}): Promise<{ thumbnails: GeneratePackResponse["thumbnails"] }> {
  const { title, niche, audience, conceptsToImprove } = params;
  if (conceptsToImprove.length !== 2) {
    throw new Error("improveThumbnailConcepts requires exactly 2 concepts");
  }

  const openai = getOpenAIClient();
  const [a, b] = conceptsToImprove;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert YouTube packaging strategist. Return strict JSON only. " +
          "Generate stronger replacement concepts for weak thumbnails in a pack.",
      },
      {
        role: "user",
        content: `You have a YouTube thumbnail pack for this video:

Title: "${title}"
Niche: "${niche}"
Audience: "${audience}"

These two concepts scored low. Generate 2 replacement concepts that are stronger for CTR, still fit the video, and use different strategies from each other.

Weak concept 1 (id ${a.id}, score ${a.score ?? "?"}): strategy "${a.strategy}", visualHook "${a.visualHook ?? ""}", overlayText "${a.overlayText}", composition "${a.composition}", emotion "${a.emotion}", colors "${a.colors}"

Weak concept 2 (id ${b.id}, score ${b.score ?? "?"}): strategy "${b.strategy}", visualHook "${b.visualHook ?? ""}", overlayText "${b.overlayText}", composition "${b.composition}", emotion "${b.emotion}", colors "${b.colors}"

Use the same CTR pattern library ideas (before/after, emotional reaction, curiosity gap, premium beauty, tension/risk, authority). Return exactly 2 thumbnails with the same structure. Keep id as ${a.id} for the first and ${b.id} for the second. Do NOT include "score"; it will be computed.

Return JSON:
{
  "thumbnails": [
    {
      "id": ${a.id},
      "strategy": "",
      "overlayText": "",
      "composition": "",
      "emotion": "",
      "colors": "",
      "visualHook": "",
      "scoreReason": "",
      "curiosityScore": 0,
      "emotionScore": 0,
      "clarityScore": 0,
      "competitionScore": 0,
      "titleSuggestion": "",
      "titleReason": "",
      "titleFitScore": 0
    },
    {
      "id": ${b.id},
      "strategy": "",
      "overlayText": "",
      "composition": "",
      "emotion": "",
      "colors": "",
      "visualHook": "",
      "scoreReason": "",
      "curiosityScore": 0,
      "emotionScore": 0,
      "clarityScore": 0,
      "competitionScore": 0,
      "titleSuggestion": "",
      "titleReason": "",
      "titleFitScore": 0
    }
  ]
}

Rules: thumbnails array must have exactly 2 items. Same field rules as a full pack (curiosityScore, emotionScore, clarityScore, competitionScore 1–10; titleSuggestion, titleReason, titleFitScore). Do NOT include "score". Do NOT wrap in backticks.`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  console.log("[improveThumbnailConcepts] raw output:", rawContent);

  const parsed = JSON.parse(rawContent) as { thumbnails: GeneratePackResponse["thumbnails"] };
  parsed.thumbnails = parsed.thumbnails.map((t) => ({
    ...t,
    score: computeScoreFromBreakdown(t),
  }));
  return parsed;
}

