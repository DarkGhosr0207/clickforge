import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DODO_PAYMENTS_URL = "https://live.dodopayments.com/payments";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.DODO_API_KEY;
  const productId = process.env.DODO_PRODUCT_ID;

  if (!apiKey || !productId) {
    console.error("[POST /api/dodo/create-checkout] Missing env vars", {
      hasDodoApiKey: Boolean(apiKey),
      hasDodoProductId: Boolean(productId),
    });
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    clerkUser?.primaryEmailAddress?.emailAddress ??
    null;

  if (!clerkUser || !email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim();
  const customerName = name.length > 0 ? name : email;

  try {
    const res = await fetch(DODO_PAYMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        billing: {
          city: "Barcelona",
          country: "ES",
          state: "Catalonia",
          street: "N/A",
          zipcode: "00000",
        },
        customer: {
          email,
          name: customerName,
          create_new_customer: false,
        },
        product_cart: [
          {
            product_id: productId,
            quantity: 1,
          },
        ],
        payment_link: true,
        return_url: "https://ctrlab.ai/pricing?success=true",
        metadata: {
          clerkUserId: userId,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(
        "[POST /api/dodo/create-checkout] Dodo API error",
        res.status,
        text
      );
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 502 }
      );
    }

    const payment = (await res.json()) as { payment_link?: string };
    if (!payment?.payment_link) {
      console.error(
        "[POST /api/dodo/create-checkout] Invalid Dodo response",
        payment
      );
      return NextResponse.json(
        { error: "Invalid checkout session response" },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: payment.payment_link });
  } catch (err) {
    console.error("[POST /api/dodo/create-checkout] Unexpected error", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

