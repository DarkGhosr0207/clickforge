import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero */}
      <section className="px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Built for YouTube creators
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            ClickForge
          </h1>
          <p className="mt-6 text-lg text-gray-600 md:text-xl">
            Design thumbnails that get clicked.
          </p>
          <p className="mt-3 text-base text-gray-500 md:text-lg">
            Generate thumbnail concepts, test CTR strength, and create visuals before you open Canva.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tool"
              className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Try ClickForge
            </Link>
            <a
              href="#features"
              className="rounded-2xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              See features
            </a>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section id="features" className="border-t border-gray-200 bg-white px-6 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="sr-only">Features</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">
                Generate thumbnail concepts
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Turn one video idea into multiple thumbnail directions.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">
                Find the strongest direction
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Use scoring, recommendation, and stress testing to choose what to explore.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm font-semibold text-gray-900">
                Generate and test visuals
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Create images and preview how they look at small YouTube sizes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo / Workflow */}
      <section className="border-t border-gray-200 px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-xl font-semibold text-gray-900 md:text-2xl">
            How it works
          </h2>
          <ol className="mt-10 space-y-8">
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                1
              </span>
              <div>
                <p className="font-medium text-gray-900">Enter your video idea</p>
                <p className="mt-1 text-sm text-gray-600">
                  Add title, niche, and audience. Generate a pack of thumbnail concepts.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                2
              </span>
              <div>
                <p className="font-medium text-gray-900">Compare thumbnail directions</p>
                <p className="mt-1 text-sm text-gray-600">
                  Review scores, recommendation, and stress tests to pick the best direction.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                3
              </span>
              <div>
                <p className="font-medium text-gray-900">Generate and refine visuals</p>
                <p className="mt-1 text-sm text-gray-600">
                  Create images, preview at small sizes, and download.
                </p>
              </div>
            </li>
          </ol>
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
              Open ClickForge
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
