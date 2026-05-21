import type { NextConfig } from "next";

const isDemoExport = process.env.NEXT_OUTPUT_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const config: NextConfig = {
  reactStrictMode: true,
  output: isDemoExport ? "export" : "standalone",
  basePath,
  trailingSlash: isDemoExport ? true : undefined,
  images: isDemoExport ? { unoptimized: true } : undefined,
  serverExternalPackages: [
    "better-sqlite3",
    "sharp",
    "exiftool-vendored",
    "piscina",
    "@prisma/client",
    ".prisma/client",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  webpack: (cfg) => {
    cfg.externals = cfg.externals || [];
    cfg.externals.push({
      "better-sqlite3": "commonjs better-sqlite3",
    });
    return cfg;
  },
};

export default config;
