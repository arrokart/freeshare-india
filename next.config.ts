import type { NextConfig } from "next";

const r2Domain = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL).hostname
  : "*.r2.dev";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: r2Domain,
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      }
    ],
  },
};

export default nextConfig;
