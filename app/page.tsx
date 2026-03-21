"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  const { isSignedIn } = useAuth();
  const isAuthenticated = !!isSignedIn;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero */}
      <section className="px-6 pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Built for YouTube creators who care about CTR.
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            CTRLab
          </h1>
          <p className="mt-6 text-lg font-medium text-gray-900 md:text-xl">
            Generate thumbnails that actually get clicks
          </p>
          <p className="mt-4 max-w-xl mx-auto text-base text-gray-600 md:text-lg">
            Create high-performing thumbnail concepts, compare them, and pick the best one with AI.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tool"
              className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Try CTRLab
            </Link>
            <a
              href="#how-it-works"
              className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              See how it works
            </a>
            {!isAuthenticated && (
              <Link
                href="/sign-in"
                className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-gray-200 bg-white px-6 py-14 md:py-16"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-semibold text-gray-900 md:text-2xl">
            How it works
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center md:text-left">
              <p className="text-sm font-semibold text-gray-900">
                1. Generate thumbnail concepts
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Turn your video idea into several strategic directions.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center md:text-left">
              <p className="text-sm font-semibold text-gray-900">
                2. Compare CTR scores
              </p>
              <p className="mt-2 text-sm text-gray-600">
                See how each variant stacks up before you design.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center md:text-left">
              <p className="text-sm font-semibold text-gray-900">
                3. Pick the best variant
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Move forward with the direction most likely to win clicks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section
        id="what-you-get"
        className="border-t border-gray-200 bg-gray-50 px-6 py-14 md:py-16"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-semibold text-gray-900 md:text-2xl">
            What you get
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            <li className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">
                Multiple thumbnail concepts
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Different strategies from one brief—not a single generic idea.
              </p>
            </li>
            <li className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">
                CTR score for each variant
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Compare options with a clear score per concept.
              </p>
            </li>
            <li className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">
                AI recommendation (best variant)
              </p>
              <p className="mt-1 text-sm text-gray-600">
                A suggested top pick so you’re not guessing.
              </p>
            </li>
            <li className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900">
                Stress test
              </p>
              <p className="mt-1 text-sm text-gray-600">
                What could fail—and how to improve before you ship.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gray-200 bg-white px-6 py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-gray-900 md:text-3xl">
            Start testing your next thumbnail
          </h2>
          <div className="mt-8">
            <Link
              href="/tool"
              className="inline-block rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {isAuthenticated ? "Open CTRLab" : "Try CTRLab"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
