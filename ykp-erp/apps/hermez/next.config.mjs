/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ykp/ui", "@ykp/schema", "@ykp/auth", "@ykp/engine"],
  images: { unoptimized: true },
  experimental: {
    // Auto-start the Telegram dialog bot at server boot (instrumentation.ts).
    instrumentationHook: true,
  },
};

export default nextConfig;