import type { Metadata } from "next";
import Link from "next/link";
import { BlockRenderer, Photo, type BlockCtx } from "@/components/BlockRenderer";
import { getPageBlocks, getPageImages, getSitePages, pagePath } from "@/lib/data";
import type { HeroContent, Page, PageBlock, PageImage, PageIntroContent, Site } from "@/lib/types";

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
  const [blocks, images, maps] = await Promise.all([getPageBlocks(page.id), getPageImages(page.id), linkMaps(site.id)]);
  const headline = headlineOf(blocks, page.nav_label ?? site.business_name);
  const placeholders = site.theme?.placeholders !== false;
  const plan = photoPlan(page, site);
  const estimate = maps.pages.find((p) => p.page_type === "estimate");
  const parentHub = page.parent_page_id ? maps.pages.find((p) => p.id === page.parent_page_id) : undefined;
  const crumbs =
    page.page_type === "home"
      ? undefined
      : [{ label: "Home", href: "/" }, ...(parentHub ? [{ label: parentHub.nav_label ?? "", href: pagePath(parentHub) }] : []), { label: page.nav_label ?? headline }];

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
      if (sectionsSinceBand >= 3 && next && SECTION_TYPES.has(next.block_type)) {
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
      {out}
      {page.page_type === "contact" && <ContactDetails site={site} />}
      <PhotoCredits images={images} />
    </>
  );
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
