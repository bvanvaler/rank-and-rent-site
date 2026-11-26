import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    // Images are served from each site's own domain (/media/...), so no
    // shared storage hostname shows up across sites.
    return supabaseUrl
      ? [{ source: "/media/:path*", destination: `${supabaseUrl}/storage/v1/object/public/page-images/:path*` }]
      : [];
  },
};

export default nextConfig;
