/**
 * floor-fleet-lanes.test — at the floor every fleet lane stays shut.
 *
 * F1 THE SIBLING LANE CARRIES NOTHING AT THE FLOOR. A proven sibling, under a sibling gate that would hand it its
 *    face's plane, draws false through the floor ring. Control: the same ask through the built ring carries.
 * F2 THE SORTER READS EVERY DEVICE AS SET ASIDE. Control: the built ring sets the same key aside for nobody.
 * F3 A PEER ON NEITHER LANE KEEPS WHAT THE BUILT RING ANSWERS. An in-process island still shares; a peer the built
 *    ring sets aside stays aside.
 * F5 THE FETCH DOOR SERVES NO FLEET AT THE FLOOR. Socket B's cleartext tier answers a fleet peer alone, and a floor
 *    composition reads no peer as fleet, the pinned join gate's key included: its ask draws Mu. Control: under a
 *    predicate that reads the same key as fleet the door serves the blob. The weld pins the floor arm in the
 *    composition's own `fleet:` line.
 * F4 THE COMPOSITION WEARS THIS RING AT THE FLOOR (a source weld, comments stripped, with its strip pinned): one
 *    call, on the floor arm of the sovereign choice, fed by the sibling channel's proven key; the share verdict and
 *    the sorter both read the ring that choice stood.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { interpretAsDocumentId, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import type { EdgeShadowRing } from "../src/edge-shadow-ring.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { sha256HexBytesSync } from "@lararium/mesh";
import { floorShadowRing, noFleetAtTheFloor } from "../src/floor-fleet-lanes.js";
import { decideAndServeWantBlock, type CasWireServerDeps } from "../src/cas-wire.js";
import { makeSealedPlaneRegistry } from "../src/plane-seal.js";
import { membershipOf, antigenOf } from "./cas-test-setup.js";
import { selfSlotShareDecision } from "../src/self-slot-share.js";

const docId = (): DocumentId => interpretAsDocumentId(new Uint8Array(randomBytes(16)) as BinaryDocumentId);
const FACE_PLANE = docId();
const SIBLING = "sibling-peer";
const SET_ASIDE = "peer-the-built-ring-set-aside";

/** The ring a composition builds, as the two consults read it: it sets one named peer aside and no device. */
const built = {
  aside: (peerId: string) => peerId === SET_ASIDE,
  deviceAside: () => false,
  memberAside: () => () => false,
  standsInRealm: () => false,
  realmBoards: () => new Map(),
  fleetBoardUrls: () => [],
  refold: async () => { throw new Error("unused"); },
  dispose: () => undefined,
  fold: () => null,
} as unknown as EdgeShadowRing;
const floor = floorShadowRing(built, (peerId) => peerId === SIBLING);

/** A sibling gate that hands the proven sibling its face's plane. */
const siblingGate = { mayFederate: async (documentId: DocumentId, peerId?: string) => documentId === FACE_PLANE && peerId === SIBLING };
const asSibling = (shadow: EdgeShadowRing) => selfSlotShareDecision({
  hasWsSocket: false, sibling: true, siblingGate, peerClass: undefined, selfSlotFedGate: null,
  antigenRing: null, membership: null, planeSeal: null, peerId: SIBLING, documentId: FACE_PLANE, shadow,
});

describe("at the floor every fleet lane stays shut", () => {
  test("F1 a proven sibling reads nothing through the floor ring", async () => {
    expect(await asSibling(built)).toBe(true);     // control: the lane carries when the built ring decides
    expect(await asSibling(floor)).toBe(false);
  });

  test("F2 the sorter reads every device as set aside", () => {
    expect(built.deviceAside("ab".repeat(32))).toBe(false);   // control
    expect(floor.deviceAside("ab".repeat(32))).toBe(true);
    expect(floor.deviceAside("")).toBe(true);
  });

  test("F3 a peer on neither lane keeps what the built ring answers", async () => {
    expect(floor.aside("island")).toBe(false);
    expect(floor.aside(SET_ASIDE)).toBe(true);
    expect(await selfSlotShareDecision({
      hasWsSocket: false, peerClass: undefined, selfSlotFedGate: null, antigenRing: null, membership: null,
      planeSeal: null, peerId: "island", documentId: FACE_PLANE, shadow: floor,
    })).toBe(true);
  });

  test("F5 the fetch door serves no fleet at the floor", async () => {
    const clear = new TextEncoder().encode("a private plane's blob, resting in the clear tier");
    const cid = sha256HexBytesSync(clear);
    const cidDir = mkdtempSync(join(tmpdir(), "floor-cid-"));
    const cadDir = mkdtempSync(join(tmpdir(), "floor-cad-"));
    writeFileSync(join(cidDir, cid), clear);
    const JOIN_GATE = "cd".repeat(32);
    const deps = (fleet: CasWireServerDeps["fleet"]): CasWireServerDeps => ({
      cadDir, cidDir, fleet, seal: makeSealedPlaneRegistry().seal, membership: membershipOf([]), antigen: antigenOf([]),
      fedGate: { mayFederate: async () => false },
    });
    try {
      const served = await decideAndServeWantBlock(deps((key) => key === JOIN_GATE), JOIN_GATE, cid);
      expect(served.kind).toBe("cas-block");                       // control: a fleet reading serves the blob
      expect((await decideAndServeWantBlock(deps(noFleetAtTheFloor), JOIN_GATE, cid)).kind).toBe("cas-mu");
    } finally { rmSync(cidDir, { recursive: true, force: true }); rmSync(cadDir, { recursive: true, force: true }); }
    const src = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    expect((src.match(/^\s*fleet:\s+/gm) ?? []).length).toBe(1);   // one fetch door, one predicate line
    expect(src).toMatch(/^\s*fleet:\s+sovereign \? isFleetPeer : noFleetAtTheFloor,\s*$/m);
  });

  test("F4 the composition wears the floor ring on the floor arm, and both consults read it", () => {
    const src = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code, "the comment strip ate the file").toMatch(/const builtRing = makeEdgeShadowRing\(/);
    expect((code.match(/floorShadowRing\s*\(/g) ?? []).length).toBe(1);
    expect(code).toMatch(/const shadowRing: EdgeShadowRing = sovereign\s*\?\s*builtRing\s*:\s*floorShadowRing\(builtRing,\s*\(peerId\)\s*=>\s*Boolean\(siblings\?\.provenKeyOf\(peerId as PeerId\)\)\);/);
    expect(code).toMatch(/edgeShadows = shadowRing;/);
    // The share verdict's line sits where the block-comment strip does not reach whole, so it reads off the raw
    // source, anchored at its own line start: a line comment never satisfies it.
    expect(src).toMatch(/^\s*shadow:\s+edgeShadows,\s*$/m);
    expect(code).toMatch(/deviceAside:\s*\(vesselKey\)\s*=>\s*shadowRing\.deviceAside\(vesselKey\),/);
  });
});
