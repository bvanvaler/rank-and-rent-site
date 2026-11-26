import type { Metadata } from "next";
import Link from "next/link";
import { BlockRenderer } from "@/components/BlockRenderer";
import { getPageBlocks, getPageImages, getSitePages, pagePath } from "@/lib/data";
import type { HeroContent, Page, PageBlock, PageIntroContent, Site } from "@/lib/types";

/**
 * Shared page plumbing for every route (home, hubs, singletons, flat
 * [slug] pages), so all of them get the same REA Blueprint build-gate
 * basics: canonical URL, meta description, Open Graph + Twitter tags,
 * working internal links, Service schema on service pages, and FAQPage
 * schema wherever an faq block renders (emitted by BlockRenderer).
 */

export function siteOrigin(site: Site) {
  return `https://${site.domain}`;
}

export function headlineOf(blocks: PageBlock[], fallback: string): string {
  const b = blocks.find((x) => x.block_type === "hero" || x.block_type === "page_intro");
  if (!b) return fallback;
  return ((b.content as unknown as HeroContent | PageIntroContent).headline || fallback) as string;
}

export async function pageMetadata(site: Site, page: Page): Promise<Metadata> {
  const blocks = await getPageBlocks(page.id);
  const headline = headlineOf(blocks, page.nav_label ?? site.business_name);
  // `absolute` opts out of the layout's "%s | business" template, which
  // would otherwise append the business name a second time.
  const title = page.meta_title ?? `${headline} | ${site.business_name}`;
  const description = page.meta_description ?? undefined;
  const url = `${siteOrigin(site)}${pagePath(page)}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: site.business_name, type: "website", locale: "en_US" },
    twitter: { card: "summary", title, description },
    robots: page.page_type === "thank_you" ? { index: false, follow: true } : undefined,
  };
}

export async function linkMaps(siteId: string) {
  const pages = await getSitePages(siteId);
  const pageHrefById: Record<string, string> = {};
  const locationHrefByName: Record<string, string> = {};
  for (const p of pages) {
    pageHrefById[p.id] = pagePath(p);
    if (p.page_type === "location" && p.nav_label) locationHrefByName[p.nav_label.toLowerCase()] = pagePath(p);
  }
  const thankYou = pages.find((p) => p.page_type === "thank_you");
  return { pages, pageHrefById, locationHrefByName, thankYouHref: thankYou ? pagePath(thankYou) : undefined };
}

export async function PageView({
  site,
  page,
  childList,
}: {
  site: Site;
  page: Page;
  /** Hub pages: published children, rendered as a link list just before the closing CTA. */
  childList?: Page[];
}) {
  const [blocks, images, maps] = await Promise.all([getPageBlocks(page.id), getPageImages(page.id), linkMaps(site.id)]);
  const headline = headlineOf(blocks, page.nav_label ?? site.business_name);

  const serviceLd =
    page.page_type === "service"
      ? {
          "@context": "https://schema.org",
          "@type": "Service",
          name: headline,
          serviceType: page.nav_label ?? headline,
          url: `${siteOrigin(site)}${pagePath(page)}`,
          provider: { "@type": "LocalBusiness", "@id": `${siteOrigin(site)}/#business`, name: site.business_name },
          areaServed: maps.pages
            .filter((p) => p.page_type === "location" && p.nav_label)
            .map((p) => ({ "@type": "City", name: `${p.nav_label}, ${site.state ?? ""}`.trim() })),
        }
      : null;

  const ctaIndex = blocks.findIndex((b) => b.block_type === "final_cta");
  // Skip the auto list when the page's own blocks already link every child (a services grid or a linked service-area block).
  const blocksListChildren = blocks.some((b) => b.block_type === "services_grid" || b.block_type === "service_area");
  const listAt =
    childList && childList.length > 0 && !blocksListChildren ? (ctaIndex === -1 ? blocks.length : ctaIndex) : -1;

  const render = (b: PageBlock) => (
    <BlockRenderer
      key={b.id}
      block={b}
      images={images}
      pageHrefById={maps.pageHrefById}
      locationHrefByName={maps.locationHrefByName}
      siteId={site.id}
      thankYouHref={maps.thankYouHref}
    />
  );

  return (
    <>
      {serviceLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />}
      {blocks.slice(0, listAt === -1 ? blocks.length : listAt).map(render)}
      {listAt !== -1 && (
        <section className="py-12 px-6 max-w-4xl mx-auto">
          {blocks.length === 0 && <h1 className="text-3xl font-bold text-slate-900 mb-6">{page.nav_label}</h1>}
          <ul className="grid sm:grid-cols-2 gap-4">
            {childList!.map((c) => (
              <li key={c.id} className="border border-slate-200 rounded-lg p-4">
                <Link href={pagePath(c)} className="font-medium text-slate-900 underline">
                  {c.nav_label ?? c.slug}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {listAt !== -1 && blocks.slice(listAt).map(render)}
      {page.page_type === "contact" && <ContactDetails site={site} />}
    </>
  );
}

function ContactDetails({ site }: { site: Site }) {
  const address = [site.street_address, [site.city, site.state].filter(Boolean).join(", "), site.postal_code]
    .filter(Boolean)
    .join(" ");
  if (!site.phone && !site.email && !address) return null;
  return (
    <section className="py-12 px-6 max-w-4xl mx-auto border-t border-slate-200">
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">Get in Touch</h2>
      <dl className="space-y-2 text-slate-700">
        {site.phone && (
          <div>
            <dt className="inline font-medium text-slate-900">Phone: </dt>
            <dd className="inline">
              <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="underline hover:text-slate-900">
                {site.phone}
              </a>
            </dd>
          </div>
        )}
        {site.email && (
          <div>
            <dt className="inline font-medium text-slate-900">Email: </dt>
            <dd className="inline">
              <a href={`mailto:${site.email}`} className="underline hover:text-slate-900">
                {site.email}
              </a>
            </dd>
          </div>
        )}
        {address && (
          <div>
            <dt className="inline font-medium text-slate-900">Address: </dt>
            <dd className="inline">{address}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
