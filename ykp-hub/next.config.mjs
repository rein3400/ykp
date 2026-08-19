/** @type {import(next).NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/finance/:path*", destination: "http://localhost:3003/:path*" },
      { source: "/hr-prod/:path*", destination: "http://localhost:3002/:path*" },
      { source: "/hermez/:path*", destination: "http://localhost:3004/:path*" },
      { source: "/hr-v1/:path*", destination: "http://localhost:3008/:path*" },
    ];
  },
};
export default nextConfig;
