import { NextResponse } from "next/server";
import { isPinAuthEnabled } from "../../../lib/auth-flags";

/**
 * Scaffold for the PIN second factor. Inactive until YKP_AUTH_PIN_ENABLED=1
 * and per-user PIN storage exists. Returns 501 while disabled.
 */
export async function POST() {
  if (!isPinAuthEnabled()) {
    return NextResponse.json(
      { error: { code: "disabled", message: "Login PIN belum diaktifkan" } },
      { status: 501 }
    );
  }
  return NextResponse.json(
    { error: { code: "not_implemented", message: "Login PIN belum dikonfigurasi" } },
    { status: 501 }
  );
}
