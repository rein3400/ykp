import type { NextConfig } from 'next';

/**
 * Security headers per anti-fraud/ops hardening blueprint.
 * - nosniff: stop MIME-type confusion attacks
 * - frame policy: SAMEORIGIN + hub origin (Hub portal may embed this app;
 *   arbitrary third-party framing stays blocked)
 * - strict referrer: don't leak internal URLs
 * - camera/mic off; geolocation allowed (scale/receiving devices may use it)
 */
const HUB_ORIGIN = process.env.YKP_HUB_ORIGIN ?? 'http://187.52.124.40:3000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${HUB_ORIGIN}` },
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
