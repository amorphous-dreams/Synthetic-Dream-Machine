/**
 * self-slot-share.test.ts — the federatable-own vs private-own SELF-SLOT SPLIT, proven at the wire the
 * node sharePolicy hands to Automerge.
 *
 * The whole point (the cross-operator security tension two prior spirits declined to force): a peer that
 * carries a DIFFERENT operator identity must reach ONLY this vessel's deterministically-federatable planes
 * (crossroads / WHO / kapae-antigen), NEVER a private-own plane (catalog / personal / home / wikis). The
 * operator's own fleet holds no blanket either (D3, "Sharing after the gate"): the same-operator class
 * establishes transport alone, and the session's proven face decides each document.
 *
 * Proven against REAL mesh primitives (DeterministicFederationGate + the real deterministic doc urls +
 * the real carryContractShareDecision the sharePolicy calls) — no stubs in the decision path:
 *   · RED (D3): a SAME-OPERATOR WS peer reads a private plane only through its proven face's gate; with none it
 *     reads the shelf an admitted peer reads / CONTROL: the face's own plane crosses through that gate,
 *   · a CROSS-OPERATOR WS peer gets a federatable plane but is DENIED catalog/personal (the no-leak),
 *   · an UNCLASSIFIED WS peer is treated cross-operator (private DENIED) — fail-closed,
 *   · a Kapae'd cross-operator draws Mu even for a federatable plane (the #59 antigen ahead),
 *   · an in-process island peer full-syncs (a house member),
 *   · a gated peer whose fed gate has not yet stood is DENIED (no boot-window leak).
 *
 * Gate: lar:///ha.ka.ba/lararium/node/self-slot-share
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, stringifyAutomergeUrl, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { randomBytes } from "node:crypto";
import { DeterministicFederationGate, type AntigenRing, type NexusMembership, type PlaneSeal } from "@lararium/mesh";
import { crossroadsDocUrl, whoBoardDocUrl, kapaeAntigenDocUrl, carriageDocUrl, hostingDocUrl } from "@lararium/mesh";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

// This vessel's operator identity (its Nexus pubkey) — the federatable planes derive from it.
const MY_NEXUS = "1122334455667788990011223344556677889900112233445566778899001122";
const fedGate  = new DeterministicFederationGate(MY_NEXUS);

const docIdOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

// ── The FEDERATABLE-own planes (a cross-operator MAY reach these) ──────────────────────────────
const CROSSROADS = docIdOf(crossroadsDocUrl(MY_NEXUS));
const WHO_BOARD  = docIdOf(whoBoardDocUrl(MY_NEXUS));
const ANTIGEN    = docIdOf(kapaeAntigenDocUrl(MY_NEXUS));

// ── The PRIVATE-own planes (a cross-operator must NEVER reach these) ───────────────────────────
// catalog / personal / home / wiki docs carry RANDOM automerge ids (never the deterministic set), so a
// fresh random doc id is the faithful stand-in — it can never collide with a federatable address.
const randomDocId = (): DocumentId => docIdOf(stringifyAutomergeUrl({ documentId: new Uint8Array(randomBytes(16)) as BinaryDocumentId }));
const CATALOG_LIKE  = randomDocId();
const PERSONAL_LIKE = randomDocId();

const CROSS_PEER = "cross-operator-peer";
const SAME_PEER  = "same-operator-peer";

/** An antigen ring that marks ONE peer Kapae'd, resolving it to a fixed nym; all else clean/null. */
const KAPAED_PEER = "kapaed-cross-peer";
const antigen: AntigenRing = {
  kapaed: new Set(["dead".repeat(16)]),
  presenterNym: (peerId) => (peerId === KAPAED_PEER ? "dead".repeat(16) : null),
};

