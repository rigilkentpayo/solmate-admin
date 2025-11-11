// next.config.ts
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repo = "/solmate-admin"; // must start with a slash

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    basePath: isProd ? repo : "",
    assetPrefix: isProd ? `${repo}/` : "",
    eslint: { ignoreDuringBuilds: true },      // skip lint errors during build
    // typescript: { ignoreBuildErrors: true }, // enable only if type errors block build
};

export default nextConfig;
