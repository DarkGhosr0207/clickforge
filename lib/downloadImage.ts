/**
 * Triggers a direct file download of an image so the browser does not open it
 * in a new tab. Works for data URLs (e.g. OpenAI) and external URLs (e.g. Runway).
 * External URLs are proxied via /api/download-thumbnail to avoid CORS and
 * ensure Content-Disposition: attachment is respected.
 */
export function downloadImage(url: string, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;

  if (url.startsWith("data:")) {
    // Data URL: fetch as blob and use object URL so the download attribute is respected.
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Delay revoke so the browser can start the download before the URL is revoked.
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch(() => {
        // Fallback: use data URL directly (may open in tab in some browsers).
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    return;
  }

  // External URL: use proxy so the server returns the image with
  // Content-Disposition: attachment, forcing a download.
  const params = new URLSearchParams({
    url,
    filename: filename || "thumbnail.png",
  });
  link.href = `/api/download-thumbnail?${params.toString()}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
