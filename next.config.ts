// next.config.ts
import type { NextConfig } from "next";

const target = process.env.NEXT_PUBLIC_TARGET; // "ghpages" or "domain"
const repo = "/solmate-admin";

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    eslint: { ignoreDuringBuilds: true },
    // Use subpath only when building for GitHub Pages
    basePath: target === "ghpages" ? repo : "",
    assetPrefix: target === "ghpages" ? `${repo}/` : "",
};

export default nextConfig;
