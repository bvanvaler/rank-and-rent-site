import type { Metadata } from "next";
import Link from "next/link";
import { BlockRenderer, Photo, type BlockCtx } from "@/components/BlockRenderer";
import { getPageBlocks, getPageImages, getSitePages, pagePath } from "@/lib/data";
import type { HeroContent, Page, PageBlock, PageImage, PageIntroContent, Site } from "@/lib/types";
import { bandRule, layoutOf } from "@/lib/layout";
import { addAutoLinks, buildLinkTerms } from "@/lib/links";
import type { ServiceAreaRegion } from "@/lib/types";

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
  const legal = pages.filter((p) => p.page_type === "legal");
  const privacy = legal.find((p) => /privacy/i.test(p.slug));
  const terms = legal.find((p) => /terms/i.test(p.slug));
  return {
    pages,
    pageHrefById,
    locationHrefByName,
    thankYouHref: thankYou ? pagePath(thankYou) : undefined,
    privacyHref: privacy ? pagePath(privacy) : undefined,
    termsHref: terms ? pagePath(terms) : undefined,
  };
}

/** "November 28, 2026" for a post's publish date. */
function postDate(page: Page): string | null {
  if (!page.published_at) return null;
  return new Date(page.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/New_York" });
}

/** What photo belongs in each spot, by page type, so placeholders tell Bill exactly what to shoot. */
function photoPlan(page: Page, site: Site): { hero?: string; bands: string[]; eyebrow?: string } {
  const name = page.nav_label ?? "";
  switch (page.page_type) {
    case "home":
      return {
        hero: "Crew installing gutter guards on a local home",
        bands: ["Before and after: clogged gutter vs. guard installed", "Crew hanging seamless gutters", "Finished job on a two-story home"],
      };
    case "service":
      return { hero: `${name}: finished job, close-up`, bands: [`${name}: crew at work`, `${name}: before and after`], eyebrow: `${name} · ${site.city ?? ""}, ${site.state ?? ""}` };
    case "location":
      return { hero: `Finished gutters on a ${name} home`, bands: [`Job in ${name}: before and after`, `Crew on a ${name} street`], eyebrow: `Serving ${name}, ${site.state ?? ""}` };
    case "services_hub":
      return { hero: "Crew with truck and gutter machine", bands: [], eyebrow: "Our Services" };
    case "locations_hub":
      return { hero: "Map or photo of the service area", bands: [], eyebrow: "Service Areas" };
    case "about":
      return { hero: "Owner or crew photo", bands: ["Truck and equipment"], eyebrow: "About Us" };
    case "contact":
    case "estimate":
      return { bands: [], eyebrow: "Free Estimates" };
    case "blog_hub":
      return { bands: [], eyebrow: "Tips & Local Answers" };
    case "post":
      return { hero: `Photo for this article: ${name}`, bands: [], eyebrow: postDate(page) ? `Article · ${postDate(page)}` : "Article" };
    case "guide":
      return { hero: `Photo for this guide: ${name}`, bands: [], eyebrow: "Guide" };
    default:
      return { bands: [] };
  }
}

const SECTION_TYPES = new Set(["body_section", "local_trust", "pricing_table", "differentiators", "process_steps", "services_grid", "service_area", "testimonials"]);

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
  const [rawBlocks, images, maps] = await Promise.all([getPageBlocks(page.id), getPageImages(page.id), linkMaps(site.id)]);
  // In-text links (first mention of each service, town and the business name), then the link-list sections.
  const linked = addAutoLinks(rawBlocks, buildLinkTerms(site, maps.pages), pagePath(page));
  const blocks = await withAreaLinks(linked, page, site, maps);
  const headline = headlineOf(blocks, page.nav_label ?? site.business_name);
  const placeholders = site.theme?.placeholders !== false;
  const plan = photoPlan(page, site);
  const bandEvery = bandRule(layoutOf(site.theme), page.page_type); // 0 = no wide photos
  const estimate = maps.pages.find((p) => p.page_type === "estimate");
  const parentHub = page.parent_page_id ? maps.pages.find((p) => p.id === page.parent_page_id) : undefined;
  const crumbs =
    page.page_type === "home"
      ? undefined
      : [{ label: "Home", href: "/" }, ...(parentHub ? [{ label: parentHub.nav_label ?? "", href: pagePath(parentHub) }] : []), { label: page.nav_label ?? headline }];

  const postLd =
    page.page_type === "post" || page.page_type === "guide"
      ? {
          "@context": "https://schema.org",
          "@type": page.page_type === "guide" ? "Article" : "BlogPosting",
          headline: headline,
          description: page.meta_description ?? undefined,
          datePublished: page.published_at ?? undefined,
          dateModified: page.published_at ?? undefined,
          url: `${siteOrigin(site)}${pagePath(page)}`,
          mainEntityOfPage: `${siteOrigin(site)}${pagePath(page)}`,
          author: { "@type": "Organization", name: site.business_name, url: siteOrigin(site) },
          publisher: { "@type": "Organization", "@id": `${siteOrigin(site)}/#business`, name: site.business_name },
        }
      : null;

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

  const base: Omit<BlockCtx, "alt"> = {
    images,
    pageHrefById: maps.pageHrefById,
    locationHrefByName: maps.locationHrefByName,
    thankYouHref: maps.thankYouHref,
    estimateHref: estimate ? pagePath(estimate) : "/contact",
    siteId: site.id,
    businessName: site.business_name,
    privacyHref: maps.privacyHref,
    termsHref: maps.termsHref,
    phone: site.phone,
    placeholders,
    crumbs,
    eyebrow: plan.eyebrow,
    heroPhoto: plan.hero,
  };

  // Skip the auto child list when the page's own blocks already link every child.
  const blocksListChildren = blocks.some((b) => b.block_type === "services_grid" || b.block_type === "service_area");
  const showChildren = childList && childList.length > 0 && !blocksListChildren;

  const out: React.ReactNode[] = [];
  let alt = false; // alternate section backgrounds
  let sectionsSinceBand = 0;
  let band = 0;
  const pushBand = () => {
    if (band >= plan.bands.length) return;
    const slot = `band-${band + 1}`;
    const ph = Photo({ image: images[slot], label: plan.bands[band], slot, show: placeholders });
    band++;
    if (ph) out.push(<div key={slot} className="img-band"><div className="wrap">{ph}</div></div>);
  };

  blocks.forEach((b, i) => {
    if (b.block_type === "final_cta" && showChildren) {
      out.push(
        <section key="children" className={`section${alt ? " section--alt" : ""}`}>
          <div className="wrap">
            <ul className="linklist">
              {childList!.map((c) => (
                <li key={c.id}>
                  <Link href={pagePath(c)}>{c.nav_label ?? c.slug}</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>,
      );
      alt = !alt;
    }
    const isSection = SECTION_TYPES.has(b.block_type) || b.block_type === "faq" || b.block_type === "related_links" || b.block_type === "contact_info";
    out.push(<BlockRenderer key={b.id} block={b} ctx={{ ...base, alt: isSection ? alt : false }} />);
    if (isSection) alt = !alt;
    // Homepage: trust strip right under the hero.
    if (i === 0 && page.page_type === "home" && site.theme?.trust?.length) {
      out.push(
        <div key="trust" className="trust">
          <div className="wrap trust__grid">
            {site.theme.trust.map((t, n) => (
              <div key={n} className="trust__item">
                <span className="trust__icon" aria-hidden="true">✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>,
      );
    }
    if (SECTION_TYPES.has(b.block_type)) {
      sectionsSinceBand++;
      const next = blocks[i + 1];
      if (bandEvery > 0 && sectionsSinceBand >= bandEvery && next && SECTION_TYPES.has(next.block_type)) {
        pushBand();
        sectionsSinceBand = 0;
      }
    }
  });
  if (showChildren && !blocks.some((b) => b.block_type === "final_cta")) {
    out.push(
      <section key="children" className="section">
        <div className="wrap">
          <ul className="linklist">
            {childList!.map((c) => (
              <li key={c.id}>
                <Link href={pagePath(c)}>{c.nav_label ?? c.slug}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>,
    );
  }

  return (
    <>
      {serviceLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />}
      {postLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(postLd) }} />}
      {out}
      {page.page_type === "contact" && <ContactDetails site={site} />}
      <PhotoCredits images={images} />
    </>
  );
}

/** Descriptive anchor for links back to the homepage, e.g. "Hoosier Gutter Guys: Gutter Guards in Noblesville". */
function homeLabel(site: Site, pages: Page[]): string {
  const main = pages.find((p) => p.page_type === "service" && p.nav_label)?.nav_label;
  return main && site.city ? `${site.business_name}: ${main} in ${site.city}` : site.business_name;
}

/** The site's towns grouped by region, from the Service Areas page (or the homepage). */
async function serviceRegions(pages: Page[]): Promise<ServiceAreaRegion[]> {
  for (const type of ["locations_hub", "home"] as const) {
    const p = pages.find((x) => x.page_type === type);
    if (!p) continue;
    const area = (await getPageBlocks(p.id)).find((b) => b.block_type === "service_area");
    const regions = (area?.content as { regions?: ServiceAreaRegion[] } | undefined)?.regions;
    if (regions?.length) return regions;
  }
  return [];
}

/**
 * REA page templates: town pages end with "Nearby Areas We Serve" (the other
 * towns in the same region), and service pages list every town they serve.
 * Added just before the closing call-to-action.
 */
async function withAreaLinks(blocks: PageBlock[], page: Page, site: Site, maps: Awaited<ReturnType<typeof linkMaps>>): Promise<PageBlock[]> {
  if (page.page_type === "home") return insertBeforeCta(blocks, latestPosts(page, maps.pages, 6, "Tips & Local Answers"));
  // Posts link to about 8 other posts (REA's article guidance).
  if (page.page_type === "post") return insertBeforeCta(blocks, latestPosts(page, maps.pages, 8, "More Tips & Local Answers"));
  if (page.page_type === "guide") return insertBeforeCta(blocks, latestPosts(page, maps.pages, 8, "Related Tips & Answers"));
  if (page.page_type !== "location" && page.page_type !== "service") return blocks;
  const regions = await serviceRegions(maps.pages);
  let extra: PageBlock | null = null;

  if (page.page_type === "location") {
    const me = (page.nav_label ?? "").toLowerCase();
    const region = regions.find((r) => r.cities.some((c) => c.toLowerCase() === me));
    let towns = (region?.cities ?? []).filter((c) => c.toLowerCase() !== me && maps.locationHrefByName[c.toLowerCase()]);
    if (towns.length < 3) {
      // No region match: fall back to the towns next to this one alphabetically.
      const all = maps.pages.filter((p) => p.page_type === "location" && p.nav_label).map((p) => p.nav_label!);
      const i = all.findIndex((c) => c.toLowerCase() === me);
      towns = all.filter((_, j) => j !== i && Math.abs(j - i) <= 4);
    }
    if (towns.length) {
      extra = {
        id: `auto-nearby-${page.id}`,
        page_id: page.id,
        block_type: "related_links",
        position: 0,
        content: {
          heading: "Nearby Areas We Serve",
          items: [
            ...towns.map((c) => ({ label: c, href: maps.locationHrefByName[c.toLowerCase()] })),
            { label: "All Service Areas", href: "/locations" },
            // A descriptive link back to the homepage, the site's main ranking target.
            { label: homeLabel(site, maps.pages), href: "/" },
          ],
        },
      } as unknown as PageBlock;
    }
  } else if (regions.length && !blocks.some((b) => b.block_type === "service_area")) {
    extra = {
      id: `auto-areas-${page.id}`,
      page_id: page.id,
      block_type: "service_area",
      position: 0,
      content: { heading: `${page.nav_label ?? "Our Services"}: Towns We Serve`, regions },
    } as unknown as PageBlock;
  }

  return insertBeforeCta(blocks, extra);
}

function insertBeforeCta(blocks: PageBlock[], extra: PageBlock | null): PageBlock[] {
  if (!extra) return blocks;
  const at = blocks.findIndex((b) => b.block_type === "final_cta");
  return at === -1 ? [...blocks, extra] : [...blocks.slice(0, at), extra, ...blocks.slice(at)];
}

/** The newest published posts as a link list (REA: the homepage links to the articles). */
function latestPosts(page: Page, pages: Page[], n: number, heading: string): PageBlock | null {
  const hub = pages.find((p) => p.page_type === "blog_hub");
  const posts = pages
    .filter((p) => p.page_type === "post" && p.id !== page.id)
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .slice(0, n);
  if (!posts.length) return null;
  return {
    id: `auto-posts-${page.id}`,
    page_id: page.id,
    block_type: "related_links",
    position: 0,
    content: {
      heading,
      items: [...posts.map((p) => ({ label: p.nav_label ?? p.slug, href: pagePath(p) })), ...(hub ? [{ label: "All articles", href: pagePath(hub) }] : [])],
    },
  } as unknown as PageBlock;
}

/** Attribution for licensed photos used on this page (required by their Creative Commons licenses). */
function PhotoCredits({ images }: { images: Record<string, PageImage> }) {
  // credit / credit_url are selected in getPageImages; only licensed photos have them.
  const credited = (Object.values(images) as (PageImage & { credit?: string | null; credit_url?: string | null })[]).filter((i) => i.credit);
  if (credited.length === 0) return null;
  return (
    <div className="wrap" style={{ fontSize: 12, color: "var(--muted)", paddingTop: 18, paddingBottom: 18 }}>
      Photo credits:{" "}
      {credited.map((i, n) => (
        <span key={i.id}>
          {n > 0 && " · "}
          {i.credit_url ? (
            <a href={i.credit_url} rel="nofollow noopener" target="_blank" style={{ color: "inherit" }}>
              {i.credit}
            </a>
          ) : (
            i.credit
          )}
        </span>
      ))}
    </div>
  );
}

function ContactDetails({ site }: { site: Site }) {
  const address = [site.street_address, [site.city, site.state].filter(Boolean).join(", "), site.postal_code]
    .filter(Boolean)
    .join(" ");
  if (!site.phone && !site.email && !address) return null;
  return (
    <section className="section section--alt">
      <div className="wrap">
      <h2 style={{ fontSize: 28, margin: "0 0 14px" }}>Get in Touch</h2>
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
      </div>
    </section>
  );
}
