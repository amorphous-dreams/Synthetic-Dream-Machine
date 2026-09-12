/**
 * phone-seat — THE PHONE SEAT EXPLAINS AND OFFERS (basket-one #/the-phone-seat, ruled 2026-09-11).
 *
 * A family phone reaches the household hearth through a tab. WebKit clears a tab-origin's storage after seven
 * days of Safari use without interaction on it; a Home Screen install exempts it. The hearth EXPLAINS that
 * clock and OFFERS the install — never demands it (a hearth that demands an install reads as a platform; one
 * that explains reads as a shrine). Projection stays the node's: this line touches no folder, no drawer.
 *
 * ONE line renders, and only when ALL four hold: a secure context (off one, nothing mints and the line would
 * point at a seat that cannot stand) · the page does NOT already stand installed (`navigator.standalone` on
 * iOS, `display-mode: standalone` elsewhere) · the engine reads WebKit (the seven-day clock is WebKit's) ·
 * the eviction class reads best-effort (a persisted origin has no clock). Pure: every reading rides in.
 */

export interface PhoneSeatHost {
  readonly isSecureContext: boolean;
  /** iOS Safari's `navigator.standalone` — true when launched from the Home Screen. */
  readonly standalone: boolean;
  /** `matchMedia("(display-mode: standalone)").matches` — the cross-engine reading of the same fact. */
  readonly displayModeStandalone: boolean;
  readonly userAgent: string;
  /** The eviction class `requestDurableStorage` read. */
  readonly persistence: "persistent" | "best-effort" | "unknown";
}

/** Safari / WebKit — the engine whose seven-day clock this line explains. Blink browsers wear "AppleWebKit"
 *  in their UA and keep no such clock, so "Chrome" / "Chromium" / "Edg" / "CriOS" / "FxiOS"-less Safari it is. */
export function readsWebKitSevenDay(userAgent: string): boolean {
  if (!/AppleWebKit/.test(userAgent)) return false;
  if (/Chrome|Chromium|CriOS|Edg\/|OPR\/|SamsungBrowser/.test(userAgent)) return false;
  return /Safari|iPhone|iPad|Macintosh/.test(userAgent);
}

/** The one explaining line, or null when no clock stands on this seat. */
export function phoneSeatExplanation(host: PhoneSeatHost): string | null {
  if (!host.isSecureContext) return null;
  if (host.standalone || host.displayModeStandalone) return null;
  if (host.persistence !== "best-effort") return null;
  if (!readsWebKitSevenDay(host.userAgent)) return null;
  return "this vessel lives in a tab: Safari clears a tab's storage after seven days without a visit — " +
         "install it to the Home Screen (Share → Add to Home Screen) to keep this vessel past seven days — an offer; the tab stands either way";
}

/** Read the ambient host — the browser's own readings, each guarded so a missing API reads as "not". */
export function ambientPhoneSeatHost(persistence: PhoneSeatHost["persistence"]): PhoneSeatHost {
  const g = globalThis as unknown as {
    isSecureContext?: boolean;
    navigator?: { standalone?: boolean; userAgent?: string };
    matchMedia?: (q: string) => { matches: boolean };
  };
  let displayModeStandalone = false;
  try { displayModeStandalone = g.matchMedia?.("(display-mode: standalone)")?.matches === true; } catch { /* no matchMedia */ }
  return {
    isSecureContext: g.isSecureContext === true,
    standalone: g.navigator?.standalone === true,
    displayModeStandalone,
    userAgent: g.navigator?.userAgent ?? "",
    persistence,
  };
}
