import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exempeldata och tidkoder läses från disk på servern och måste följa med vid driftsättning.
  outputFileTracingIncludes: { "/**": ["./data/**"] },
};

export default nextConfig;
