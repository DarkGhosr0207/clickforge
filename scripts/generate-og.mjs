/**
 * Generates public/og-image.png (1200×630) from inline SVG.
 * Run: npm run og:image
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const out = path.join(root, "public", "og-image.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0f0f0f"/>
  <text x="600" y="280" text-anchor="middle" fill="#fafafa" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" font-weight="700">CTRLab</text>
  <text x="600" y="380" text-anchor="middle" fill="#a3a3a3" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" font-size="30">Generate thumbnails that actually get clicks</text>
</svg>`;

await sharp(Buffer.from(svg)).resize(1200, 630).png().toFile(out);
console.log("Wrote", out);
