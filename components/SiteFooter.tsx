import Link from "next/link";
import { Fragment } from "react";

const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/acceptable-use", label: "Acceptable Use Policy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0B0B0F] px-6 py-8">
      <nav
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-center"
        aria-label="Legal"
      >
        {legalLinks.map((link, i) => (
          <Fragment key={link.href}>
            {i > 0 && (
              <span className="select-none text-gray-600" aria-hidden>
                ·
              </span>
            )}
            <Link
              href={link.href}
              className="text-xs text-gray-400 transition hover:text-gray-200"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
      </nav>
    </footer>
  );
}
