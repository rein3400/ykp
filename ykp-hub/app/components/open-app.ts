/**
 * Guaranteed module opener.
 *
 * Uses 2-arg window.open (no feature string): the 3-arg form makes Chrome
 * create a synchronous about:blank tab first and KEEPS it in session
 * history, so the Back button inside the module lands on a blank page.
 * When the popup is blocked (automation browsers, strict blockers),
 * falls back to a same-tab navigation so the click always does something.
 */
export function openAppUrl(url: string): void {
  let w: Window | null = null;
  try {
    w = window.open(url, "_blank", "noopener");
  } catch {
    w = null;
  }
  if (!w || w.closed) {
    window.location.href = url;
  }
}
