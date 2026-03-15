import { NextRequest, NextResponse } from "next/server";

const DEFAULT_FILENAME = "thumbnail.png";

/** Hostnames allowed for thumbnail image proxying. Add CDN/hosts as needed. */
const ALLOWED_IMAGE_HOSTS = new Set([
  "api.dev.runwayml.com",
  "api.runwayml.com",
  "dnznrvs05pmza.cloudfront.net",
]);

function isAllowedHostname(hostname: string): boolean {
  return ALLOWED_IMAGE_HOSTS.has(hostname.toLowerCase());
}

/** Sanitize filename and preserve a safe image extension when possible. */
function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").trim() || DEFAULT_FILENAME;
  const hasSafeExtension = /\.(png|jpe?g|gif|webp)$/i.test(safe);
  return hasSafeExtension ? safe : `${safe.replace(/\.+$/, "")}.png`;
}

/**
 * Proxies an external thumbnail image and returns it with Content-Disposition: attachment
 * so the browser triggers a download instead of opening the URL in a new tab.
 * Used for Runway (and other external) image URLs where the download attribute is ignored.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const filename = searchParams.get("filename") || DEFAULT_FILENAME;

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid url query parameter" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json(
      { error: "Only http and https URLs are allowed" },
      { status: 400 }
    );
  }

  if (!isAllowedHostname(parsed.hostname)) {
    return NextResponse.json(
      { error: "Hostname not allowed for thumbnail download" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: "image/*" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json(
        { error: "Upstream response is not an image" },
        { status: 502 }
      );
    }

    const buffer = await res.arrayBuffer();
    const safeFilename = sanitizeFilename(filename);
    const disposition = `attachment; filename="${safeFilename}"`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Error in /api/download-thumbnail:", err);
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 502 }
    );
  }
}
