/**
 * Unregistered train W built-image witness scaffold. The mesh Vitest include excludes dotfiles.
 * Unskip NO_OLD_WIRE_PRODUCTION_CALLER in the assembled socket cutover commit;
 * unskip the trace cases when that SAME commit adds its built-image driver. The driver
 * must observe real frames and session delivery; a missing trace always reads red.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

type DialReading = {
  hearth: string;
  nexus: string;
  face: string;
  pin: string;
  firstFlight: string;
  firstApplicationFrameSent: string;
  firstApplicationFrameReceived: string;
  deliveries: number;
  openedBeforeDelivery: boolean;
  announcementVerifiedByWirePin: boolean;
  oldFrameTypes: string[];
  vesselKeyGateProofs: number;
};
type BuiltImageTrace = {
  imageHead: string;
  throughTerminator: boolean;
  selectedProtocol: string;
  headerBytes: number;
  tokenSeenInRetainedLogs: boolean;
  receiverRestarted: boolean;
  withdrawalRemembered: boolean;
  reissuedFaceOpenedSession: boolean;
  dials: DialReading[];
  disabledRoutes: string[];
  shutdownRefusals: Record<string, string>;
};

function readBuiltImageTrace(): BuiltImageTrace {
  const text = process.env.LAR_W_BUILT_IMAGE_TRACE;
  if (!text) throw new Error("W built-image driver has not supplied LAR_W_BUILT_IMAGE_TRACE");
  return JSON.parse(text) as BuiltImageTrace;
}

describe("train W witness scaffold control", () => {
  test("the trace reader refuses an absent driver result", () => {
    const prior = process.env.LAR_W_BUILT_IMAGE_TRACE;
    delete process.env.LAR_W_BUILT_IMAGE_TRACE;
    try { expect(readBuiltImageTrace).toThrow("has not supplied"); }
    finally { if (prior === undefined) delete process.env.LAR_W_BUILT_IMAGE_TRACE; else process.env.LAR_W_BUILT_IMAGE_TRACE = prior; }
  });
});

describe.skip("train W built-image crossing witness", () => {
  test("NO_OLD_WIRE_PRODUCTION_CALLER: every enabled production dial leaves the retired handshake", () => {
    const routes = [
      { name: "websocket-adapter", path: "../src/lar-ws-client-adapter.ts" },
      { name: "oracle-reader", path: "../src/oracle-read-client.ts" },
      { name: "sibling-channel", path: "../src/sibling-channel.ts" },
      { name: "node-relay", path: "../../lararium-node/src/authenticated-membership-relay.ts" },
    ];
    const traceText = process.env.LAR_W_BUILT_IMAGE_TRACE;
    const trace = traceText ? JSON.parse(traceText) as BuiltImageTrace : null;
    for (const { name, path } of routes) {
      if (trace?.disabledRoutes.includes(name)) {
        expect(trace.shutdownRefusals[name], name).toMatch(/^route-shut:/);
        continue;
      }
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(/^import .*\brunPeerHandshake\b/m.test(source), path).toBe(false);
      expect(/\brunPeerHandshake\s*\(/.test(source), path).toBe(false);
    }
    expect(trace, "a built-image trace must prove enabled and shut routes").not.toBeNull();
    if (!trace) return;
    expect(trace.dials.length).toBeGreaterThanOrEqual(4);
    for (const dial of trace.dials) {
      expect(dial.firstFlight).toBe("Noise_IK_25519_ChaChaPoly_SHA256");
      expect(dial.oldFrameTypes).toEqual([]);
      expect(dial.vesselKeyGateProofs).toBe(0);
    }
  });

  test("VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME: frame one survives attach, verdict and open", () => {
    const trace = readBuiltImageTrace();
    expect(trace.imageHead).toMatch(/^[0-9a-f]{40,64}$/);
    expect(trace.throughTerminator).toBe(true);
    expect(trace.selectedProtocol).toBeTruthy();
    expect(trace.headerBytes).toBeGreaterThan(0);
    expect(trace.headerBytes).toBeLessThanOrEqual(4096);
    expect(trace.tokenSeenInRetainedLogs).toBe(false);
    expect(trace.receiverRestarted).toBe(true);
    expect(trace.withdrawalRemembered).toBe(true);
    expect(trace.reissuedFaceOpenedSession).toBe(true);
    for (const dial of trace.dials) {
      expect(dial.openedBeforeDelivery).toBe(true);
      expect(dial.firstApplicationFrameReceived).toBe(dial.firstApplicationFrameSent);
      expect(dial.deliveries).toBe(1);
      expect(dial.announcementVerifiedByWirePin).toBe(true);
    }
  });

  test("PAIR_INDEXED_DIALS: two faces, two Nexuses and two hearths keep their routes and pins", () => {
    const trace = readBuiltImageTrace();
    expect(new Set(trace.dials.map(d => d.face)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(trace.dials.map(d => d.nexus)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(trace.dials.map(d => d.hearth)).size).toBeGreaterThanOrEqual(2);
    const routePins = new Map<string, string>();
    for (const dial of trace.dials) {
      const pair = `${dial.hearth}\0${dial.nexus}`;
      const prior = routePins.get(pair);
      if (prior) expect(dial.pin).toBe(prior);
      else routePins.set(pair, dial.pin);
    }
    expect(new Set(routePins.values()).size).toBe(routePins.size);
  });
});
