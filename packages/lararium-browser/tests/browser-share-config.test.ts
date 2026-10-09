/**
 * browser-share-config — THE BROWSER SEATS ITS VERDICT ON BOTH HOOKS, AND READS THE GATE IT ARMS.
 *
 * The node cured the announce-only lie (`share-policy-is-access.test.ts`); the browser vessel composed a
 * bare `sharePolicy` and inherited it. `browserShareConfig` seats the identity share decision on
 * `announce` AND `access`, so a relay peer asking by doc id draws the same verdict it would hear announced.
 *
 * The Repo takes its share config BEFORE the spore crossing arms the federation gate, so the config reads
 * the gate LIVE, at each decision. A config that captured the gate's value at construction holds the
 * pre-crossing `null` forever, and a cross-operator relay then reads as the operator's own node — full
 * device sync of every private plane.
 *
 * ONE SOCKET, ONE RING. The PersonaGroup identity ring composes onto that same gate, so the config takes the
 * gate alone: a second ring parameter beside it could only ever stand empty.
 *
 * A SIBLING IS NO HOUSE MEMBER. A peer the sibling channel proved arrives on no relay socket, yet it never shares
 * freely: the config hands it to the sibling gate — the ring's sibling path over the public boards — alone.
 */
import { describe, expect, test } from "vitest";
import type { DocumentId } from "@automerge/automerge-repo";
import { DeterministicFederationGate, crossroadsDocUrl, type FederationGate } from "@lararium/mesh";
import { interpretAsDocumentId } from "@automerge/automerge-repo";
import { browserShareConfig } from "../src/open-browser-vessel.js";

const NEXUS = "ab".repeat(32);
const PRIVATE_DOC = "4NMNnkMhL8jXrkWJZWFqQnhkWkpq" as DocumentId;   // a random-id plane — never a derived address
const CROSSROADS  = interpretAsDocumentId(crossroadsDocUrl(NEXUS)) as DocumentId;

describe("browserShareConfig", () => {
  test("a peer the decision refuses is refused on access too", async () => {
    const cfg = browserShareConfig(new Set(["relay"]), () => null);
    // No federation gate and no ring: a relay peer draws the decision's floor on BOTH hooks, identically.
    const a = await cfg.announce("relay" as never, "doc" as never);
    const b = await cfg.access("relay" as never, "doc" as never);
    expect(b).toBe(a);
    // CONTROL: both hooks are the same function — no legacy `() => true` stands behind access.
    expect(cfg.access).toBe(cfg.announce);
  });

  test("a gate armed AFTER the config stands governs every later decision", async () => {
    let fedGate: FederationGate | null = null;
    const cfg = browserShareConfig(new Set(["relay"]), () => fedGate);
    // CONTROL: before the crossing arms the gate, the relay reads as the own node — full sync.
    expect(await cfg.access("relay" as never, PRIVATE_DOC)).toBe(true);
    fedGate = new DeterministicFederationGate(NEXUS);
    // The crossing armed it: a private plane no longer reaches the foreign relay, on either hook …
    expect(await cfg.access("relay" as never, PRIVATE_DOC)).toBe(false);
    expect(await cfg.announce("relay" as never, PRIVATE_DOC)).toBe(false);
    // … while the deterministic public shelf still federates (the gate narrows, it never blackholes).
    expect(await cfg.access("relay" as never, CROSSROADS)).toBe(true);
    // An in-process island peer is a house member whatever the gate reads.
    expect(await cfg.access("island" as never, PRIVATE_DOC)).toBe(true);
  });

  test("the ring composed onto the gate is the verdict — no second ring socket stands beside it", async () => {
    // The config reads the relay set, the gate and the siblings, nothing else.
    expect(browserShareConfig.length).toBe(3);
    const base = new DeterministicFederationGate(NEXUS);
    let fedGate: FederationGate | null = base;
    const cfg = browserShareConfig(new Set(["relay"]), () => fedGate);
    // CONTROL: the bare cross-operator gate keeps a private plane off the relay.
    expect(await cfg.access("relay" as never, PRIVATE_DOC)).toBe(false);
    // A ring composed onto the gate widens it by the face's own planes, for the peer it proved …
    fedGate = { mayFederate: async (doc, peer) => (doc === PRIVATE_DOC && peer === "relay") || base.mayFederate(doc, peer) };
    expect(await cfg.access("relay" as never, PRIVATE_DOC)).toBe(true);
    expect(await cfg.announce("relay" as never, PRIVATE_DOC)).toBe(true);
    // … and the public shelf still crosses through the base it composed over.
    expect(await cfg.access("relay" as never, CROSSROADS)).toBe(true);
  });

  test("RED: a sibling never shares freely — the sibling gate alone decides it; CONTROL: its face's plane crosses", async () => {
    const FACE_A = "3FaceAPlaneDocIdXXXXXXXXXXXX" as DocumentId;
    let siblingGate: FederationGate | null = null;
    const cfg = browserShareConfig(new Set(["relay"]), () => null, {
      isSibling: (peerId) => peerId === "sibling",
      gate: () => siblingGate,
    });
    // Before the ring stands, a sibling reaches nothing — though it rides no relay socket.
    expect(await cfg.access("sibling" as never, FACE_A)).toBe(false);
    const base = new DeterministicFederationGate(NEXUS);
    siblingGate = { mayFederate: async (doc, peer) => (doc === FACE_A && peer === "sibling") || base.mayFederate(doc, peer) };
    expect(await cfg.access("sibling" as never, FACE_A)).toBe(true);
    expect(await cfg.access("sibling" as never, CROSSROADS)).toBe(true);
    // Another face's plane, the @daemon, any private plane: withheld on both hooks.
    expect(await cfg.access("sibling" as never, PRIVATE_DOC)).toBe(false);
    expect(await cfg.announce("sibling" as never, PRIVATE_DOC)).toBe(false);
    // CONTROL: an in-process house peer still shares freely.
    expect(await cfg.access("island" as never, PRIVATE_DOC)).toBe(true);
  });
});
