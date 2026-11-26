import type { Page, PageBlock, Site } from "@/lib/types";
import { pagePath } from "@/lib/data";

/**
 * Internal links inside the writing.
 *
 * Text fields may contain links written as [words](/path). On top of that,
 * every page automatically links the FIRST natural mention of each service,
 * each town and the business name to that page (once per page, never to the
 * page itself). Links are added in page order, so the earliest mention wins.
 */

export interface LinkTerm {
  href: string;
  re: RegExp;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function variants(label: string): string[] {
  const base = label.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
  const out = new Set([base, label.toLowerCase().trim()]);
  // singular/plural of the last word: "gutter guards" <-> "gutter guard", "gutter repair" -> "gutter repairs"
  for (const v of [...out]) {
    if (v.endsWith("ss")) continue; // "seamless", "glass": not plurals
    if (v.endsWith("s")) out.add(v.slice(0, -1));
    else out.add(v + "s");
  }
  return [...out].filter((v) => v.length >= 4);
}

// Words too general to stand for one service on their own.
const GENERIC = new Set(["gutter", "gutters", "and", "installation", "install", "service", "services", "new", "the", "of", "in", "home", "house", "roof", "roofing"]);

export function buildLinkTerms(site: Site, pages: Page[]): LinkTerm[] {
  const terms: { href: string; phrases: string[] }[] = [];
  const services = pages.filter((p) => p.page_type === "service" && p.nav_label);
  const distinctive = (p: Page) =>
    p.nav_label!
      .toLowerCase()
      .replace(/&/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !GENERIC.has(w));
  for (const p of services) {
    const phrases = variants(p.nav_label!);
    // also the words in the page's address, e.g. "seamless gutter installation"
    phrases.push(...variants(p.slug.replace(/-/g, " ")));
    // and the service's distinctive word on its own ("guards", "seamless", "cleaning", "fascia"),
    // when no other service uses that word
    for (const w of distinctive(p)) {
      if (services.some((o) => o !== p && distinctive(o).includes(w))) continue;
      phrases.push(...variants(w));
    }
    terms.push({ href: pagePath(p), phrases });
  }
  for (const p of pages) {
    if (!p.nav_label) continue;
    if (p.page_type === "service") {
      continue;
    } else if (p.page_type === "location") {
      terms.push({ href: pagePath(p), phrases: [p.nav_label] });
    }
  }
  terms.push({ href: "/", phrases: [site.business_name] });
  // A bare word like "repair" shouldn't link when it's really "fascia repair" or "roof repair".
  const otherWords = ["roof", "roofing", "siding", "window", "fascia", "soffit", "chimney", "deck", "fence", "driveway"];
  const notAfter = otherWords.map((w) => `(?<!${w} )`).join("");
  return terms.map((t) => {
    // Longest phrase first so "seamless gutter installation" beats "seamless gutters".
    const alts = [...new Set(t.phrases)].sort((a, b) => b.length - a.length).map(esc);
    return { href: t.href, re: new RegExp(`(?<![\\w-])${notAfter}(${alts.join("|")})(?![\\w-])`, "i") };
  });
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Adds the first unused mention of each term in `text` as a [link](href). */
function linkText(text: string, terms: LinkTerm[], used: Set<string>, budget: { left: number }): string {
  let out = text;
  for (const t of terms) {
    if (budget.left <= 0) break;
    if (used.has(t.href)) continue;
    // only search the parts of the text that aren't already links
    const parts = out.split(/(\[[^\]]+\]\([^)\s]+\))/);
    let done = false;
    for (let i = 0; i < parts.length && !done; i++) {
      if (i % 2 === 1) continue;
      const m = t.re.exec(parts[i]);
      if (!m) continue;
      parts[i] = parts[i].slice(0, m.index) + `[${m[1]}](${t.href})` + parts[i].slice(m.index + m[1].length);
      done = true;
    }
    if (done) {
      out = parts.join("");
      used.add(t.href);
      budget.left--;
    }
  }
  return out;
}

/**
 * Returns copies of the page's blocks with auto-links added to their text,
 * in page order. Links already written by hand count as used.
 */
export function addAutoLinks(blocks: PageBlock[], terms: LinkTerm[], selfHref: string, max = 25): PageBlock[] {
  const used = new Set<string>([selfHref]);
  for (const b of blocks) for (const m of JSON.stringify(b.content).matchAll(LINK_RE)) used.add(m[2]);
  const budget = { left: max };
  const link = (s: unknown) => (typeof s === "string" ? linkText(s, terms, used, budget) : s);

  return blocks.map((b) => {
    const c = b.content as Record<string, unknown>;
    switch (b.block_type) {
      case "body_section":
      case "local_trust":
        return { ...b, content: { ...c, body: link(c.body) } };
      case "faq":
        return { ...b, content: { ...c, items: ((c.items as { question: string; answer: string }[]) ?? []).map((it) => ({ ...it, answer: link(it.answer) })) } };
      case "differentiators":
      case "process_steps":
        return { ...b, content: { ...c, items: ((c.items as { heading: string; body: string }[]) ?? []).map((it) => ({ ...it, body: link(it.body) })) } };
      default:
        return b;
    }
  });
}
