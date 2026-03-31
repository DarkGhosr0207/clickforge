"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const BG = "#0B0B0F";
const CARD = "#141419";
const ACCENT = "#6366F1";

export default function PricingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.search.includes("success=true")) {
      setShowSuccess(true);
    }
  }, []);

  async function handleDodoCheckout() {
    setCheckoutError(null);
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/dodo/create-checkout", { method: "POST" });
      if (!res.ok) {
        setCheckoutError("Something went wrong. Please try again.");
        setCheckoutLoading(false);
        return;
      }
      const data = (await res.json()) as { url?: unknown };
      if (typeof data.url !== "string" || data.url.length === 0) {
        setCheckoutError("Something went wrong. Please try again.");
        setCheckoutLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("[Dodo checkout]", err);
      setCheckoutError("Something went wrong. Please try again.");
      setCheckoutLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen text-white antialiased"
      style={{ backgroundColor: BG }}
    >
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black/60 shadow-[0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 md:px-8">
          <Link href="/" className="group min-w-0 shrink">
            <span className="block text-xl font-bold tracking-tight text-white md:text-2xl">
              CTRLAB
            </span>
            <span className="mt-0.5 block text-sm font-medium text-gray-400">
              Test what gets clicks
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-3 sm:gap-4">
            <Link
              href="/tool"
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-white transition hover:border-white"
            >
              App
            </Link>
            <Link
              href="/"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
              style={{
                backgroundColor: ACCENT,
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px rgba(99, 102, 241, 0.55)",
              }}
            >
              Home
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-24 pt-14 md:px-8 md:pb-32 md:pt-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.22), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
            Pricing
          </p>
          <h1 className="mt-4 text-center text-3xl font-bold tracking-tight text-white md:text-4xl">
            Choose your CTRLab plan
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-pretty text-gray-400">
            Start free with 10 credits, or unlock 100 credits with a one-time Pro purchase.
          </p>

          {showSuccess && (
            <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-300">
              Payment successful! 100 credits have been added to your account.
            </div>
          )}

          <div className="mt-14 grid gap-8 md:grid-cols-2 md:gap-10">
            {/* Free */}
            <article
              className="flex flex-col rounded-2xl border border-white/[0.08] p-8"
              style={{ backgroundColor: CARD }}
            >
              <h2 className="text-lg font-semibold text-white">Free</h2>
              <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-white">
                $0
              </p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  10 credits on signup
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  5 thumbnail concepts per pack
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  All analysis features
                </li>
              </ul>
              <Link
                href="/tool"
                className="mt-10 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                Get Started
              </Link>
            </article>

            {/* Pro */}
            <article
              className="relative flex flex-col overflow-hidden rounded-2xl border-[2px] p-8 shadow-xl"
              style={{
                backgroundColor: CARD,
                borderColor: ACCENT,
                boxShadow:
                  "0 0 0 1px rgba(99, 102, 241, 0.35), 0 0 48px -12px rgba(99, 102, 241, 0.4)",
              }}
            >
              <span
                className="absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Popular
              </span>
              <h2 className="text-lg font-semibold text-white">Pro</h2>
              <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-white">
                $12
              </p>
              <p className="mt-1 text-sm text-gray-400">one-time · 100 credits</p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  100 credits
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  5 thumbnail concepts per pack
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  All analysis features
                </li>
                <li className="flex gap-2">
                  <span className="text-indigo-400" aria-hidden>
                    ✓
                  </span>
                  Priority support
                </li>
              </ul>

              <div className="mt-10 min-h-[48px] w-full">
                {!isLoaded && (
                  <div className="flex h-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-sm text-gray-400">
                    Loading…
                  </div>
                )}
                {isLoaded && !isSignedIn && (
                  <Link
                    href="/sign-in"
                    className="flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
                    style={{
                      backgroundColor: ACCENT,
                      boxShadow:
                        "0 0 0 1px rgba(255,255,255,0.1) inset, 0 8px 24px -8px rgba(99, 102, 241, 0.55)",
                    }}
                  >
                    Sign in to purchase
                  </Link>
                )}
                {isLoaded && isSignedIn && (
                  <button
                    type="button"
                    onClick={handleDodoCheckout}
                    disabled={checkoutLoading}
                    className="flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{
                      backgroundColor: ACCENT,
                      boxShadow:
                        "0 0 0 1px rgba(255,255,255,0.1) inset, 0 8px 24px -8px rgba(99, 102, 241, 0.55)",
                    }}
                  >
                    {checkoutLoading ? "Redirecting…" : "Get 100 Credits — $12"}
                  </button>
                )}
              </div>

              {checkoutError && (
                <p className="mt-4 text-center text-sm font-medium text-rose-300">
                  {checkoutError}
                </p>
              )}
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
