/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ykp/schema",
    "@ykp/engine",
    "@ykp/auth",
    "@ykp/ui",
    "@ykp/config",
    "@ykp/format",
  ],
  // Native modules + worker deps must not be bundled by webpack (Node-only).
  // Next 14: experimental.serverComponentsExternalPackages; Next 15+: serverExternalPackages.
  experimental: {
    serverComponentsExternalPackages: ["bullmq", "ioredis", "drizzle-orm", "postgres", "pg"],
  },
  images: { unoptimized: true },
};

export default nextConfig;
