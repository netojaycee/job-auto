import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is what apps/web/Dockerfile copies into the runtime image.
  output: "standalone",
};

export default nextConfig;
