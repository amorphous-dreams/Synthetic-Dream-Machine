/**
 * operator-key — resolve the browser operator's auth receipt.
 *
 * Priority order:
 *   1. Server-injected receipt (<meta name="lararium-operator-receipt">) —
 *      set by the server when it detects a local gh-cli session (developer path)
 *      or after a completed OAuth callback.
 *   2. Bluesky AT Proto OAuth session resume — return visit after login.
 *   3. null → caller shows AuthGate.
 *
 * local-dev fallback is NOT applied here. AuthGate is shown for unauthenticated
 * browsers. local-dev is operator-only (server startup, no browser gate).
 */

import { tryResumeBlueSkySession } from "./bluesky-auth.js";
import type { LarAuthReceipt } from "@lararium/core";

/** Read the operator receipt injected by the server (meta tag or GitHub OAuth cookie). */
function readServerInjectedReceipt(): LarAuthReceipt | null {
  if (typeof document === "undefined") return null;

  // Primary: meta tag (gh-cli operator or server-side auth completion)
  const meta = document.querySelector('meta[name="lararium-operator-receipt"]')?.getAttribute("content");
  if (meta) {
    try { return JSON.parse(atob(meta)) as LarAuthReceipt; } catch { /* fall through */ }
  }

  // Secondary: short-lived cookie set after GitHub OAuth callback redirect
  const cookie = document.cookie.split("; ").find((c) => c.startsWith("lararium_auth="));
  if (cookie) {
    const b64 = cookie.split("=")[1];
    if (b64) {
      try {
        const receipt = JSON.parse(atob(b64)) as LarAuthReceipt;
        // Consume it — clear the cookie so it doesn't linger
        document.cookie = "lararium_auth=; Path=/; Max-Age=0";
        return receipt;
      } catch { /* fall through */ }
    }
  }

  return null;
}

let _cached: LarAuthReceipt | null = null;
let _resolved = false;

/**
 * Resolve the operator receipt for this browser session.
 * Returns null if no auth is present — show AuthGate.
 */
export async function getOrCreateBrowserAuthReceipt(): Promise<LarAuthReceipt | null> {
  if (_resolved) return _cached;

  // 1. Server-injected (developer gh-cli path or completed OAuth callback)
  const injected = readServerInjectedReceipt();
  if (injected) { _cached = injected; _resolved = true; return _cached; }

  // 2. Bluesky session resume (return visit or OAuth callback redirect)
  const bluesky = await tryResumeBlueSkySession();
  if (bluesky) { _cached = bluesky; _resolved = true; return _cached; }

  _resolved = true;
  return null;
}

/** Force-clear cached receipt (after sign-out). */
export function clearBrowserAuthReceipt(): void {
  _cached = null;
  _resolved = false;
}
