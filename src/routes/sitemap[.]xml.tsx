import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  component: () => null,
  loader: () => {
    const base = "https://cognivus.ai";
    const now = new Date().toISOString().split("T")[0];

    const pages = [
      { path: "/",        changefreq: "weekly",  priority: "1.0" },
      { path: "/about",   changefreq: "monthly", priority: "0.8" },
      { path: "/services",changefreq: "monthly", priority: "0.9" },
      { path: "/projects",changefreq: "weekly",  priority: "0.8" },
      { path: "/contact", changefreq: "yearly",  priority: "0.7" },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    });
  },
});
