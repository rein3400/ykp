import type { NextConfig } from 'next';

/**
 * Security headers per anti-fraud/ops hardening blueprint.
 * - nosniff: stop MIME-type confusion attacks
 * - frame policy: SAMEORIGIN + hub origin (the Hub portal embeds this app via
 *   its proxy rewrites; arbitrary third-party framing stays blocked)
 * - strict referrer: don't leak internal URLs
 * - camera/mic off; geolocation allowed (attendance clock-in uses it)
 */
const HUB_ORIGIN = process.env.YKP_HUB_ORIGIN ?? 'https://ykp-hub-production.up.railway.app';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${HUB_ORIGIN}` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }
];

const config: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' }
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default config;
