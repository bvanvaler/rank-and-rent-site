import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Poppins } from "next/font/google";
import "../globals.css";
import { getSiteByDomain, getSitePages, listActiveDomains, pagePath } from "@/lib/data";
import type { Page, Site, SiteTheme } from "@/lib/types";

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
    icons: site.theme?.logo_b64 ? { icon: "/logo.webp" } : undefined,
    verification: site.gsc_verification_tag ? { google: site.gsc_verification_tag } : undefined,
  };
}

/** sites.theme -> CSS variables on <html>, so every site has its own palette. */
function themeVars(theme: SiteTheme | null): React.CSSProperties {
  const t = theme ?? {};
  const map: Record<string, string | undefined> = {
    "--primary": t.primary,
    "--primary-dark": t.primary_dark,
    "--dark": t.dark,
    "--accent": t.accent,
    "--accent-dark": t.accent_dark,
    "--accent-ink": t.accent_ink,
    "--tint": t.tint,
    "--alt": t.alt,
    "--ink": t.ink,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v)) as React.CSSProperties;
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

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
  const faqPage = first("faq");
  const estimatePage = first("estimate");
  const servicePages = servicesHub ? pages.filter((p) => p.parent_page_id === servicesHub.id) : [];
  const locationPages = locationsHub ? pages.filter((p) => p.parent_page_id === locationsHub.id) : [];
  const ctaHref = estimatePage ? pagePath(estimatePage) : "/contact";
  const hasLogo = Boolean(site.theme?.logo_b64);

  return (
    <html lang="en" className={displayFont.variable} style={themeVars(site.theme)}>
      <body>
        {site.ga_measurement_id && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${site.ga_measurement_id}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${site.ga_measurement_id}');`}
            </Script>
          </>
        )}

        <header>
          <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
            <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 10, paddingBottom: 10 }}>
              <Link href="/" className="brand" style={{ color: "var(--ink)" }}>
                {hasLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/logo.webp" alt={`${site.business_name} logo`} width={70} height={80} style={{ height: 72, width: "auto" }} />
                )}
                <span className="brand__name" style={{ color: "var(--ink)" }}>
                  {site.business_name}
                  {site.tagline && (
                    <span style={{ display: "block", fontFamily: "system-ui, sans-serif", fontWeight: 500, fontSize: 13, color: "var(--muted)" }}>
                      {site.tagline}
                    </span>
                  )}
                </span>
              </Link>
              <div className="header-contact">
                {site.city && (
                  <span className="header-contact__item header-contact__item--hide" style={{ color: "var(--muted)" }}>
                    📍 Based in {site.city}, {site.state}
                  </span>
                )}
                {site.phone && (
                  <a href={tel(site.phone)} className="btn btn--accent">
                    📞 {site.phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          <nav className="site-nav" aria-label="Main">
            <div className="wrap site-nav__inner" style={{ position: "relative" }}>
              <ul className="nav__links">
                <li>
                  <Link href="/" className="nav__link">
                    Home
                  </Link>
                </li>
                {servicesHub && (
                  <li>
                    <Link href="/services" className="nav__link">
                      Services ▾
                    </Link>
                    {servicePages.length > 0 && (
                      <div className="nav__drop">
                        {servicePages.map((p) => (
                          <Link key={p.id} href={pagePath(p)}>
                            {p.nav_label ?? p.slug}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                )}
                {locationsHub && (
                  <li>
                    <Link href="/locations" className="nav__link">
                      Service Areas ▾
                    </Link>
                    {locationPages.length > 0 && (
                      <div className="nav__drop nav__drop--cols">
                        {locationPages.map((p) => (
                          <Link key={p.id} href={pagePath(p)}>
                            {p.nav_label ?? p.slug}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                )}
                {aboutPage && (
                  <li>
                    <Link href="/about" className="nav__link">
                      About
                    </Link>
                  </li>
                )}
                {faqPage && (
                  <li>
                    <Link href={pagePath(faqPage)} className="nav__link">
                      FAQ
                    </Link>
                  </li>
                )}
                {contactPage && (
                  <li>
                    <Link href="/contact" className="nav__link">
                      Contact
                    </Link>
                  </li>
                )}
              </ul>

              <details className="nav__mobile">
                <summary>☰ Menu</summary>
                <div className="nav__mobile-panel">
                  <Link href="/">Home</Link>
                  {servicesHub && <Link href="/services">Services</Link>}
                  {servicePages.map((p) => (
                    <Link key={p.id} href={pagePath(p)} className="sub">
                      {p.nav_label ?? p.slug}
                    </Link>
                  ))}
                  {locationsHub && <Link href="/locations">Service Areas</Link>}
                  {aboutPage && <Link href="/about">About</Link>}
                  {faqPage && <Link href={pagePath(faqPage)}>FAQ</Link>}
                  {contactPage && <Link href="/contact">Contact</Link>}
                </div>
              </details>

              <Link href={ctaHref} className="btn btn--accent nav__cta">
                Get a Free Estimate →
              </Link>
            </div>
          </nav>
        </header>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd(site, locationPages)) }} />
        <main>{children}</main>

        <SiteFooter site={site} pages={pages} servicePages={servicePages} locationPages={locationPages} hasLogo={hasLogo} />

        <div className={`mbar${site.phone ? "" : " mbar--one"}`}>
          {site.phone && (
            <a href={tel(site.phone)} className="btn btn--primary">
              📞 Call Now
            </a>
          )}
          <Link href={ctaHref} className="btn btn--accent">
            Free Estimate →
          </Link>
        </div>
      </body>
    </html>
  );
}

/**
 * REA Blueprint: LocalBusiness on every page, with a sameAs array of every
 * live profile -- present even when empty.
 */
function localBusinessLd(site: Site, locationPages: Page[]) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `https://${site.domain}/#business`,
    name: site.business_name,
    url: `https://${site.domain}`,
    logo: site.theme?.logo_b64 ? `https://${site.domain}/logo.webp` : undefined,
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

/** REA Blueprint footer: brand + NAP, services, service areas, company + legal. */
function SiteFooter({
  site,
  pages,
  servicePages,
  locationPages,
  hasLogo,
}: {
  site: Site;
  pages: Page[];
  servicePages: Page[];
  locationPages: Page[];
  hasLogo: boolean;
}) {
  const companyTypes: Page["page_type"][] = ["about", "faq", "estimate", "careers", "contact"];
  const company = companyTypes.flatMap((t) => pages.filter((p) => p.page_type === t));
  const legal = pages.filter((p) => p.page_type === "legal");
  const address = [site.street_address, [site.city, site.state].filter(Boolean).join(", "), site.postal_code].filter(Boolean).join(" ");
  const list = (items: Page[]) => (
    <ul>
      {items.map((p) => (
        <li key={p.id}>
          <Link href={pagePath(p)}>{p.nav_label ?? p.slug}</Link>
        </li>
      ))}
    </ul>
  );
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          {hasLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo.webp" alt="" width={70} height={80} loading="lazy" style={{ height: 80, width: "auto", background: "#fff", borderRadius: 12, padding: 6, marginBottom: 12 }} />
          )}
          <p style={{ color: "#fff", fontWeight: 700, margin: "0 0 6px" }}>{site.business_name}</p>
          {address && <p style={{ margin: 0 }}>{address}</p>}
          {site.phone && (
            <p style={{ margin: "6px 0 0" }}>
              <a href={tel(site.phone)}>{site.phone}</a>
            </p>
          )}
          {site.email && <p style={{ margin: "6px 0 0" }}>{site.email}</p>}
        </div>
        {servicePages.length > 0 && (
          <div>
            <h2>Services</h2>
            {list(servicePages)}
          </div>
        )}
        {locationPages.length > 0 && (
          <div>
            <h2>Service Areas</h2>
            <div className="footer-areas">{list(locationPages)}</div>
          </div>
        )}
        <div>
          <h2>Company</h2>
          {list([...company, ...legal])}
        </div>
      </div>
      <div className="wrap footer-bottom">
        &copy; {new Date().getFullYear()} {site.business_name}
      </div>
    </footer>
  );
}
