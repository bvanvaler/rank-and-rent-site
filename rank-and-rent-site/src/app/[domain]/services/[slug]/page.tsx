import { permanentRedirect } from "next/navigation";

// Old nested service URLs (/services/<slug>) now live flat at /<slug>.
export default async function OldServiceUrl({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/${(await params).slug}`);
}
