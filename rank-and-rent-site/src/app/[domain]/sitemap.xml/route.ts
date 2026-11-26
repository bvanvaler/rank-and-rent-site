import { getSiteByDomain, getSitePages, listActiveDomains, pagePath } from "@/lib/data";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    return (await listActiveDomains()).map((domain) => ({ domain }));
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const site = await getSiteByDomain(domain);
  if (!site) return new Response("Not found", { status: 404 });
  const pages = (await getSitePages(site.id)).filter((p) => p.page_type !== "thank_you");
  const urls = pages
    .map((p) => {
      const lastmod = (p as { updated_at?: string }).updated_at;
      return `  <url><loc>https://${site.domain}${pagePath(p)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "content-type": "application/xml" } },
  );
}
