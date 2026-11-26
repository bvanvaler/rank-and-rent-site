import { NextResponse, type NextRequest } from "next/server";

/**
 * Multi-tenant routing. Every request is rewritten to /<domain>/<path>, so
 * each site's pages are separate static (ISR) entries cached on the CDN --
 * served like plain HTML files, never assembled from the database per visit.
 *
 * The shared *.vercel.app address shows the site picked by the
 * preview_site cookie (set by /api/preview) and is always noindex.
 */
export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase().replace(/^www\./, "");
  const isPreviewHost = host.endsWith(".vercel.app") || host === "localhost";
  const { pathname, search } = request.nextUrl;

  if (isPreviewHost && pathname === "/robots.txt") {
    return new NextResponse("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
  }

  const domain = isPreviewHost
    ? request.cookies.get("preview_site")?.value || process.env.DEV_DEFAULT_DOMAIN || ""
    : host;
  if (!/^[a-z0-9.-]+$/.test(domain)) return new NextResponse("Not found", { status: 404 });

  const url = request.nextUrl.clone();
  url.pathname = `/${domain}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const res = NextResponse.rewrite(url);
  if (isPreviewHost) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Skip framework assets, API routes, proxied images and root static files.
  matcher: ["/((?!api/|_next/|media/|favicon.ico).*)"],
};
