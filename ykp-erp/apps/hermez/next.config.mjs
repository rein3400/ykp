/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ykp/ui", "@ykp/schema", "@ykp/auth", "@ykp/engine"],
  images: { unoptimized: true },
};

export default nextConfig;