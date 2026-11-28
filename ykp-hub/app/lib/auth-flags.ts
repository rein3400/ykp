/**
 * Feature flags for the (not-yet-active) Google + PIN auth flow.
 *
 * Default is OFF: when the env var is absent or not "1", the existing
 * username/password flow remains the only way in. This keeps the hub
 * non-breaking until GCP OAuth credentials exist.
 *
 * - Server routes read YKP_AUTH_*.
 * - Client components read NEXT_PUBLIC_* (inlined at build time).
 */
export function isGoogleAuthEnabled(): boolean {
  return process.env.YKP_AUTH_GOOGLE_ENABLED === "1";
}

export function isPinAuthEnabled(): boolean {
  return process.env.YKP_AUTH_PIN_ENABLED === "1";
}

export function isGoogleAuthEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED === "1";
}
