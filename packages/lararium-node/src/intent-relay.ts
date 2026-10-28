/** Stand the operator-enabled relay route beside the sealed face gates. */
import { deriveGateBundle, sovereignGateRoot, sovereignRoute, utf8Bytes, INTENT_RELAY_ROUTE, type CustodyRootDoor, type GateBundle, type GateBundlePin, type GateDeadlines, type IntentRelayResult } from "@lararium/mesh";
import type { FaceGateServer, StoodGate } from "./face-gate-server.js";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { makeIntentRelayGate } from "./intent-relay-door.js";
import { enableIntentRelayFace, disableIntentRelayFace, enabledIntentRelayFaces, intentRelayRing } from "./intent-relay-ring.js";
import { intentRelayKeyOrMint } from "./intent-relay-key-store.js";

export interface IntentRelayFace { readonly group: string; readonly admit: (entry: unknown) => Promise<IntentRelayResult> }
export interface IntentRelayService {
  refresh(): Promise<void>;
  standing(): { group: string; path: string; pin: GateBundlePin }[];
  pinOf(group: string): GateBundlePin | null;
  enable(group: string): Promise<GateBundlePin>;
  disable(group: string): Promise<void>;
  close(): void;
}
export async function standIntentRelay(ports: {
  readonly gateServer: FaceGateServer;
  readonly dispatcher?: HttpFaceDispatcher;
  readonly rootDoor: CustodyRootDoor;
  readonly deadlines: GateDeadlines;
  readonly faces: (group: string) => Promise<IntentRelayFace | null>;
  readonly log: (message: string) => void;
}): Promise<IntentRelayService> {
  const stood = new Map<string, { bundle: GateBundle; at: StoodGate; unregister?: () => void }>();
  const ring = intentRelayRing();
  let closed = false;
  let floorSaid = false;
  const down = (group: string): void => {
    const held = stood.get(group);
    if (!held) return;
    held.unregister?.(); held.at.unstand(); held.bundle.drop(); stood.delete(group);
  };
  // One refresh at a time: a stand and a stand-down never interleave over the same group.
  let turn: Promise<void> = Promise.resolve();
  const service: IntentRelayService = {
    refresh() { const next = turn.then(sweep, sweep); turn = next.catch(() => {}); return next; },
    standing() { return [...stood].map(([group, held]) => ({ group, path: held.at.path, pin: held.bundle.pin })); },
    pinOf(group) { return stood.get(group)?.bundle.pin ?? null; },
    async enable(group) { await intentRelayKeyOrMint(); await enableIntentRelayFace(group); await service.refresh(); const pin = service.pinOf(group); if (!pin) throw new Error("intent-relay: enabled face did not stand"); return pin; },
    async disable(group) { await disableIntentRelayFace(group); await service.refresh(); },
    close() { closed = true; for (const group of [...stood.keys()]) down(group); },
  };
  async function sweep(): Promise<void> {
    {
      if (closed) return;
      let enabled: readonly string[];
      try { enabled = await enabledIntentRelayFaces(); }
      catch {
        for (const group of [...stood.keys()]) down(group);
        if (!floorSaid) { floorSaid = true; ports.log("[lar-gate] intent relay rests shut while vessel custody stays locked"); }
        return;
      }
      const wanted = new Set(enabled);
      for (const group of [...stood.keys()]) if (!wanted.has(group)) down(group);
      for (const group of wanted) {
        let face: IntentRelayFace | null;
        try { face = await ports.faces(group); }
        catch (error) { down(group); ports.log(`[lar-gate] intent relay skipped face ${group}: ${String(error)}`); continue; }
        if (!face || face.group !== group) { down(group); continue; }
        if (stood.has(group)) continue;
        let bundle: GateBundle;
        try { bundle = deriveGateBundle(sovereignGateRoot(ports.rootDoor), utf8Bytes(group), sovereignRoute(INTENT_RELAY_ROUTE)); }
        catch { if (!floorSaid) { floorSaid = true; ports.log("[lar-gate] intent relay rests shut while vessel custody stays locked"); } continue; }
        const gate = makeIntentRelayGate({ bundle, group, ring, admit: face.admit, deadlines: ports.deadlines });
        try {
          const at = ports.gateServer.stand({ gate, pin: bundle.pin });
          const unregister = ports.dispatcher?.registerUpgrade({ name: `intent-relay:${at.path}`, path: at.path, handle: (req, socket, head) => { if (!ports.gateServer.handleUpgrade(req, socket, head)) socket.destroy(); } });
          stood.set(group, { bundle, at, ...(unregister ? { unregister } : {}) });
          ports.log(`[lar-gate] intent relay for face ${group.slice(0, 18)}… stands on ${at.path}`);
        } catch (error) { bundle.drop(); throw error; }
      }
    }
  }
  await service.refresh();
  return service;
}
