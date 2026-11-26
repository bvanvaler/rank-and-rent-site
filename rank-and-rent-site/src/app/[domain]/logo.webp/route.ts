import { getSiteByDomain, listActiveDomains } from "@/lib/data";

/**
 * Each site's logo, served from its own domain (/logo.webp) out of
 * sites.theme.logo_b64 -- no shared image host across sites. Static and
 * CDN-cached like the pages.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await listActiveDomains()).map((domain) => ({ domain }));
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const site = await getSiteByDomain((await params).domain);
  const b64 = (site?.theme as { logo_b64?: string } | null)?.logo_b64;
  if (!b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=86400" },
  });
}
