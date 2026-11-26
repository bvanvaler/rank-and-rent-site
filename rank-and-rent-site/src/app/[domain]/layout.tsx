import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Poppins } from "next/font/google";
import "../globals.css";
import { getSiteByDomain, getSitePages, listActiveDomains, pagePath } from "@/lib/data";
import type { Page, Site } from "@/lib/types";

const displayFont = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const revalidate = 300;

type LayoutProps = { children: React.ReactNode; params: Promise<{ domain: string }> };

/** Pre-builds every active site at deploy time (new sites build on first visit). */
export async function generateStaticParams() {
  try {
    return (await listActiveDomains()).map((domain) => ({ domain }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }): Promise<Metadata> {
  const site = await getSiteByDomain((await params).domain);
  if (!site) return { title: "Site not configured" };
  // (The shared *.vercel.app address gets an X-Robots-Tag: noindex header from proxy.ts.)
  return {
    metadataBase: new URL(`https://${site.domain}`),
    title: { default: site.business_name, template: `%s | ${site.business_name}` },
    description: site.tagline ?? undefined,
    // Google's HTML-tag verification method for Search Console -- paste
    // just the content value (the string after content=") into the site's
    // gsc_verification_tag field in the admin, once a real domain is
    // attached and Search Console asks for it. Next injects the full
    // <meta name="google-site-verification"> tag from this.
    verification: site.gsc_verification_tag
      ? { google: site.gsc_verification_tag }
      : undefined,
  };
}

export default async function SiteLayout({ children, params }: LayoutProps) {
  const site = await getSiteByDomain((await params).domain);

  if (!site) {
    return (
      <html lang="en">
        <body className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
          <p>No site is configured for this domain yet.</p>
        </body>
      </html>
    );
  }

  const pages = await getSitePages(site.id);
  const first = (type: Page["page_type"]) => pages.find((p) => p.page_type === type);
  const servicesHub = first("services_hub");
  const locationsHub = first("locations_hub");
  const aboutPage = first("about");
  const contactPage = first("contact");
  const estimatePage = first("estimate");
  const servicePages = servicesHub ? pages.filter((p) => p.parent_page_id === servicesHub.id) : [];
  const locationPages = locationsHub ? pages.filter((p) => p.parent_page_id === locationsHub.id) : [];
  const ctaHref = estimatePage ? pagePath(estimatePage) : "/contact";

  return (
    <html lang="en" className={`h-full ${displayFont.variable}`}>
      <body className="min-h-full flex flex-col font-sans bg-white text-slate-900">
        {/* Per-site GA4 tag (PROJECT.md's "SEO Risk" guardrail: a separate
            property per domain, never shared across sites) -- only loads
            once a real measurement ID is set on this site's record. */}
        {site.ga_measurement_id && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${site.ga_measurement_id}');`}
            </Script>
          </>
        )}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <nav className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
            <Link href="/" className="text-lg font-bold text-slate-900 tracking-tight shrink-0">
              {site.business_name}
            </Link>

            <div className="hidden sm:flex items-center gap-1 text-sm font-medium text-slate-600">
              {servicesHub && (
                <NavDropdown label="Services" href="/services" items={servicePages} />
              )}
              {locationsHub && (
                <NavDropdown label="Locations" href="/locations" items={locationPages} />
              )}
              {aboutPage && <NavLink href="/about">About</NavLink>}
              {contactPage && (
                <NavLink href="/contact">Contact</NavLink>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {site.phone && (
                <a
                  href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}
                  className="hidden md:block text-sm font-semibold text-slate-900 hover:text-slate-600"
                >
                  {site.phone}
                </a>
              )}
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] text-white text-xs font-semibold uppercase tracking-wide px-4 py-2.5 hover:bg-black whitespace-nowrap"
              >
                Get a Free Estimate <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </nav>
        </header>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd(site, locationPages)) }}
        />
        <main className="flex-1">{children}</main>

        <SiteFooter site={site} pages={pages} servicePages={servicePages} locationPages={locationPages} />
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100">
      {children}
    </Link>
  );
}

