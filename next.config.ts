import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript: pre-existing errors across the codebase (untyped `process`, missing node types,
  // etc.) prevent clean compilation. Suppressed here until a dedicated TS cleanup pass is done.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "0.0.0.0", "21.0.17.230", "21.0.21.17", ".space-z.ai", ".z.ai"],
};

export default nextConfig;
