import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type BestSummary = {
  id: number;
  strategy?: string;
  visualHook?: string;
  overlayText?: string;
  titleSuggestion?: string;
  score?: number;
  titleFitScore?: number;
  curiosityScore?: number;
  emotionScore?: number;
  clarityScore?: number;
  competitionScore?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      niche?: string;
      audience?: string;
      packA?: { generatedAt: string; best: BestSummary };
      packB?: { generatedAt: string; best: BestSummary };
    };

    const { title, niche, audience, packA, packB } = body;

    if (!title || !niche || !audience || !packA || !packB) {
      return NextResponse.json(
        { error: "Missing required fields for comparison." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an experienced YouTube thumbnail strategist. " +
            "Compare two thumbnail + title packaging ideas and tell a creator which one is stronger. " +
            "Speak in natural, human language and return strict JSON only.",
        },
        {
          role: "user",
          content: `Video: "${title}". Niche: "${niche}". Audience: "${audience}".

Pack A (generatedAt: ${packA.generatedAt}):
${JSON.stringify(packA.best, null, 2)}

Pack B (generatedAt: ${packB.generatedAt}):
${JSON.stringify(packB.best, null, 2)}

Look at the strategy, visual hook, overlay text idea, title suggestion, and the overall feel.
Ignore any numeric scores. Think like a creator: which top pick would you actually publish as a thumbnail for this video?

Return JSON:
{
  "winnerPackGeneratedAt": "the generatedAt string of the stronger pack (either "${packA.generatedAt}" or "${packB.generatedAt}")",
  "reason": "short, creator-friendly explanation (2-3 sentences) of which top pick is stronger and why. Focus on attention, curiosity, emotion, clarity, and title-thumbnail fit, without mentioning scores or metrics."
}

Rules:
- winnerPackGeneratedAt must be exactly one of the two generatedAt strings above.
- Do NOT mention scores, metrics, or numeric breakdowns.
- Use simple, clear language as if talking directly to a YouTube creator.
- Do NOT wrap the JSON in backticks.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(raw) as {
        winnerPackGeneratedAt: string;
        reason: string;
      };

      if (
        (parsed.winnerPackGeneratedAt === packA.generatedAt ||
          parsed.winnerPackGeneratedAt === packB.generatedAt) &&
        parsed.reason
      ) {
        return NextResponse.json(parsed);
      }
    } catch {
      // fall through to error below
    }

    return NextResponse.json(
      { error: "Failed to compare packs." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Error in /api/compare-packs:", error);
    return NextResponse.json(
      { error: "Failed to compare packs." },
      { status: 500 }
    );
  }
}

