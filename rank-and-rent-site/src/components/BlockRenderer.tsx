import type {
  BodySectionContent,
  ContactInfoContent,
  DifferentiatorsContent,
  FaqContent,
  FinalCtaContent,
  HeroContent,
  LocalTrustContent,
  PageBlock,
  PageImage,
  PageIntroContent,
  PricingTableContent,
  ProcessStepsContent,
  RelatedLinksContent,
  ServiceAreaContent,
  ServicesGridContent,
  TestimonialsContent,
} from "@/lib/types";
import { publicImageUrl } from "@/lib/supabase";
import { ContactForm } from "@/components/ContactForm";

/** Everything a block needs besides its own content. Built once per page in render.tsx. */
export interface BlockCtx {
  images: Record<string, PageImage>;
  pageHrefById: Record<string, string>;
  /** Lower-cased location nav_label -> href, so service-area city names link to their pages. */
  locationHrefByName: Record<string, string>;
  thankYouHref?: string;
  estimateHref: string;
  siteId: string;
  phone: string | null;
  /** Show labeled "photo needed" boxes for empty photo spots (sites.theme.placeholders). */
  placeholders: boolean;
  /** Alternate section background (white / light gray), decided by the page. */
  alt: boolean;
  /** Inner-page hero extras: breadcrumbs, default eyebrow, whether to show a photo spot, its label. */
  crumbs?: { label: string; href?: string }[];
  eyebrow?: string;
  heroPhoto?: string;
}

/**
 * Renders every block_type. Heading levels are fixed per block type (H1 only
 * in hero/page_intro, H2 for sections), so editors can change words but not
 * the page outline.
 */
export function BlockRenderer({ block, ctx }: { block: PageBlock; ctx: BlockCtx }) {
  const c = block.content as unknown;
  switch (block.block_type) {
    case "hero":
      return <Hero content={c as HeroContent} ctx={ctx} />;
    case "page_intro":
      return <InnerHero content={c as PageIntroContent} ctx={ctx} />;
    case "services_grid":
      return <ServicesGrid content={c as ServicesGridContent} ctx={ctx} />;
    case "differentiators":
      return <Differentiators content={c as DifferentiatorsContent} ctx={ctx} />;
    case "service_area":
      return <ServiceArea content={c as ServiceAreaContent} ctx={ctx} />;
    case "process_steps":
      return <ProcessSteps content={c as ProcessStepsContent} ctx={ctx} />;
    case "pricing_table":
      return <PricingTable content={c as PricingTableContent} ctx={ctx} />;
    case "testimonials":
      return <Testimonials content={c as TestimonialsContent} ctx={ctx} />;
    case "faq":
      return <Faq content={c as FaqContent} ctx={ctx} />;
    case "related_links":
      return <RelatedLinks content={c as RelatedLinksContent} ctx={ctx} />;
    case "local_trust":
      return <Prose heading={(c as LocalTrustContent).heading} body={(c as LocalTrustContent).body} ctx={ctx} />;
    case "contact_info":
      return <ContactInfo content={c as ContactInfoContent} ctx={ctx} pageId={block.page_id} />;
    case "body_section":
      return <Prose heading={(c as BodySectionContent).heading} body={(c as BodySectionContent).body} ctx={ctx} />;
    case "final_cta":
      return <FinalCta content={c as FinalCtaContent} ctx={ctx} />;
    default:
      return null;
  }
}

/* ---------------- shared bits ---------------- */

/** Plain text with [words](/path) links removed (for FAQ schema). */
const stripLinks = (text: string) => text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1");

