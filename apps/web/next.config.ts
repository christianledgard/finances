import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for a lean Docker image.
  output: "standalone",
  // We live in a pnpm monorepo, so trace deps from the repo root, not apps/web,
  // otherwise hoisted node_modules are missed in the standalone output.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Load the native MongoDB driver and better-auth via Node's require at runtime
  // instead of bundling them — standard for server-only DB packages.
  serverExternalPackages: ["better-auth", "mongodb"],
};

export default nextConfig;
