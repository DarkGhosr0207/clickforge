import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
 * POST /api/paypal/create-order
 * Creates a PayPal order for CTRLab Pro (100 credits, $12 USD one-time).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "12.00",
            },
            description: "CTRLab Pro - 100 credits",
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[POST /api/paypal/create-order] PayPal order error", res.status, text);
      return NextResponse.json(
        { error: "Failed to create PayPal order" },
        { status: 502 }
      );
    }

    const order = (await res.json()) as { id?: string };
    if (!order.id) {
      return NextResponse.json(
        { error: "Invalid PayPal order response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ orderID: order.id });
  } catch (err) {
    console.error("[POST /api/paypal/create-order]", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
