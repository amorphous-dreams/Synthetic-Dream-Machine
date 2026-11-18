/**
 * gate-widening.test.ts — the ONE sort, proven END-TO-END against the live self-slot split.
 *
 * A proven foreign key (neither cap=admin@daemon nor a pinned-KEL device edge) is classed by the gate's sorter
 * (`classifySocket`) BEFORE any verdict. Under PRIVATE — the fail-closed default — it is SILENCE: no class, no
 * socket, nothing for a sharePolicy to read. Under OPEN it is a STRANGER, and the REAL selfSlotShareDecision over
 * the REAL DeterministicFederationGate hands it the federatable shelf and nothing more:
 *   · RED: PRIVATE + a proven foreign key → no class at all (the gate answers nothing);
 *   · OPEN → the stranger reaches crossroads/WHO/antigen, and is DENIED catalog/personal;
 *   · a SAME-OPERATOR peer reads a private plane through its proven face's gate alone, never by class (D3);
 *   · a Kapae'd stranger draws Mu even for a federatable plane (the #59 antigen ahead).
 *
 * Gate: lar:///ha.ka.ba/lararium/mesh/carry-contract#carry-read-contract
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, stringifyAutomergeUrl, type BinaryDocumentId, type DocumentId } from "@automerge/automerge-repo";
import { randomBytes } from "node:crypto";
import {
  DeterministicFederationGate, classifySocket,
  crossroadsDocUrl, whoBoardDocUrl, kapaeAntigenDocUrl,
  type AntigenRing,
} from "@lararium/mesh";
import { selfSlotShareDecision, NO_BANS, NOBODY_ASIDE, NOTHING_CLASSED } from "../src/self-slot-share.js";

// This vessel's operator identity (its Nexus pubkey) — the federatable planes derive from it.
const MY_NEXUS = "1122334455667788990011223344556677889900112233445566778899001122";
const fedGate  = new DeterministicFederationGate(MY_NEXUS);

const docIdOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

// The FEDERATABLE-own planes (a stranger MAY reach these, under OPEN).
const CROSSROADS = docIdOf(crossroadsDocUrl(MY_NEXUS));
const WHO_BOARD  = docIdOf(whoBoardDocUrl(MY_NEXUS));
const ANTIGEN    = docIdOf(kapaeAntigenDocUrl(MY_NEXUS));

// The PRIVATE-own planes (a stranger must NEVER reach these) — random ids, never the deterministic set.
const randomDocId = (): DocumentId => docIdOf(stringifyAutomergeUrl({ documentId: new Uint8Array(randomBytes(16)) as BinaryDocumentId }));
const CATALOG_LIKE  = randomDocId();
const PERSONAL_LIKE = randomDocId();

const FOREIGN_PEER = "foreign-operator-peer";
const foreignKey = (answersStrangers: boolean) =>
  classifySocket({ sameOperator: false, contracted: false, walker: false, answersStrangers });

describe("the sort — a proven foreign key under each posture", () => {
  test("RED: under PRIVATE a proven foreign key draws no class — the gate answers nothing", () => {
    expect(foreignKey(false)).toBeNull();
  });

  test("CONTROL: under OPEN it is a stranger, never same-operator", () => {
    expect(foreignKey(true)).toBe("stranger");
  });
});

describe("END-TO-END — an OPEN gate's stranger reaches the federatable set, DENIED the private planes", () => {
  const cls = foreignKey(true)!;
  const share = (documentId: DocumentId | undefined, antigenRing: AntigenRing = NO_BANS) =>
    selfSlotShareDecision({
      hasWsSocket: true, peerClass: cls, selfSlotFedGate: fedGate, antigenRing,
      membership: null, planeSeal: null, peerId: FOREIGN_PEER, documentId,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });

  test("crossroads crosses (MANDATORY public/infra carriage)", async () => { expect(await share(CROSSROADS)).toBe(true); });
  test("the WHO board crosses", async () => { expect(await share(WHO_BOARD)).toBe(true); });
  test("the kapae-antigen board crosses (MANDATORY immune carriage)", async () => { expect(await share(ANTIGEN)).toBe(true); });

  test("a catalog-like PRIVATE plane is DENIED — the stranger reaches nothing beyond the shelf", async () => {
    expect(await share(CATALOG_LIKE)).toBe(false);
  });
  test("a personal-like PRIVATE plane is DENIED", async () => { expect(await share(PERSONAL_LIKE)).toBe(false); });
  test("a no-doc-id decision is DENIED (deny-by-default)", async () => { expect(await share(undefined)).toBe(false); });
});

describe("D3 — a SAME-OPERATOR peer reads through its proven face, never by class", () => {
  const faceGate = { mayFederate: (documentId: DocumentId) => documentId === PERSONAL_LIKE };
  const same = (documentId: DocumentId, sessionFace: typeof faceGate | null = null) => selfSlotShareDecision({
    hasWsSocket: true, peerClass: "same-operator", selfSlotFedGate: fedGate, antigenRing: NO_BANS,
    membership: null, planeSeal: null, peerId: "own-device-peer", documentId, sessionFace,
    shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
  });
  test("RED: a PRIVATE plane stays home from a same-operator peer with no face gate", async () => {
    expect(await same(CATALOG_LIKE)).toBe(false);
    expect(await same(PERSONAL_LIKE)).toBe(false);
  });
  test("CONTROL: its face's own plane crosses through the face gate, and no other private plane", async () => {
    expect(await same(PERSONAL_LIKE, faceGate)).toBe(true);
    expect(await same(CATALOG_LIKE, faceGate)).toBe(false);
  });
  test("a federatable plane crosses too", async () => { expect(await same(CROSSROADS)).toBe(true); });
});

describe("the #59 antigen runs AHEAD — a Kapae'd stranger draws Mu", () => {
  const KAPAED_PEER = "kapaed-foreign-peer";
  const KAPAED_NYM  = "dead".repeat(16);
  const antigen: AntigenRing = {
    kapaed: new Set([KAPAED_NYM]),
    presenterNym: (peerId) => (peerId === KAPAED_PEER ? KAPAED_NYM : null),
  };
  const cls = foreignKey(true)!;

  test("even a federatable plane draws Mu (false) for a Kapae'd stranger", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: cls, selfSlotFedGate: fedGate, membership: null, planeSeal: null,
      antigenRing: antigen, peerId: KAPAED_PEER, documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(false);
  });
  test("a clean stranger still reaches the federatable plane with the antigen wired", async () => {
    const verdict = await selfSlotShareDecision({
      hasWsSocket: true, peerClass: cls, selfSlotFedGate: fedGate, membership: null, planeSeal: null,
      antigenRing: antigen, peerId: FOREIGN_PEER, documentId: CROSSROADS,
      shadow: NOBODY_ASIDE, protectedDocs: NOTHING_CLASSED,
    });
    expect(verdict).toBe(true);
  });
});