const TEXT_LINK: React.CSSProperties = { color: "var(--primary)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, textDecorationThickness: 1 };

/** Text with [words](/path) links turned into real links. Only site paths and http(s) URLs are linked. */
export function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const href = m[2];
    if (href.startsWith("/")) out.push(<a key={m.index} href={href} style={TEXT_LINK}>{m[1]}</a>);
    else if (/^https?:\/\//.test(href)) out.push(<a key={m.index} href={href} rel="noopener" target="_blank" style={TEXT_LINK}>{m[1]}</a>);
    else out.push(m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A paragraph made only of "| a | b |" lines is a table: first line is the header, "|---|" lines are skipped. */
const isTable = (p: string) => p.trim().split("\n").every((l) => l.trim().startsWith("|"));
function TextTable({ text }: { text: string }) {
  const rows = text
    .trim()
    .split("\n")
    .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
  const [head, ...body] = rows;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="ptable">
        <thead>
          <tr>{head.map((c, i) => <th key={i}>{inline(c)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p, i) => (isTable(p) ? <TextTable key={i} text={p} /> : <p key={i}>{inline(p)}</p>));

function Section({ ctx, children, id }: { ctx: BlockCtx; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={`section${ctx.alt ? " section--alt" : ""}`}>
      <div className="wrap">{children}</div>
    </section>
  );
}

function Head({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`section__head${center ? " section__head--center" : ""}`}>
      <span className="rule" aria-hidden="true" />
      <h2>{children}</h2>
    </div>
  );
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

function CallOrSecondary({ ctx, light = false, fallback }: { ctx: BlockCtx; light?: boolean; fallback?: { text: string; href: string } }) {
  if (ctx.phone)
    return (
      <a href={tel(ctx.phone)} className={`btn btn--lg ${light ? "btn--ghost" : "btn--outline"}`}>
        Call {ctx.phone}
      </a>
    );
  if (!fallback) return null;
  return (
    <a href={fallback.href} className={`btn btn--lg ${light ? "btn--ghost" : "btn--outline"}`}>
      {fallback.text}
    </a>
  );
}

/**
 * A real photo when one is uploaded for this slot; otherwise, while the site
 * is in build mode (theme.placeholders), a labeled box saying what photo
 * belongs here. With placeholders off, an empty slot renders nothing.
 */
export function Photo({
  image,
  label,
  slot,
  show,
  eager = false,
}: {
  image?: PageImage;
  label: string;
  slot: string;
  show: boolean;
  eager?: boolean;
}) {
  if (image)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={publicImageUrl(image.storage_path)}
        alt={image.alt_text ?? label}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    );
  if (!show) return null;
  return (
    <div className="ph" role="img" aria-label={`Photo needed: ${label}`}>
      <div>
        <div className="ph__icon" aria-hidden="true">
          📷
        </div>
        <div className="ph__label">Photo needed: {label}</div>
        <div className="ph__slot">slot: {slot}</div>
      </div>
    </div>
  );
}

/* ---------------- heroes ---------------- */

function Hero({ content, ctx }: { content: HeroContent; ctx: BlockCtx }) {
  const slot = content.image_slot ?? "hero";
  const media = Photo({ image: ctx.images[slot], label: ctx.heroPhoto ?? "Crew at work on a local home", slot, show: ctx.placeholders, eager: true });
  return (
    <section className="hero">
      <div className="wrap hero__split" style={media ? undefined : { gridTemplateColumns: "1fr" }}>
        <div>
          {(content.eyebrow ?? ctx.eyebrow) && <p className="hero__eyebrow">{content.eyebrow ?? ctx.eyebrow}</p>}
          <h1>{content.headline}</h1>
          {content.subheadline && <p className="hero__sub">{content.subheadline}</p>}
          {content.intro && <p className="hero__intro">{content.intro}</p>}
          {content.checklist && content.checklist.length > 0 && (
            <ul className="hero__checklist">
              {content.checklist.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <div className="hero__cta">
            <a href={content.cta_url ?? ctx.estimateHref} className="btn btn--accent btn--lg">
              {content.cta_text ?? "Get a Free Estimate"} <span aria-hidden="true">→</span>
            </a>
            <CallOrSecondary ctx={ctx} fallback={{ text: "See Our Prices", href: "#prices" }} />
          </div>
        </div>
        {media && <div className="hero__media">{media}</div>}
      </div>
    </section>
  );
}

function InnerHero({ content, ctx }: { content: PageIntroContent; ctx: BlockCtx }) {
  const media = ctx.heroPhoto
    ? Photo({ image: ctx.images.hero, label: ctx.heroPhoto, slot: "hero", show: ctx.placeholders, eager: true })
    : null;
  return (
    <section className="hero hero--inner">
      <div className="wrap hero__split" style={media ? undefined : { gridTemplateColumns: "1fr" }}>
        <div>
          {ctx.crumbs && ctx.crumbs.length > 1 && (
            <nav className="crumbs" aria-label="Breadcrumb">
              {ctx.crumbs.map((c, i) => (
                <span key={i}>
                  {i > 0 && " › "}
                  {c.href ? <a href={c.href}>{c.label}</a> : c.label}
                </span>
              ))}
            </nav>
          )}
          {(content.eyebrow ?? ctx.eyebrow) && <p className="hero__eyebrow">{content.eyebrow ?? ctx.eyebrow}</p>}
          <h1>{content.headline}</h1>
          {content.intro && <div className="hero__intro">{paragraphs(content.intro)}</div>}
          {ctx.eyebrow !== undefined && (
            <div className="hero__cta">
              <a href={ctx.estimateHref} className="btn btn--accent btn--lg">
                Get a Free Estimate <span aria-hidden="true">→</span>
              </a>
              <CallOrSecondary ctx={ctx} />
            </div>
          )}
        </div>
        {media && <div className="hero__media">{media}</div>}
      </div>
    </section>
  );
}

/* ---------------- content blocks ---------------- */

function Prose({ heading, body, ctx }: { heading?: string; body: string; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      {heading && <Head>{heading}</Head>}
      <div className="prose">{paragraphs(body)}</div>
    </Section>
  );
}

function ServicesGrid({ content, ctx }: { content: ServicesGridContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      <Head>Our Services</Head>
      {content.intro && <p className="lead" style={{ marginTop: -6, marginBottom: 24 }}>{content.intro}</p>}
      <div className="grid grid--3">
        {content.items?.map((item, i) => {
          const slot = item.image_slot ?? `service-${i + 1}`;
          const href = item.link_page_id ? ctx.pageHrefById[item.link_page_id] : undefined;
          return (
            <div key={i} className="svc-card">
              <Photo image={ctx.images[slot]} label={`${item.title} job photo`} slot={slot} show={ctx.placeholders} />
              <div className="svc-card__body">
                <h3>{item.title}</h3>
                {item.blurb && <p>{item.blurb}</p>}
                {href && (
                  <a href={href} className="more">
                    Learn more →
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

const ICONS = ["💲", "📏", "🏠", "🛠️", "🍂", "💧", "🛡️", "📋", "⭐"];

function Differentiators({ content, ctx }: { content: DifferentiatorsContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      {content.heading && <Head>{content.heading}</Head>}
      <div className="grid grid--3">
        {content.items?.map((item, i) => (
          <div key={i} className="card">
            <div className="card__icon" aria-hidden="true">
              {ICONS[i % ICONS.length]}
            </div>
            <h3>{item.heading}</h3>
            <p>{inline(item.body)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ProcessSteps({ content, ctx }: { content: ProcessStepsContent; ctx: BlockCtx }) {
  const n = content.items?.length ?? 0;
  return (
    <Section ctx={ctx}>
      {content.heading && <Head>{content.heading}</Head>}
      <div className={`grid ${n === 4 || n === 2 ? "grid--2" : "grid--3"}`} style={{ rowGap: 40, marginTop: 30 }}>
        {content.items?.map((item, i) => (
          <div key={i} className="card step">
            <span className="step__num">{i + 1}</span>
            <h3>{item.heading}</h3>
            <p>{inline(item.body)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PricingTable({ content, ctx }: { content: PricingTableContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx} id="prices">
      {content.heading && <Head>{content.heading}</Head>}
      <div className="price">
        {(content.intro || content.cta_url) && (
          <div className="price__callout">
            {content.intro && paragraphs(content.intro)}
            {content.cta_text && content.cta_url && (
              <a href={content.cta_url} className="btn btn--accent">
                {content.cta_text} →
              </a>
            )}
          </div>
        )}
        {content.rows?.length > 0 && (
          <table className="ptable">
            <thead>
              <tr>
                <th>Service</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row, i) => (
                <tr key={i}>
                  <td>{row.label}</td>
                  <td className="amt">
                    {String(row.price_low) === String(row.price_high) ? `$${row.price_low}` : `$${row.price_low}–$${row.price_high}`}{" "}
                    <span style={{ fontWeight: 500, fontSize: 14, color: "var(--muted)" }}>{row.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

function Faq({ content, ctx }: { content: FaqContent; ctx: BlockCtx }) {
  if (!content.items?.length) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: stripLinks(i.answer) },
    })),
  };
  return (
    <Section ctx={ctx}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {content.heading && <Head center>{content.heading}</Head>}
      <div className="faq">
        {content.items.map((item, i) => (
          <details key={i} open={i === 0}>
            <summary>
              <h3 style={{ display: "inline", font: "inherit", margin: 0 }}>{item.question}</h3>
            </summary>
            <p>{inline(item.answer)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function ServiceArea({ content, ctx }: { content: ServiceAreaContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      {content.heading && <Head>{content.heading}</Head>}
      {content.regions?.map((region, i) => (
        <div key={i} className="region">
          <h3>{region.region_name}</h3>
          <ul className="linklist">
            {region.cities.map((city) => {
              const href = ctx.locationHrefByName[city.toLowerCase()];
              return <li key={city}>{href ? <a href={href}>{city}</a> : <span>{city}</span>}</li>;
            })}
          </ul>
        </div>
      ))}
    </Section>
  );
}

function RelatedLinks({ content, ctx }: { content: RelatedLinksContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      {content.heading && <Head>{content.heading}</Head>}
      <ul className="linklist">
        {content.items?.map((item, i) => {
          const href = item.href ?? (item.link_page_id ? ctx.pageHrefById[item.link_page_id] : undefined);
          return <li key={i}>{href ? <a href={href}>{item.label}</a> : <span>{item.label}</span>}</li>;
        })}
      </ul>
    </Section>
  );
}

function Testimonials({ content, ctx }: { content: TestimonialsContent; ctx: BlockCtx }) {
  return (
    <Section ctx={ctx}>
      {content.heading && <Head center>{content.heading}</Head>}
      <div className="grid grid--3">
        {content.items?.map((item, i) => (
          <blockquote key={i} className="card" style={{ margin: 0 }}>
            <p style={{ fontStyle: "italic", color: "var(--ink)" }}>&ldquo;{item.quote}&rdquo;</p>
            <footer style={{ marginTop: 12, fontWeight: 700 }}>
              {item.name}
              {item.title && <span style={{ display: "block", fontWeight: 400, color: "var(--muted)" }}>{item.title}</span>}
            </footer>
          </blockquote>
        ))}
      </div>
    </Section>
  );
}

function ContactInfo({ content, ctx, pageId }: { content: ContactInfoContent; ctx: BlockCtx; pageId: string }) {
  return (
    <Section ctx={ctx}>
      <div className="form-card">
        {content.heading && <h2 style={{ fontSize: 26, margin: "0 0 6px" }}>{content.heading}</h2>}
        {content.hours && <p style={{ color: "var(--muted)", margin: "0 0 14px" }}>{content.hours}</p>}
        {content.form_enabled && <ContactForm siteId={ctx.siteId} pageId={pageId} redirectTo={ctx.thankYouHref} />}
      </div>
      {content.map_embed_url && (
        <iframe src={content.map_embed_url} className="w-full h-64 rounded-lg border border-slate-200 mt-6" loading="lazy" />
      )}
    </Section>
  );
}

function FinalCta({ content, ctx }: { content: FinalCtaContent; ctx: BlockCtx }) {
  return (
    <section className="cta-band">
      <div className="wrap">
        {content.heading && <h2>{content.heading}</h2>}
        {content.body && <p>{content.body}</p>}
        <div className="cta-band__btns">
          <a href={content.cta_url} className="btn btn--accent btn--lg">
            {content.cta_text} <span aria-hidden="true">→</span>
          </a>
          <CallOrSecondary ctx={ctx} light />
        </div>
      </div>
    </section>
  );
}
