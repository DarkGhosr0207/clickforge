import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type DodoWebhookPayload = {
  type?: unknown;
  data?: {
    metadata?: {
      clerkUserId?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[POST /api/dodo/webhook] Failed to read body", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let payload: DodoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as DodoWebhookPayload;
  } catch (err) {
    console.error("[POST /api/dodo/webhook] Invalid JSON", err);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload?.type !== "payment.succeeded") {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const clerkUserId = payload.data?.metadata?.clerkUserId;
  if (typeof clerkUserId !== "string" || clerkUserId.trim().length === 0) {
    console.warn("[POST /api/dodo/webhook] Missing clerkUserId in metadata", {
      metadata: payload.data?.metadata,
    });
    return NextResponse.json(
      { error: "Missing clerkUserId" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { clerkUserId },
      data: { credits: { increment: 100 } },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/dodo/webhook] Prisma error", err);
    return NextResponse.json(
      { error: "Failed to update credits" },
      { status: 500 }
    );
  }
}

