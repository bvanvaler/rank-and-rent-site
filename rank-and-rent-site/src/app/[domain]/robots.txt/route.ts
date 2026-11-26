import { listActiveDomains } from "@/lib/data";

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    return (await listActiveDomains()).map((domain) => ({ domain }));
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: https://${domain}/sitemap.xml\n`, {
    headers: { "content-type": "text/plain" },
  });
}