/**
 * CSS-only hover dropdown (no client component / JS needed) -- matches
 * PROJECT.md's "Services (dropdown -> all service pages)" nav spec. Falls
 * back to a plain link when there's nothing to list yet (e.g. a hub with
 * no published children), so it never shows an empty dropdown.
 */
function NavDropdown({
  label,
  href,
  items,
}: {
  label: string;
  href: string;
  items: { id: string; slug: string; nav_label: string | null }[];
}) {
  if (items.length === 0) {
    return <NavLink href={href}>{label}</NavLink>;
  }
  return (
    <div className="relative group">
      <Link href={href} className="px-3 py-2 rounded-md hover:text-slate-900 hover:bg-slate-100 inline-block">
        {label}
      </Link>
      <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-0 top-full pt-1 min-w-[200px]">
        <div className="bg-white border border-slate-200 rounded-lg shadow-lg py-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${item.slug}`}
              className="block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              {item.nav_label ?? item.slug}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * REA Blueprint: LocalBusiness on every page, with a sameAs array of every
 * live profile -- present even when empty -- so adding a profile URL in the
 * admin is all it takes to connect it.
 */
function localBusinessLd(site: Site, locationPages: Page[]) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `https://${site.domain}/#business`,
    name: site.business_name,
    url: `https://${site.domain}`,
    telephone: site.phone ?? undefined,
    email: site.email ?? undefined,
    address: site.street_address
      ? {
          "@type": "PostalAddress",
          streetAddress: site.street_address,
          addressLocality: site.city ?? undefined,
          addressRegion: site.state ?? undefined,
          postalCode: site.postal_code ?? undefined,
          addressCountry: "US",
        }
      : undefined,
    geo:
      site.latitude != null && site.longitude != null
        ? { "@type": "GeoCoordinates", latitude: site.latitude, longitude: site.longitude }
        : undefined,
    areaServed: locationPages
      .filter((p) => p.nav_label)
      .map((p) => ({ "@type": "City", name: `${p.nav_label}, ${site.state ?? ""}`.trim() })),
    sameAs: Array.isArray(site.same_as) ? site.same_as : [],
  };
}

/**
 * REA Blueprint footer: sitemap-style link columns (services, locations,
 * company + legal) plus the business's NAP. Only published pages appear.
 */
function SiteFooter({
  site,
  pages,
  servicePages,
  locationPages,
}: {
  site: Site;
  pages: Page[];
  servicePages: Page[];
  locationPages: Page[];
}) {
  const companyTypes: Page["page_type"][] = ["about", "faq", "estimate", "careers", "contact"];
  const company = companyTypes.flatMap((t) => pages.filter((p) => p.page_type === t));
  const legal = pages.filter((p) => p.page_type === "legal");
  const address = [site.street_address, [site.city, site.state].filter(Boolean).join(", "), site.postal_code]
    .filter(Boolean)
    .join(" ");
  const col = (title: string, items: Page[]) =>
    items.length > 0 && (
      <div>
        <h2 className="font-semibold text-slate-900 mb-3">{title}</h2>
        <ul className="space-y-1.5">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={pagePath(p)} className="hover:text-slate-900 hover:underline">
                {p.nav_label ?? p.slug}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <footer className="border-t border-slate-200 mt-12 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-600">
        <div>
          <p className="font-semibold text-slate-900 mb-2">{site.business_name}</p>
          {address && <p>{address}</p>}
          {site.phone && (
            <p className="mt-1">
              <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="hover:text-slate-900">
                {site.phone}
              </a>
            </p>
          )}
          {site.email && <p className="mt-1">{site.email}</p>}
        </div>
        {col("Services", servicePages)}
        {col("Service Areas", locationPages)}
        {col("Company", [...company, ...legal])}
      </div>
      <p className="text-center text-xs text-slate-400 pb-6">
        &copy; {new Date().getFullYear()} {site.business_name}
      </p>
    </footer>
  );
}
