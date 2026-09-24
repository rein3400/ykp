import type { NextConfig } from "next";

// YKP_HUB_ORIGIN accepts one or more origins (space/comma separated) so the Hub
// can embed this app whether it is opened via its HTTPS domain or the host IP.
const HUB_ORIGINS = (process.env.YKP_HUB_ORIGIN ?? "http://187.52.124.40:3000")
  .split(/[\s,]+/)
  .map((o) => o.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${HUB_ORIGINS.join(" ")}` },
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
