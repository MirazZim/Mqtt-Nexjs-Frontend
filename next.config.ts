import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  onDemandEntries: {
    // Keep pages in memory longer to reduce reconnection issues
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
};

export default nextConfig;
