import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/site/CookieBanner";

import appCss from "../styles.css?url";

const BASE_URL = "https://cognivus.ai";

// ── JSON-LD organisation schema ──────────────────────────────────────────────
const ORGANISATION_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Cognivus",
  url: BASE_URL,
  logo: `${BASE_URL}/favicon.png`,
  description:
    "Cognivus is an AI-driven technology company building intelligent, scalable solutions for real-world business problems.",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@cognivus.ai",
    url: `${BASE_URL}/contact`,
  },
  sameAs: [],
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cognivus — The mind behind every solution" },
      {
        name: "description",
        content:
          "Cognivus is an AI-driven technology company building intelligent, scalable solutions for real-world business problems.",
      },
      { property: "og:site_name", content: "Cognivus" },
      { property: "og:title", content: "Cognivus — The mind behind every solution" },
      {
        property: "og:description",
        content:
          "AI automation, RAG knowledge assistants, custom chatbots, and workflow intelligence.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BASE_URL },
      { property: "og:image", content: `${BASE_URL}/og-image.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cognivus — The mind behind every solution" },
      {
        name: "twitter:description",
        content:
          "AI automation, RAG knowledge assistants, custom chatbots, and workflow intelligence.",
      },
      { name: "twitter:image", content: `${BASE_URL}/og-image.png` },
      // Canonical is set per-page; this is the root fallback
      { tagName: "link", rel: "canonical", href: BASE_URL },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png" },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: ORGANISATION_SCHEMA,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
      <CookieBanner />
    </>
  );
}
