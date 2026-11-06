/**
 * vessel-graph.worker — a dedicated worker's thread standing in for the vessel worker of the lift's slice 2. The thread offers
 * no `window`, `document`, `localStorage` or `sessionStorage`, and the shim (the first import) strips `location` to a bare `href`, so the
 * vessel's module graph reaches only what a worker's thread holds; a module that reads a page global while it loads faults the
 * worker before it greets.
 */
import { LOCATION_KEYS, PAGE_GLOBALS } from "./worker-global-shim.js";
import * as vessel from "../../src/open-browser-vessel.js";
import * as identity from "../../src/browser-vessel-identity.js";

const scope = globalThis as unknown as {
  addEventListener(type: "message", callback: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
};

const pageGlobals = (): Record<string, string> =>
  Object.fromEntries(PAGE_GLOBALS.map((name) => [name, typeof (globalThis as Record<string, unknown>)[name]]));

scope.addEventListener("message", (event) => {
  const msg = event.data as { op: string; idbName: string };
  void (async () => {
    if (msg.op === "globals") {
      scope.postMessage({ op: msg.op, globals: pageGlobals(), location: LOCATION_KEYS(), opens: typeof vessel.openBrowserVessel });
    } else if (msg.op === "identity") {
      try {
        const id = await identity.generateOrLoadBrowserVesselIdentity(msg.idbName);
        scope.postMessage({ op: msg.op, verifyingKey: id.verifyingKey, refused: null });
      } catch (e) { scope.postMessage({ op: msg.op, verifyingKey: null, refused: e instanceof Error ? e.message : String(e) }); }
    }
  })().catch((e: unknown) => scope.postMessage({ op: msg.op, error: e instanceof Error ? e.message : String(e) }));
});

scope.postMessage({ type: "ready" });
