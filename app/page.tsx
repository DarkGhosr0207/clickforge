"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

const BG = "#0B0B0F";
const CARD = "#141419";
const ACCENT = "#6366F1";

export default function Home() {
  const { isSignedIn } = useAuth();
  const isAuthenticated = !!isSignedIn;

  return (
    <main
      className="min-h-screen text-white antialiased"
      style={{ backgroundColor: BG }}
    >
      {/* Sticky nav — brand left, actions right */}
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
            {!isAuthenticated && (
              <Link
                href="/sign-in"
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-white transition hover:border-white"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/tool"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 sm:px-6 sm:py-3"
              style={{
                backgroundColor: ACCENT,
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px rgba(99, 102, 241, 0.55)",
              }}
            >
              {isAuthenticated ? "Open app" : "Test your thumbnail"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-20 pt-12 md:px-8 md:pb-28 md:pt-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.25), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400">
            {"You're probably picking the wrong thumbnail"}
          </p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
            Predict which thumbnail will get clicks — before you post
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg text-gray-300 md:text-xl">
            Test multiple thumbnail ideas, see their CTR scores, and pick the one most likely to win.
          </p>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tool"
              className="inline-flex rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
              style={{
                backgroundColor: ACCENT,
                boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset, 0 12px 40px -12px rgba(99, 102, 241, 0.55)",
              }}
            >
              {isAuthenticated ? "Open app" : "Test your thumbnail"}
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex rounded-xl border border-white/15 bg-white/[0.04] px-8 py-3.5 text-sm font-semibold text-gray-200 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.07]"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Visual proof — sample CTR comparison */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <p className="text-center text-lg font-medium tracking-tight text-white md:text-xl">
            Which one would you pick?
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 overflow-visible sm:grid-cols-3 sm:gap-6 sm:px-1">
            <article
              className="overflow-hidden rounded-2xl border border-white/[0.08] transition hover:border-white/12"
              style={{ backgroundColor: CARD }}
            >
              <div
                className="aspect-video w-full bg-gradient-to-br from-rose-500/30 via-amber-500/20 to-slate-900"
                aria-hidden
              />
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
                <span className="text-xs text-gray-400">CTR score</span>
                <span className="text-lg font-semibold tabular-nums text-white">6.8 / 10</span>
              </div>
            </article>

            <article
              className="relative z-10 overflow-hidden rounded-2xl border-[3px] shadow-xl transition-transform sm:scale-[1.045]"
              style={{
                backgroundColor: CARD,
                borderColor: ACCENT,
                boxShadow:
                  "0 0 0 1px rgba(99, 102, 241, 0.5), 0 0 60px -8px rgba(99, 102, 241, 0.55), 0 24px 56px -20px rgba(99, 102, 241, 0.35)",
              }}
            >
              <span
                className="absolute right-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-md"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)",
                }}
              >
                Winner
              </span>
              <div
                className="aspect-video w-full bg-gradient-to-br from-violet-500/40 via-indigo-500/30 to-slate-900"
                aria-hidden
              />
              <div className="border-t border-white/[0.06] px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">CTR score</span>
                  <span className="text-lg font-semibold tabular-nums text-white">8.1 / 10</span>
                </div>
                <p className="mt-2 text-[10px] font-medium text-gray-400">Tested in CTRLab</p>
              </div>
            </article>

            <article
              className="overflow-hidden rounded-2xl border border-white/[0.08] transition hover:border-white/12"
              style={{ backgroundColor: CARD }}
            >
              <div
                className="aspect-video w-full bg-gradient-to-br from-cyan-500/25 via-blue-600/20 to-slate-900"
                aria-hidden
              />
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
                <span className="text-xs text-gray-400">CTR score</span>
                <span className="text-lg font-semibold tabular-nums text-white">7.4 / 10</span>
              </div>
            </article>
          </div>
          <p className="mt-8 text-center text-sm text-gray-400">Most people choose wrong.</p>
          <p className="mt-2 text-center text-xs text-gray-400/90">
            Run this through the CTR Lab.
          </p>
          <p className="mx-auto mt-14 max-w-lg text-center text-sm text-gray-400">
            Designed for creators who optimize for clicks, not guesses
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-t border-white/[0.06] px-6 py-20 md:px-8 md:py-24"
        style={{ backgroundColor: BG }}
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-white md:text-3xl">
            How it works
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
            {[
              "Generate multiple thumbnail strategies",
              "See which one is most likely to win (CTR score)",
              "Move forward with confidence",
            ].map((text, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.08] px-6 py-8 text-center md:text-left"
                style={{ backgroundColor: CARD }}
              >
                <span
                  className="text-xs font-semibold tabular-nums text-gray-400"
                  aria-hidden
                >
                  {i + 1}.
                </span>
                <p className="mt-2 text-base font-medium leading-snug text-white">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you get */}
      <section
        id="what-you-get"
        className="border-t border-white/[0.06] px-6 py-20 md:px-8 md:py-24"
        style={{ backgroundColor: "#08080c" }}
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-white md:text-3xl">
            What you get
          </h2>
          <ul className="mt-14 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Multiple thumbnail concepts",
                body: "Different strategies from one brief—not one generic idea.",
              },
              {
                title: "CTR score for each variant",
                body: "A clear read on what’s most likely to win clicks.",
              },
              {
                title: "AI recommendation",
                body: "A suggested top pick so you’re not guessing.",
              },
              {
                title: "Stress test",
                body: "What could fail—and how to improve before you ship.",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-white/[0.08] p-6"
                style={{ backgroundColor: CARD }}
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/[0.06] px-6 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Start testing your next thumbnail
          </h2>
          <div className="mt-10">
            <Link
              href="/tool"
              className="inline-flex rounded-xl px-8 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
              style={{
                backgroundColor: ACCENT,
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.08) inset, 0 12px 40px -12px rgba(99, 102, 241, 0.55)",
              }}
            >
              {isAuthenticated ? "Open app" : "Test your thumbnail"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
