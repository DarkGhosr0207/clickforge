import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { updateConceptImageForUser } from "@/lib/projects";

/**
 * PATCH /api/projects/packs/concept-image
 * Updates one concept's imageUrl. Body: { projectId, packGeneratedAt, conceptIndex, imageUrl }
 */
export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      projectId?: string;
      packGeneratedAt?: string;
      conceptIndex?: number;
      imageUrl?: string;
    };
    const { projectId, packGeneratedAt, conceptIndex, imageUrl } = body;
    if (
      !projectId ||
      packGeneratedAt == null ||
      conceptIndex == null ||
      typeof imageUrl !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, packGeneratedAt, conceptIndex, imageUrl" },
        { status: 400 }
      );
    }

    await updateConceptImageForUser(
      userId,
      projectId,
      packGeneratedAt,
      conceptIndex,
      imageUrl
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/projects/packs/concept-image]", err);
    return NextResponse.json(
      { error: "Failed to update concept image" },
      { status: 500 }
    );
  }
}
