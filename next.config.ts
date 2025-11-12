// next.config.ts
import type { NextConfig } from "next";

const deploy = process.env.DEPLOY_TARGET ?? process.env.NEXT_PUBLIC_TARGET ?? "";
const isProd = process.env.NODE_ENV === "production";
// Only treat as gh-pages when building for production
const isGhPages = isProd && deploy === "ghpages";
const repo = "/solmate-admin";

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    // In dev: no basePath/assetPrefix -> avoids 404 for HMR/chunks
    basePath: isGhPages ? repo : "",
    assetPrefix: isGhPages ? `${repo}/` : "",
    eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
