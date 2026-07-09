/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ykp/ui", "@ykp/schema", "@ykp/auth", "@ykp/engine"],
  experimental: { serverComponentsExternalPackages: ["bullmq", "ioredis", "postgres"] },
  images: { unoptimized: true },
};

export default nextConfig;