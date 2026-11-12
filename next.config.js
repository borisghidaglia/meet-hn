/** @type {import('next').NextConfig} */

const nextConfig = {
  // Dev only: Next 16 blocks dev assets (HMR, client chunks such as the map)
  // for origins other than localhost. Add more hosts, e.g. a Tailscale name
  // for testing on a phone, with DEV_ORIGINS=host1,host2.
  allowedDevOrigins: ["127.0.0.1", ...(process.env.DEV_ORIGINS?.split(",") ?? [])],
  // The first links (before Sept 2024) were meet.hn/?city=<id>; the city page
  // then redirects old ids to their current page.
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "query", key: "city", value: "(?<city>.+)" }],
        destination: "/city/:city",
        permanent: true,
      },
    ];
  },
  // The only raster images are two ~2 KB social icons: serve them as they are
  // instead of through (billed) Image Optimization. Logos are SVG, already
  // served as is.
  images: { unoptimized: true },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

const withVercelToolbar = require("@vercel/toolbar/plugins/next")();
module.exports = withVercelToolbar(nextConfig);
