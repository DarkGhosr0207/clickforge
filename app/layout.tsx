import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Social preview: public/og-image.png (1200×630). Regenerate: npm run og:image
export const metadata: Metadata = {
  metadataBase: new URL("https://ctrlab.ai"),
  title: "CTRLab — AI Tool to Increase YouTube CTR",
  description:
    "Generate high-performing thumbnails and titles with AI. Optimize your YouTube CTR with better concepts, scoring, and recommendations.",
  openGraph: {
    title: "CTRLab — AI Tool to Increase YouTube CTR",
    description:
      "Generate high-performing thumbnails and titles with AI. Optimize your YouTube CTR with better concepts, scoring, and recommendations.",
    url: "https://ctrlab.ai",
    siteName: "CTRLab",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CTRLab — AI Tool to Increase YouTube CTR",
    description:
      "Generate high-performing thumbnails and titles with AI. Optimize your YouTube CTR with better concepts, scoring, and recommendations.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/tool">
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <SiteFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}
