import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Flushes the CMS data cache (tag "cms") so a publish in the admin shows up
 * immediately instead of within the 5-minute cache window. The admin calls
 * this with REVALIDATE_SECRET after saves; nothing else can trigger it.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = req.headers.get("x-revalidate-secret");
  if (!secret || given !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  revalidateTag("cms", { expire: 0 });
  return NextResponse.json({ ok: true });
}
