/**
 * floor-fleet-lanes.test — at the floor every fleet lane stays shut.
 *
 * F1 THE SIBLING LANE CARRIES NOTHING AT THE FLOOR. A proven sibling, under a sibling gate that would hand it its
 *    face's plane, draws false through the floor ring. Control: the same ask through the built ring carries.
 * F2 THE SORTER READS EVERY DEVICE AS SET ASIDE. Control: the built ring sets the same key aside for nobody.
 * F3 A PEER ON NEITHER LANE KEEPS WHAT THE BUILT RING ANSWERS. An in-process island still shares; a peer the built
 *    ring sets aside stays aside.
 * F4 THE COMPOSITION WEARS THIS RING AT THE FLOOR (a source weld, comments stripped, with its strip pinned): one
 *    call, on the floor arm of the sovereign choice, fed by the sibling channel's proven key; the share verdict and
 *    the sorter both read the ring that choice stood (the sorter through `gateShadowRing({ ring: shadowRing, … })`).
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { interpretAsDocumentId, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import type { EdgeShadowRing } from "../src/edge-shadow-ring.js";
import { floorShadowRing } from "../src/floor-fleet-lanes.js";
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
    // The sorter: since the D4 rewrite the gate's sorter consults the ring through `gateShadowRing`, over the ring the
    // sovereign choice stood (never `builtRing` past the floor arm).
    expect(code).toMatch(/shadows:\s*gateShadowRing\(\{\s*ring:\s*shadowRing,\s*deviceOf:/);
    expect(code).not.toMatch(/gateShadowRing\(\{\s*ring:\s*builtRing/);
  });
});
