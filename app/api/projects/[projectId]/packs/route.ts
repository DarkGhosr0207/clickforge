import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deletePackForUser } from "@/lib/projects";

/**
 * DELETE /api/projects/[projectId]/packs?generatedAt=...
 * Deletes one pack (and its concepts) for the authenticated user.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const generatedAt = request.nextUrl.searchParams.get("generatedAt");
  if (!projectId || !generatedAt) {
    return NextResponse.json(
      { error: "Missing projectId or generatedAt" },
      { status: 400 }
    );
  }

  try {
    const projects = await deletePackForUser(userId, projectId, generatedAt);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[DELETE /api/projects/.../packs]", err);
    return NextResponse.json(
      { error: "Failed to delete pack" },
      { status: 500 }
    );
  }
}
