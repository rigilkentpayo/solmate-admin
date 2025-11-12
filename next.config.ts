// next.config.ts
import type { NextConfig } from "next";
const TARGET = process.env.NEXT_PUBLIC_TARGET || "domain"; // 'domain' | 'ghpages'

const isGhPages = TARGET === "ghpages";
const repo = "/solmate-admin";

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    basePath: isGhPages ? repo : "",
    assetPrefix: isGhPages ? `${repo}/` : "",
    eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
