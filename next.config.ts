import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite reads its WASM/binary files in Node; do not bundle them for the browser.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Permit Arena's HTTPS preview proxy, without allowing arbitrary dev origins.
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  // Runtime initialization also works in traced/standalone deployments.
  outputFileTracingIncludes: {
    "/api/**/*": ["./drizzle/**/*"],
  },
  outputFileTracingExcludes: {
    "/api/**/*": ["./data/**/*", "./.cache/**/*", "./.git/**/*", "./.env*", "./tests/**/*", "./test-results/**/*"],
  },
};

export default nextConfig;
