/** In-realm production holder witness: a lock lives exactly as long as its island port. */
import { deviceEdgeDigest } from "@lararium/mesh/holder-session-proof";
import type { BrowserIslandScope } from "../../src/browser-sovereign-island-model.js";

export function startIsland(scope: BrowserIslandScope): void {
  const id = new URL(self.location.href).searchParams.get("id");
  if (!id) throw new Error("stub island needs a lock id");
  const controller = new AbortController();
  void navigator.locks.request(`island:${id}:${(self as unknown as { name: string }).name}`, { signal: controller.signal }, async () =>
    new Promise<void>((resolve) => { scope.onStop?.(resolve); })).catch((error) => {
      if (!controller.signal.aborted) throw error;
    });
  scope.onStop?.(() => controller.abort());
  scope.listen((raw) => {
    const message = raw as { type?: string; daemonAuth?: { deviceEdge?: Parameters<typeof deviceEdgeDigest>[0] } };
    if (message?.type === "teardown") { scope.post({ type: "teardown:ack" }); return; }
    if (message?.type !== "manifest") return;
    const edge = message.daemonAuth?.deviceEdge;
    if (!edge) throw new Error("manifest names no device edge");
    scope.post({ type: "gate:clear", edgeDigest: deviceEdgeDigest(edge), personaRoot: edge.personaRootDid } as never);
  });
  scope.ready();
}
