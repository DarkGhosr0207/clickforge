import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk middleware. All routes are public by default.
 * /tool is intentionally left public for guest (teaser) mode.
 * Protect specific routes later via createRouteMatcher + auth.protect() if needed.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
