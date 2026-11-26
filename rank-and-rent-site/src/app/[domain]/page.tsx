import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFirstPageOfType, getSiteByDomain } from "@/lib/data";
import { PageView, pageMetadata } from "@/lib/render";

export const revalidate = 300;

type Props = { params: Promise<{ domain: string }> };

async function load(domain: string) {
  const site = await getSiteByDomain(domain);
  if (!site) return null;
  const page = await getFirstPageOfType(site.id, "home");
  return page ? { site, page } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load((await params).domain);
  return loaded ? pageMetadata(loaded.site, loaded.page) : {};
}

export default async function HomePage({ params }: Props) {
  const loaded = await load((await params).domain);
  if (!loaded) notFound();
  return <PageView site={loaded.site} page={loaded.page} />;
}
