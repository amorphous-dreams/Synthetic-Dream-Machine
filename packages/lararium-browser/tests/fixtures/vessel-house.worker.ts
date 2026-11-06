/**
 * vessel-house.worker — a second vessel worker on the same origin: it stands a house over a store the test names (and refuses
 * `store-owned` where another worker owns it), or holds a tab's session lifetime lock until the test terminates it.
 */
import { standVesselHouse, VesselSessionRefused } from "../../src/vessel-sessions.js";

const scope = globalThis as unknown as {
  addEventListener(type: "message", callback: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
};

scope.addEventListener("message", (event) => {
  const msg = event.data as { op: string; idbName?: string; lock?: string };
  void (async () => {
    if (msg.op === "stand") {
      try {
        const house = await standVesselHouse({ idbName: msg.idbName!, light: () => Promise.resolve({ close: () => Promise.resolve() }) });
        scope.postMessage({ op: msg.op, ownerEpoch: house.ownerEpoch, refused: null });
      } catch (e) {
        scope.postMessage({ op: msg.op, ownerEpoch: null, refused: e instanceof VesselSessionRefused ? e.refusal : String(e) });
      }
    } else if (msg.op === "hold-lock") {
      await new Promise<void>((granted) => {
        void navigator.locks.request(msg.lock!, () => { granted(); return new Promise<void>(() => { /* held for this worker's life */ }); });
      });
      scope.postMessage({ op: msg.op, held: true });
    }
  })().catch((e: unknown) => scope.postMessage({ op: msg.op, error: String(e) }));
});

scope.postMessage({ type: "ready" });
