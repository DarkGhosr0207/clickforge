import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteProjectForUser } from "@/lib/projects";

/**
 * DELETE /api/projects/[projectId]
 * Deletes the project and all its packs/concepts for the authenticated user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const projects = await deleteProjectForUser(userId, projectId);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("[DELETE /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
