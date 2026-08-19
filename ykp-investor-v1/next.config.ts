import type { NextConfig } from "next";

const HUB_ORIGIN = process.env.YKP_HUB_ORIGIN ?? "http://187.77.114.168:3000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: `frame-ancestors "self" ${HUB_ORIGIN}` },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" }
];

const config: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};
export default config;
