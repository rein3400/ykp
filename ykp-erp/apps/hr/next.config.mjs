/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ykp/ui", "@ykp/schema", "@ykp/auth", "@ykp/engine", "@ykp/config"],
  images: { unoptimized: true },
};

export default nextConfig;