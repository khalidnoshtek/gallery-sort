import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
