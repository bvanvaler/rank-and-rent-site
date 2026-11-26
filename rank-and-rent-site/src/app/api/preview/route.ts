import { NextResponse } from "next/server";

/**
 * Preview any site on the *.vercel.app address before its real domain is
 * pointed here: /api/preview?site=hoosiergutterguys.com sets a cookie that
 * proxy.ts honors ONLY on *.vercel.app hosts (a real custom domain
 * always renders its own site). /api/preview?clear=1 removes it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (!host.endsWith(".vercel.app") && host !== "localhost") {
    return new NextResponse("Not found", { status: 404 });
  }
  const res = NextResponse.redirect(new URL("/", url));
  const site = (url.searchParams.get("site") ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (url.searchParams.get("clear") || !site) {
    res.cookies.delete("preview_site");
  } else if (/^[a-z0-9.-]+$/.test(site)) {
    res.cookies.set("preview_site", site, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}
