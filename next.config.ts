import type { NextConfig } from "next";

// GitHub Pages serves the repo at /fluxline. Local dev stays at the root.
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/fluxline" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
