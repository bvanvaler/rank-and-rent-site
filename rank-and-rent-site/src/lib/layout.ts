import type { SiteTheme } from "@/lib/types";

/**
 * Per-site layout choices (sites.theme.layout). Each microsite gets its own
 * mix, so sites in the network don't share one look and page structure.
 * Missing values fall back to the original design.
 */
export const LAYOUT_OPTIONS = {
  header: ["stacked", "bar", "centered"],
  hero: ["right", "left", "overlay"],
  cards: ["2", "3", "4"],
  cardStyle: ["shadow", "flat", "outline"],
  shape: ["soft", "square", "round"],
  font: ["classic", "modern", "bold", "friendly", "traditional", "clean"],
  heads: ["left", "center"],
  footer: ["dark", "light"],
  bandEvery: ["3", "4", "0"],
  townBands: ["yes", "no"],
} as const;

export type LayoutKey = keyof typeof LAYOUT_OPTIONS;
export type Layout = { [K in LayoutKey]: (typeof LAYOUT_OPTIONS)[K][number] };

export const DEFAULT_LAYOUT: Layout = {
  header: "stacked",
  hero: "right",
  cards: "3",
  cardStyle: "shadow",
  shape: "soft",
  font: "classic",
  heads: "left",
  footer: "dark",
  bandEvery: "3",
  townBands: "yes",
};

export function layoutOf(theme: SiteTheme | null | undefined): Layout {
  // theme.layout is stored in the sites.theme jsonb column.
  const saved = ((theme as { layout?: Record<string, string> } | null | undefined)?.layout ?? {}) as Partial<Record<LayoutKey, string>>;
  const out = { ...DEFAULT_LAYOUT } as Record<LayoutKey, string>;
  for (const k of Object.keys(LAYOUT_OPTIONS) as LayoutKey[]) {
    const v = saved[k];
    if (v && (LAYOUT_OPTIONS[k] as readonly string[]).includes(v)) out[k] = v;
  }
  return out as Layout;
}

/** How many wide photos a page gets, and how often: shared with the admin's Photos page. */
export function bandRule(layout: Layout, pageType: string): number {
  if (pageType === "location" && layout.townBands === "no") return 0;
  return Number(layout.bandEvery);
}
