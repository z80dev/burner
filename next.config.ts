import type { NextConfig } from "next";

/** Set by GitHub Actions (and optionally locally) for https://z80.wtf/burner */
const basePath = process.env.GITHUB_PAGES === "true" ? "/burner" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  serverExternalPackages: ["pino", "thread-stream"],
};

export default nextConfig;
