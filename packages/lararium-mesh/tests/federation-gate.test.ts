/**
 * federation-gate.test.ts — the deny-by-default relay-share shore (#49 OPTION R).
 *
 * Proven:
 *   - DeterministicFederationGate federates ONLY the per-Nexus public boards
 *     (crossroads + WHO board, deterministic from the gate key) + any explicit
 *     extra board; a private/random doc id is DENIED.
 *   - over a carried key SET, the gate federates EVERY island's five public boards (crossroads,
 *     WHO, kapae-antigen, carriage, persona-KEL); a random-id private plane and a third island's
 *     boards stay denied, an empty set federates nothing, and a single string matches the
 *     literal doc ids the single-key gate derives.
 *   - federationShareDecision (the vessel's sharePolicy verdict): in-process peers
 *     get everything; a same-operator relay (no gate) syncs fully; a gated relay
 *     peer gets ONLY the federatable surface — the private planes never cross.
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, stringifyAutomergeUrl, type BinaryDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  crossroadsDocUrl, whoBoardDocUrl, kapaeAntigenDocUrl, carriageDocUrl, personaKelBoardDocUrl, deterministicDocUrl,
} from "../src/deterministic-doc.js";
import { DeterministicFederationGate, federationShareDecision } from "../src/federation-gate.js";

const NX = "abcdef0123456789";

/** A random-id doc URL standing for a PRIVATE plane (catalog/personal/draft/wiki): its 16-byte id
 *  is unguessable and is NOT one of the deterministic public boards. */
function randomDocId(): DocumentId {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return interpretAsDocumentId(stringifyAutomergeUrl({ documentId: bytes as BinaryDocumentId })) as DocumentId;
}
const docIdOf = (url: string): DocumentId => interpretAsDocumentId(url as never) as DocumentId;

describe("DeterministicFederationGate — the federatable surface", () => {
  const gate = new DeterministicFederationGate(NX);

  test("federates the per-Nexus crossroads + WHO board", () => {
    expect(gate.mayFederate(docIdOf(crossroadsDocUrl(NX)))).toBe(true);
    expect(gate.mayFederate(docIdOf(whoBoardDocUrl(NX)))).toBe(true);
  });

  test("DENIES a private/random doc id (deny-by-default)", () => {
    for (let i = 0; i < 8; i++) expect(gate.mayFederate(randomDocId())).toBe(false);
  });

  test("DENIES another Nexus's boards — the surface shards per gate key", () => {
    expect(gate.mayFederate(docIdOf(crossroadsDocUrl("other-nexus")))).toBe(false);
    expect(gate.mayFederate(docIdOf(whoBoardDocUrl("other-nexus")))).toBe(false);
  });

  test("admits an explicit extra board (e.g. a deliberately-federated WHERE board)", () => {
    const where = deterministicDocUrl("some-where-board");
    const gate2 = new DeterministicFederationGate(NX, [where]);
    expect(gate2.mayFederate(docIdOf(where))).toBe(true);
    // still denies a random private doc
    expect(gate2.mayFederate(randomDocId())).toBe(false);
  });
});

/** The five public boards an island federates, derived from its key. */
const fiveBoards = (key: string): DocumentId[] => [
  crossroadsDocUrl(key), whoBoardDocUrl(key), kapaeAntigenDocUrl(key), carriageDocUrl(key), personaKelBoardDocUrl(key),
].map(docIdOf);

describe("DeterministicFederationGate — a carried key set", () => {
  const A = NX;
  const X = "fedcba9876543210";
  const Y = "0011223344556677";

  test("given [A, X], federates BOTH islands' five public boards", () => {
    const gate = new DeterministicFederationGate([A, X]);
    for (const id of [...fiveBoards(A), ...fiveBoards(X)]) expect(gate.mayFederate(id)).toBe(true);
  });

  test("CONTROL: a random-id private plane stays denied over a carried set", () => {
    const gate = new DeterministicFederationGate([A, X]);
    for (let i = 0; i < 8; i++) expect(gate.mayFederate(randomDocId())).toBe(false);
  });

  test("CONTROL: a third island Y's boards stay denied", () => {
    const gate = new DeterministicFederationGate([A, X]);
    for (const id of fiveBoards(Y)) expect(gate.mayFederate(id)).toBe(false);
  });

  test("CONTROL: an empty set federates nothing", () => {
    const gate = new DeterministicFederationGate([]);
    for (const id of [...fiveBoards(A), ...fiveBoards(X)]) expect(gate.mayFederate(id)).toBe(false);
    expect(gate.mayFederate(randomDocId())).toBe(false);
  });

  test("CONTROL: a single string federates exactly the literal ids the single-key gate derives", () => {
    // Fixture: the doc ids the single-key gate derives for NX, in derivation order
    // (crossroads, WHO, kapae-antigen, carriage, persona-KEL).
    const FIXTURE = [
      "2YKrMmP1oUfj9tSwU4gjQvsYaH6D",
      "2qLnbUoKqBJoLUjjJBrw9reSvFdm",
      "3jupdHYA97djCGEwNrxSvM48bdt6",
      "2b46DoPViN4et3KRcDiZtdZP5nwq",
      "3JX3V9i8cQPLD8pfAXWVrM7E9qih",
    ] as DocumentId[];
    expect(fiveBoards(NX)).toEqual(FIXTURE);
    const single = new DeterministicFederationGate(NX);
    const asSet  = new DeterministicFederationGate([NX]);
    for (const id of FIXTURE) {
      expect(single.mayFederate(id)).toBe(true);
      expect(asSet.mayFederate(id)).toBe(true);
    }
    for (const id of [...fiveBoards(X), ...fiveBoards(Y)]) expect(single.mayFederate(id)).toBe(false);
    expect(single.mayFederate(randomDocId())).toBe(false);
  });
});

describe("federationShareDecision — the vessel's sharePolicy verdict", () => {
  const RELAY = "relay-peer" as PeerId;
  const ISLAND = "island-worker" as PeerId;
  const gate = new DeterministicFederationGate(NX);
  const relayPeers = new Set<string>([RELAY]);

  test("an IN-PROCESS island peer gets EVERYTHING (private ids too)", async () => {
    expect(await federationShareDecision(relayPeers, gate, ISLAND, randomDocId())).toBe(true);
    expect(await federationShareDecision(relayPeers, gate, ISLAND, docIdOf(crossroadsDocUrl(NX)))).toBe(true);
  });

  test("a gated RELAY peer gets the public boards but NOT the private planes", async () => {
    expect(await federationShareDecision(relayPeers, gate, RELAY, docIdOf(crossroadsDocUrl(NX)))).toBe(true);
    expect(await federationShareDecision(relayPeers, gate, RELAY, docIdOf(whoBoardDocUrl(NX)))).toBe(true);
    // the leak this closes: a private doc is NOT volunteered to the relay
    expect(await federationShareDecision(relayPeers, gate, RELAY, randomDocId())).toBe(false);
  });

  test("a gated RELAY peer with NO documentId is DENIED (deny-by-default)", async () => {
    expect(await federationShareDecision(relayPeers, gate, RELAY, undefined)).toBe(false);
  });

  test("a same-operator relay (NO gate) syncs FULLY — its own node holds its own private planes", async () => {
    expect(await federationShareDecision(relayPeers, null, RELAY, randomDocId())).toBe(true);
    expect(await federationShareDecision(relayPeers, null, RELAY, undefined)).toBe(true);
  });
});
