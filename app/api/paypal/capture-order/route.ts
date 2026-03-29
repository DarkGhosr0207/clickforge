import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const PAYPAL_BASE = "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal token error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("PayPal token response missing access_token");
  }
  return data.access_token;
}

/**
 * POST /api/paypal/capture-order
 * Captures a PayPal order and credits the user with 100 credits.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    console.error("[POST /api/paypal/capture-order] invalid JSON", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orderID =
    body !== null &&
    typeof body === "object" &&
    "orderID" in body &&
    typeof (body as { orderID: unknown }).orderID === "string"
      ? (body as { orderID: string }).orderID.trim()
      : undefined;

  if (!orderID) {
    return NextResponse.json({ error: "Missing orderID" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getPayPalAccessToken();
  } catch (err) {
    console.error("[POST /api/paypal/capture-order] token failure", err);
    return NextResponse.json(
      { error: "Failed to authenticate with PayPal" },
      { status: 500 }
    );
  }

  const captureRes = await fetch(
    `${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }
  );

  if (!captureRes.ok) {
    const text = await captureRes.text();
    console.error(
      "[POST /api/paypal/capture-order] capture failure",
      captureRes.status,
      text
    );
    return NextResponse.json(
      { error: "Failed to capture PayPal order" },
      { status: 502 }
    );
  }

  const captureData = (await captureRes.json()) as { status?: string };
  if (captureData.status !== "COMPLETED") {
    console.error(
      "[POST /api/paypal/capture-order] payment not completed",
      captureData.status
    );
    return NextResponse.json(
      { error: "Payment not completed" },
      { status: 400 }
    );
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { clerkUserId: userId },
      data: { credits: { increment: 100 } },
    });
    return NextResponse.json({
      success: true,
      credits: updatedUser.credits,
    });
  } catch (err) {
    console.error("[POST /api/paypal/capture-order] database failure", err);
    return NextResponse.json(
      { error: "Failed to update credits" },
      { status: 500 }
    );
  }
}
