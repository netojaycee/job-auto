import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is what apps/web/Dockerfile copies into the runtime image.
  output: "standalone",
  // pdf-parse (via pdfjs-dist) resolves its worker script relative to its own
  // module file at runtime — bundling it rewrites that into a chunk path that
  // doesn't exist on disk ("Setting up fake worker failed"), breaking every
  // PDF CV upload. Excluding it from bundling leaves Node's native module
  // resolution in place, which pdfjs already handles correctly.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
