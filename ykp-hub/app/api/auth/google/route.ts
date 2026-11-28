import { NextResponse } from "next/server";
import { isGoogleAuthEnabled } from "../../../lib/auth-flags";

/**
 * Scaffold for Google sign-in. Inactive until YKP_AUTH_GOOGLE_ENABLED=1 and
 * GCP OAuth credentials are provisioned. Returns 501 so callers can detect
 * "configured off" vs "not implemented".
 */
export async function POST() {
  if (!isGoogleAuthEnabled()) {
    return NextResponse.json(
      { error: { code: "disabled", message: "Google login belum diaktifkan" } },
      { status: 501 }
    );
  }
  return NextResponse.json(
    { error: { code: "not_implemented", message: "Google OAuth belum dikonfigurasi" } },
    { status: 501 }
  );
}
