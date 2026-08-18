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
  images: { unoptimized: true },
};

export default nextConfig;
