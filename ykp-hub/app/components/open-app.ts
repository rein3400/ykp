/** Open a module in a protected new tab, or navigate here if the popup cannot be used. */
export function openAppUrl(url: string): void {
  const protocol = new URL(url, window.location.href).protocol;
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('Module URLs must use HTTP or HTTPS');
  }
  let popup: Window | null = null;
  try {
    // A successful open with the noopener feature returns null in Chromium,
    // falsely triggering the blocked-popup fallback. Retain the handle and
    // sever its opener synchronously, before the requested document loads.
    popup = window.open(url, '_blank');
    if (popup && !popup.closed) {
      popup.opener = null;
      if (popup.opener === null) return;
    }
  } catch {
    // A blocked open or unverifiable opener must use the safe fallback below.
  }
  try {
    if (popup && !popup.closed) popup.close();
  } catch {
    // Hardened contexts may disallow closing; never perform another popup open.
  }
  window.location.href = url;
}
