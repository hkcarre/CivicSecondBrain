import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 15+: moved out of experimental
  serverExternalPackages: ["pdf-parse"],
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "CivicSecondBrain",
    NEXT_PUBLIC_CITY_NAME: process.env.NEXT_PUBLIC_CITY_NAME ?? "Schertz",
    NEXT_PUBLIC_CITY_STATE: process.env.NEXT_PUBLIC_CITY_STATE ?? "TX",
  },
};

export default nextConfig;
