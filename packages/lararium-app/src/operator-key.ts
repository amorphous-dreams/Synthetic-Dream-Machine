/**
 * Browser auth session seed.
 *
 * Slate-clean model: the browser no longer mints Ed25519 / UCAN credentials.
 * BlueSky OAuth will own public web identity once elyncia.app can serve the
 * provider metadata and callback. GitHub sign-in belongs to the VS Code /
 * VS Code Insiders local UX path, not this browser helper.
 *
 * For now this file only emits a local-dev receipt so the existing local app can
 * keep booting while the real provider bridges land.
 */

import { createLocalDevReceipt, type LarAuthReceipt } from "@lararium/core";

let _cached: LarAuthReceipt | null = null;

export async function getOrCreateBrowserAuthReceipt(): Promise<LarAuthReceipt> {
  if (!_cached) _cached = createLocalDevReceipt("browser-local-operator");
  return _cached;
}