describe("D3 — a SAME-OPERATOR session reads through its proven face, never a blanket", () => {
  /** The gate of the face the session proved: that face's own plane, and nothing else. */
  const faceGate = { mayFederate: (documentId: DocumentId) => documentId === PERSONAL_LIKE };
  const same = (documentId: DocumentId, sessionFace: typeof faceGate | null = null, antigenRing: AntigenRing = NO_BANS) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: fedGate, antigenRing, membership: null, planeSeal: null, peerId: SAME_PEER, documentId,
    sessionFace,
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  });

  test("RED: with no face gate a PRIVATE plane stays home; the shelf still crosses", async () => {
    expect(await same(CATALOG_LIKE)).toBe(false);
    expect(await same(PERSONAL_LIKE)).toBe(false);
    expect(await same(CROSSROADS)).toBe(true);
  });
  test("CONTROL: the face's own plane crosses through its gate; another face's private plane does not", async () => {
    expect(await same(PERSONAL_LIKE, faceGate)).toBe(true);
    expect(await same(CATALOG_LIKE, faceGate)).toBe(false);
    expect(await same(CROSSROADS, faceGate)).toBe(true);
  });
  test("a Kapae'd same-operator presenter draws Mu even through its face gate", async () => {
    const kapaed: AntigenRing = { kapaed: new Set(["cafe".repeat(16)]), presenterNym: (p) => (p === SAME_PEER ? "cafe".repeat(16) : null) };
    expect(await same(PERSONAL_LIKE, faceGate, kapaed)).toBe(false);
    expect(await same(CROSSROADS, faceGate, kapaed)).toBe(false);
  });
});

describe("the no-leak — a CROSS-OPERATOR peer reaches ONLY the federatable-own planes", () => {
  const cross = (documentId: DocumentId) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null, planeSeal: null, peerId: CROSS_PEER, documentId,
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  });

  test("crossroads crosses (federatable-own)", async () => { expect(await cross(CROSSROADS)).toBe(true); });
  test("the WHO board crosses (federatable-own)", async () => { expect(await cross(WHO_BOARD)).toBe(true); });
  test("the kapae-antigen board crosses (federatable-own, MANDATORY carry)", async () => { expect(await cross(ANTIGEN)).toBe(true); });

  test("a catalog-like PRIVATE plane is DENIED", async () => { expect(await cross(CATALOG_LIKE)).toBe(false); });
  test("a personal-like PRIVATE plane is DENIED", async () => { expect(await cross(PERSONAL_LIKE)).toBe(false); });
  test("a no-doc-id decision is DENIED (deny-by-default)", async () => { expect(await cross(undefined)).toBe(false); });
});

describe("fail-closed — an UNCLASSIFIED WS peer is treated cross-operator", () => {
  const unclassified = (documentId: DocumentId | undefined) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: undefined, selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null, planeSeal: null, peerId: "unknown-peer", documentId,
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  });

  test("a federatable plane still crosses", async () => { expect(await unclassified(CROSSROADS)).toBe(true); });
  test("a PRIVATE plane is DENIED (stricter class wins)", async () => { expect(await unclassified(CATALOG_LIKE)).toBe(false); });
});

describe("the #59 antigen runs AHEAD — a Kapae'd cross-operator draws Mu", () => {
  test("even a federatable plane draws Mu (false) for a Kapae'd presenter", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate, antigenRing: antigen, membership: null, planeSeal: null, peerId: KAPAED_PEER, documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
  test("a clean cross-operator still reaches the federatable plane with the antigen wired", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate, antigenRing: antigen, membership: null, planeSeal: null, peerId: CROSS_PEER, documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(true);
  });
});

describe("house members + boot edge", () => {
  test("an IN-PROCESS island peer full-syncs a private plane (no WS socket → house member)", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: false, peerClass: undefined, selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null, planeSeal: null, peerId: "wiki-island", documentId: CATALOG_LIKE,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(true);
  });

  test("a gated peer whose fed gate has NOT yet stood is DENIED even a federatable plane (no boot-window leak)", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: null, antigenRing: NO_BANS, membership: null, planeSeal: null, peerId: CROSS_PEER, documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
});

