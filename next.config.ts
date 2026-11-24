import type { NextConfig } from "next";

// GitHub Pages serves the repo at /fluxline. Local dev stays at the root.
const basePath = process.env.GITHUB_ACTIONS === "true" ? "/fluxline" : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  devIndicators: false,
  images: { unoptimized: true },
  env: {
    // Exposed to the client so committed assets resolve under the Pages
    // base path in production and at the root in local development.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
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
