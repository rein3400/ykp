import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isGoogleAuthEnabled,
  isPinAuthEnabled,
  isGoogleAuthEnabledClient,
} from "../app/lib/auth-flags.ts";

test("off by default", () => {
  delete process.env.YKP_AUTH_GOOGLE_ENABLED;
  delete process.env.YKP_AUTH_PIN_ENABLED;
  delete process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED;
  assert.equal(isGoogleAuthEnabled(), false);
  assert.equal(isPinAuthEnabled(), false);
  assert.equal(isGoogleAuthEnabledClient(), false);
});

test("on when set to 1", () => {
  process.env.YKP_AUTH_GOOGLE_ENABLED = "1";
  process.env.YKP_AUTH_PIN_ENABLED = "1";
  process.env.NEXT_PUBLIC_YKP_AUTH_GOOGLE_ENABLED = "1";
  assert.equal(isGoogleAuthEnabled(), true);
  assert.equal(isPinAuthEnabled(), true);
  assert.equal(isGoogleAuthEnabledClient(), true);
});