// ── THE CARRY-SPLIT — a MEMBER blind-transits a SEALED private plane; a STRANGER gets the public shelf ──
// A membership consult that names ONLY MEMBER_PEER a member; a seal oracle that marks ONLY SEALED_PLANE sealed.
const MEMBER_PEER  = "member-cross-peer";
const STRANGER_PEER = "stranger-cross-peer";
const membership: NexusMembership = { holdsCarriagePeer: (peerId) => peerId === MEMBER_PEER };
const SEALED_PLANE   = randomDocId();   // a private-own plane the seal oracle proves sealed (ciphertext)
const CLEARTEXT_PLANE = randomDocId();  // a private-own plane the seal oracle CANNOT prove sealed (plaintext)
const planeSeal: PlaneSeal = { isSealedPlane: (docId) => docId === SEALED_PLANE };

describe("the carry-split — the mesh BREATHES: a MEMBER blind-transits a sealed private plane", () => {
  const decide = (peerId: string, documentId: DocumentId | undefined) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate,
    antigenRing: NO_BANS, membership, planeSeal, peerId, documentId,
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  });

  test("a MEMBER blind-transits a SEALED private plane (carry TRUE — the ciphertext relays)", async () => {
    expect(await decide(MEMBER_PEER, SEALED_PLANE)).toBe(true);
  });
  test("a MEMBER is DENIED a CLEARTEXT-local private plane (encrypt-first — never carried)", async () => {
    expect(await decide(MEMBER_PEER, CLEARTEXT_PLANE)).toBe(false);
  });
  test("a MEMBER still reaches the federatable public shelf", async () => {
    expect(await decide(MEMBER_PEER, CROSSROADS)).toBe(true);
  });

  test("a STRANGER gets the public shelf ONLY — a SEALED private plane is DENIED (no sealed carriage)", async () => {
    expect(await decide(STRANGER_PEER, SEALED_PLANE)).toBe(false);
  });
  test("a STRANGER reaches the federatable public shelf", async () => {
    expect(await decide(STRANGER_PEER, CROSSROADS)).toBe(true);
  });
  test("a STRANGER is DENIED a cleartext private plane too", async () => {
    expect(await decide(STRANGER_PEER, CLEARTEXT_PLANE)).toBe(false);
  });
});

