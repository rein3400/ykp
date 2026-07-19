/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Portal design: the Hub embeds the other YKP apps — framing stays open.
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          // Security hardening (2026-07-18): was missing per verification report.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
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
