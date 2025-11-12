import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "export",
    images: { unoptimized: true },
    trailingSlash: true,
    basePath: "/solmate-admin",
    assetPrefix: "/solmate-admin/",
    eslint: { ignoreDuringBuilds: true }
};
export default nextConfig;