describe("the seal-guard fail-closed — DENY_ALL seal keeps the member lane INERT (today's wire)", () => {
  test("even a MEMBER cannot carry a private plane when planeSeal is null (no sealed plane provable)", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate,
      antigenRing: NO_BANS, membership, planeSeal: null, peerId: MEMBER_PEER, documentId: SEALED_PLANE,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
  test("with a null membership consult, every cross-operator is a STRANGER (no sealed carriage)", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate,
      antigenRing: NO_BANS, membership: null, planeSeal, peerId: MEMBER_PEER, documentId: SEALED_PLANE,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
});

describe("the read-lane stays absolute — a Kapae'd MEMBER draws Mu even for a sealed plane", () => {
  const kapaedMember = "kapaed-member";
  const antigenMember: AntigenRing = {
    kapaed: new Set(["beef".repeat(16)]),
    presenterNym: (peerId) => (peerId === kapaedMember ? "beef".repeat(16) : null),
  };
  const memberIncludingKapaed: NexusMembership = { holdsCarriagePeer: (peerId) => peerId === kapaedMember };

  test("a banned MEMBER cannot blind-transit even a sealed plane (Kapae stays ahead of the carry-split)", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate,
      antigenRing: antigenMember, membership: memberIncludingKapaed, planeSeal, peerId: kapaedMember, documentId: SEALED_PLANE,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
});

describe("a WALKER reaches its hearth's hosting doc — and never the carriage board", () => {
  const GATE = "ee".repeat(32);
  const WALKER_DOC = docIdOf(hostingDocUrl(MY_NEXUS, GATE));
  const MY_CARRIAGE = docIdOf(carriageDocUrl(MY_NEXUS));
  const share = (peerClass: "walker" | "stranger" | "contracted", documentId: DocumentId, antigenRing: AntigenRing = NO_BANS, peerId = CROSS_PEER) =>
    selfSlotShareDecision({
      hasWsSocket: true, peerClass, selfSlotFedGate: fedGate, antigenRing, membership: null, planeSeal: null,
      peerId, documentId, walkerBoard: WALKER_DOC, carriageBoard: MY_CARRIAGE, hostingDocs: new Set([WALKER_DOC]),
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });

  test("RED: a walker reads its hearth's hosting doc; CONTROL: a stranger handed the same input does not", async () => {
    expect(await share("walker", WALKER_DOC)).toBe(true);
    expect(await share("stranger", WALKER_DOC)).toBe(false);
  });

  test("RED: a walker never reads the carriage board, though the shelf carries it; CONTROL: a carrier does", async () => {
    expect(await fedGate.mayFederate(MY_CARRIAGE)).toBe(true);                     // the shelf does carry it
    expect(await share("walker", MY_CARRIAGE)).toBe(false);
    expect(await share("contracted", MY_CARRIAGE)).toBe(true);
  });

  test("RED: a carrier replicates this hearth's hosting doc for the cross-check; a stranger does not", async () => {
    expect(await share("contracted", WALKER_DOC)).toBe(true);
    expect(await share("stranger", WALKER_DOC)).toBe(false);
  });

  test("CONTROL: the walker's hosting doc is the one doc beyond the shelf — a private plane stays denied", async () => {
    expect(await share("walker", CATALOG_LIKE)).toBe(false);
    expect(await share("walker", CROSSROADS)).toBe(true);
  });

  test("a Kapae'd walker draws Mu on its hosting doc too", async () => {
    expect(await share("walker", WALKER_DOC, antigen, KAPAED_PEER)).toBe(false);
  });
});

describe("a SIBLING holds standing, never the house — the sibling gate alone decides it", () => {
  // The sibling gate a boot stands: the PersonaGroup ring's sibling path (face A's own planes) over the public boards.
  const FACE_A_PLANE = randomDocId();
  const FACE_B_PLANE = randomDocId();
  const DAEMON_LIKE  = randomDocId();
  const SIBLING = "sibling-peer";
  const siblingGate = {
    mayFederate: async (documentId: DocumentId, peerId?: string) =>
      fedGate.mayFederate(documentId) || (documentId === FACE_A_PLANE && peerId === SIBLING),
  };
  const sibling = (documentId: DocumentId | undefined, gate: typeof siblingGate | null = siblingGate, antigenRing: AntigenRing = NO_BANS) =>
    selfSlotShareDecision({
      hasWsSocket: false, sibling: true, siblingGate: gate, peerClass: undefined, selfSlotFedGate: fedGate,
      antigenRing, membership: null, planeSeal: null, peerId: SIBLING, documentId,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });

  test("CONTROL: a face-A sibling reaches face A's plane and the public boards", async () => {
    expect(await sibling(FACE_A_PLANE)).toBe(true);
    expect(await sibling(CROSSROADS)).toBe(true);
  });

  test("RED: it never reaches face B's plane, the @daemon, or a private plane — though it rides no WS socket", async () => {
    expect(await sibling(FACE_B_PLANE)).toBe(false);
    expect(await sibling(DAEMON_LIKE)).toBe(false);
    expect(await sibling(CATALOG_LIKE)).toBe(false);
    // CONTROL: the same socketless peer, not proven a sibling, is a house member and shares freely.
    expect(await selfSlotShareDecision({
      hasWsSocket: false, peerClass: undefined, selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null,
      planeSeal: null, peerId: "island", documentId: FACE_B_PLANE,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    })).toBe(true);
  });

  test("RED: before the sibling gate stands it denies every doc, and a Kapae'd sibling draws Mu", async () => {
    expect(await sibling(FACE_A_PLANE, null)).toBe(false);
    expect(await sibling(undefined)).toBe(false);
    const kapaedSibling: AntigenRing = { kapaed: new Set(["beef".repeat(16)]), presenterNym: (p) => (p === SIBLING ? "beef".repeat(16) : null) };
    expect(await sibling(FACE_A_PLANE, siblingGate, kapaedSibling)).toBe(false);
  });

  test("RED: sibling-ness decides first — an id a sibling and a WS socket both claim reads as neither, even a same-operator socket", async () => {
    for (const peerClass of ["same-operator", "contracted", undefined] as const) {
      for (const doc of [FACE_A_PLANE, DAEMON_LIKE, CROSSROADS]) {
        expect(await selfSlotShareDecision({
          hasWsSocket: true, sibling: true, siblingGate, peerClass, selfSlotFedGate: fedGate,
          antigenRing: NO_BANS, membership: null, planeSeal: null, peerId: SIBLING, documentId: doc,
          shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
        }), `${String(peerClass)} socket claiming a sibling's id`).toBe(false);
      }
    }
    // CONTROL: the same-operator socket no sibling claims reads through its face gate (D3), and the shelf beside it.
    expect(await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null,
      planeSeal: null, peerId: "own-node", documentId: FACE_A_PLANE, sessionFace: { mayFederate: (d: DocumentId) => d === FACE_A_PLANE },
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    })).toBe(true);
    expect(await selfSlotShareDecision({
      hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: fedGate, antigenRing: NO_BANS, membership: null,
      planeSeal: null, peerId: "own-node", documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    })).toBe(true);
  });
});

describe("T22: a share input that has not stood withholds by name on the wire and sibling lanes", () => {
  // Each holder STOOD but empty: bans nobody, sets nobody aside, classes nothing. Distinct from null, which reads unstood.
  const stoodAntigen: AntigenRing = { kapaed: new Set(), presenterNym: () => null };
  const stoodShadow = { aside: () => false };
  const stoodGuard = { classOf: () => null, withholds: async () => false };
  const wire = (over: Partial<{ antigenRing: AntigenRing | null; shadow: typeof stoodShadow | null; protectedDocs: typeof stoodGuard | null }>) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: "stranger", selfSlotFedGate: fedGate, membership: null, planeSeal: null, peerId: CROSS_PEER, documentId: CROSSROADS,
    antigenRing: stoodAntigen, shadow: stoodShadow, protectedDocs: stoodGuard, ...over,
  });

  test("CONTROL: every input stood (empty) lets a stranger reach the shelf, as today", async () => {
    expect(await wire({})).toBe(true);
  });
  test("RED: an unstood antigen ring withholds the shelf from a wire peer", async () => {
    expect(await wire({ antigenRing: null })).toBe(false);
  });
  test("RED: an unstood edge shadow withholds the shelf from a wire peer", async () => {
    expect(await wire({ shadow: null })).toBe(false);
  });
  test("RED: an unstood protected-document guard withholds the shelf from a wire peer", async () => {
    expect(await wire({ protectedDocs: null })).toBe(false);
  });
  test("RED: a sibling meets the same withholding; CONTROL: an in-process island peer, inside the house, still full-syncs", async () => {
    const siblingGate = { mayFederate: () => true };
    expect(await selfSlotShareDecision({
      hasWsSocket: false, sibling: true, siblingGate, peerClass: undefined, selfSlotFedGate: fedGate, membership: null, planeSeal: null,
      peerId: "sibling-peer", documentId: CROSSROADS, antigenRing: null, shadow: stoodShadow, protectedDocs: stoodGuard,
    })).toBe(false);
    expect(await selfSlotShareDecision({
      hasWsSocket: false, peerClass: undefined, selfSlotFedGate: fedGate, membership: null, planeSeal: null,
      peerId: "island-peer", documentId: CATALOG_LIKE, antigenRing: null, shadow: null, protectedDocs: null,
    })).toBe(true);
  });
});
