/**
 * active-tw5 — module-level TW5 accessor.
 *
 * TW5 is a first-class citizen, not a React dependency.
 * Any code (tldraw callbacks, MCP handlers, tests) calls getActiveTW5()
 * without needing React context or prop threading.
 *
 * lararium-browser-host calls setActiveTW5(instance) after boot and
 * setActiveTW5(null) on room teardown. Server code sets it after
 * getServerSingleton() resolves.
 */

import type { LarariumTW5 } from "./lararium-tw5.js";

let _active: LarariumTW5 | null = null;

export function setActiveTW5(tw5: LarariumTW5 | null): void {
  _active = tw5;
}

export function getActiveTW5(): LarariumTW5 | null {
  return _active;
}
