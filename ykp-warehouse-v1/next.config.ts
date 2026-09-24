import type { NextConfig } from 'next';

/**
 * Security headers per anti-fraud/ops hardening blueprint.
 * - nosniff: stop MIME-type confusion attacks
 * - frame policy: SAMEORIGIN + hub origin (Hub portal may embed this app;
 *   arbitrary third-party framing stays blocked)
 * - strict referrer: don't leak internal URLs
 * - camera/mic off; geolocation allowed (scale/receiving devices may use it)
 */
// YKP_HUB_ORIGIN accepts one or more origins (space/comma separated) so the Hub
// can embed this app whether it is opened via its HTTPS domain or the host IP.
const HUB_ORIGINS = (process.env.YKP_HUB_ORIGIN ?? 'http://187.52.124.40:3000')
  .split(/[\s,]+/)
  .map((o) => o.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${HUB_ORIGINS.join(' ')}` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' }
];

const config: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '8mb' }
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};

export default config;
