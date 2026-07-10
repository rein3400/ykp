/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/finance/:path*", destination: "https://ykp-erp-finance-production.up.railway.app/:path*" },
      { source: "/hr-prod/:path*", destination: "https://ykp-erp-hr-production.up.railway.app/:path*" },
      { source: "/hermez/:path*", destination: "https://ykp-erp-hermez-production.up.railway.app/:path*" },
      { source: "/hr-v1/:path*", destination: "https://ykp-hr-v1-standalone-production.up.railway.app/:path*" },
    ];
  },
};
export default nextConfig;
