import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getPageByPath, getRedirect, getSiteByDomain, getSitePages, listActiveDomains, pagePath } from "@/lib/data";
import { PageView, pageMetadata } from "@/lib/render";

// Static, cached on the CDN, refreshed in the background at most every
// 5 minutes (or instantly via /api/revalidate after a publish).
export const revalidate = 300;

type Props = { params: Promise<{ domain: string; slug: string }> };

/** Pre-builds every published page of every active site at deploy time; anything new is built on first visit, then cached. */
export async function generateStaticParams() {
  try {
    const out: { domain: string; slug: string }[] = [];
    for (const domain of await listActiveDomains()) {
      const site = await getSiteByDomain(domain);
      if (!site) continue;
      for (const p of await getSitePages(site.id)) {
        const slug = pagePath(p).slice(1);
        if (slug && !slug.includes("/")) out.push({ domain, slug });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function load(domain: string, slug: string) {
  const site = await getSiteByDomain(domain);
  if (!site) return null;
  const page = await getPageByPath(site.id, `/${slug}`);
  return { site, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain, slug } = await params;
  const loaded = await load(domain, slug);
  return loaded?.page ? pageMetadata(loaded.site, loaded.page) : {};
}

export default async function SitePage({ params }: Props) {
  const { domain, slug } = await params;
  const loaded = await load(domain, slug);
  if (!loaded) notFound();
  const { site, page } = loaded;

  if (!page) {
    // Old URLs from a migrated site (e.g. WordPress /cleaning-fishers/)
    // 301 to their new home instead of 404ing.
    const r = await getRedirect(site.id, `/${slug}`);
    if (r) (r.permanent ? permanentRedirect : redirect)(r.to_path);
    notFound();
  }

  const isHub = page.page_type === "services_hub" || page.page_type === "locations_hub" || page.page_type === "blog_hub";
  let childList = isHub ? (await getSitePages(site.id)).filter((p) => p.parent_page_id === page.id) : undefined;
  // Blog: newest posts first.
  if (page.page_type === "blog_hub" && childList) childList = [...childList].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return <PageView site={site} page={page} childList={childList} />;
}
