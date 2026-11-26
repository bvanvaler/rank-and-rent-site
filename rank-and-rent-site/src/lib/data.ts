import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase";
import type { Page, PageBlock, PageImage, PageType, Redirect, Site } from "@/lib/types";

/**
 * Every read here goes through Next's data cache (CMS_TTL seconds, tag
 * "cms"). Pages themselves are static ISR entries per domain (see
 * proxy.ts), so a visitor gets pre-built HTML from the CDN and never
 * waits on the database. The admin can flush everything immediately via
 * /api/revalidate after a publish.
 */
const CMS_TTL = 300;
const cached = <A extends unknown[], R>(key: string, fn: (...args: A) => Promise<R>) =>
  unstable_cache(fn, [key], { revalidate: CMS_TTL, tags: ["cms"] });

const siteByDomain = cached("site-by-domain", async (domain: string): Promise<Site | null> => {
  const { data, error } = await createPublicClient().from("sites").select("*").eq("domain", domain).maybeSingle();
  if (error) throw error;
  return (data as Site) ?? null;
});

/** The site for a domain (proxy.ts has already stripped "www." and resolved previews). */
export async function getSiteByDomain(domain: string): Promise<Site | null> {
  return siteByDomain(decodeURIComponent(domain).toLowerCase());
}

/** Domains of all active sites, for pre-building at deploy time. */
export const listActiveDomains = cached("active-domains", async (): Promise<string[]> => {
  const { data, error } = await createPublicClient().from("sites").select("domain").eq("status", "active");
  if (error) throw error;
  return ((data ?? []) as { domain: string }[]).map((d) => d.domain);
});

/** All of a site's pages (RLS returns published pages on active sites only). One query, cached, reused by nav, footer, sitemap and link maps. */
export const getSitePages = cached("site-pages", async (siteId: string): Promise<Page[]> => {
  const { data, error } = await createPublicClient()
    .from("pages")
    .select("*")
    .eq("site_id", siteId)
    .order("nav_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Page[]).filter((p) => p.status === "published");
});

export async function getPageByTypes(siteId: string, slug: string, types: PageType[]): Promise<Page | null> {
  const pages = await getSitePages(siteId);
  return pages.find((p) => p.slug === slug && types.includes(p.page_type)) ?? null;
}

/** The published page whose public URL is `path` (e.g. "/about", "/gutters-carmel-in"). */
export async function getPageByPath(siteId: string, path: string): Promise<Page | null> {
  const pages = await getSitePages(siteId);
  return pages.find((p) => p.page_type !== "home" && pagePath(p) === path) ?? null;
}

export async function getFirstPageOfType(siteId: string, type: PageType): Promise<Page | null> {
  const pages = await getSitePages(siteId);
  return pages.find((p) => p.page_type === type) ?? null;
}

// Kept for existing callers.
export const getHubPage = (siteId: string, t: "services_hub" | "locations_hub") => getFirstPageOfType(siteId, t);
export const getSingletonPage = (siteId: string, t: "home" | "about" | "contact") => getFirstPageOfType(siteId, t);
export async function getChildPages(parentPageId: string, siteId?: string): Promise<Page[]> {
  if (siteId) return (await getSitePages(siteId)).filter((p) => p.parent_page_id === parentPageId);
  const { data, error } = await createPublicClient()
    .from("pages")
    .select("*")
    .eq("parent_page_id", parentPageId)
    .order("nav_order", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Page[]).filter((p) => p.status === "published");
}

export const getPageBlocks = cached("page-blocks", async (pageId: string): Promise<PageBlock[]> => {
  const { data, error } = await createPublicClient()
    .from("page_blocks")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PageBlock[];
});

export const getPageImages = cached("page-images", async (pageId: string): Promise<Record<string, PageImage>> => {
  const { data, error } = await createPublicClient()
    .from("page_images")
    .select("id, slot_key, storage_path, alt_text, credit, credit_url")
    .eq("page_id", pageId);
  if (error) throw error;
  const bySlot: Record<string, PageImage> = {};
  for (const img of (data ?? []) as PageImage[]) bySlot[img.slot_key] = img;
  return bySlot;
});

/** 301 lookup for a site's old URLs (e.g. after a WordPress migration). Path is compared without a trailing slash. */
export const getRedirect = cached("redirect", async (siteId: string, path: string): Promise<Redirect | null> => {
  const clean = "/" + path.replace(/^\/+|\/+$/g, "");
  const { data, error } = await createPublicClient()
    .from("redirects")
    .select("from_path, to_path, permanent")
    .eq("site_id", siteId)
    .eq("from_path", clean)
    .maybeSingle();
  if (error) throw error;
  return (data as Redirect) ?? null;
});

/** Public URL path for a page, honoring the fixed routes for home and the singleton/hub types. */
export function pagePath(page: Pick<Page, "page_type" | "slug">): string {
  switch (page.page_type) {
    case "home":
      return "/";
    case "services_hub":
      return "/services";
    case "locations_hub":
      return "/locations";
    case "about":
      return "/about";
    case "contact":
      return "/contact";
    default:
      return `/${page.slug}`;
  }
}

// Kept for older callers.
export async function getPageByTypeAndSlug(siteId: string, type: PageType, slug: string): Promise<Page | null> {
  return getPageByTypes(siteId, slug, [type]);
}
