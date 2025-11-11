// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repo = "/solmate-admin";

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    basePath: isProd ? repo : "",
    assetPrefix: isProd ? repo : "",
    eslint: { ignoreDuringBuilds: true },      // ← skip lint errors
    // typescript: { ignoreBuildErrors: true }, // ← only if TS errors block you
};

export default nextConfig;
