import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ETORO_API_BASE_URL: process.env.ETORO_API_BASE_URL || "https://www.etoro.com",
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;

