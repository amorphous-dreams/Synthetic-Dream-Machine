/**
 * hearth-canon — AN ADMITTED LEAF TAKES ITS OWN HEARTH'S BASE CANON, AND NOTHING ELSE.
 *
 * The cross-operator gate federates the public boards alone. A leaf dialing the hearth that admitted it also
 * takes the oracle plane and the canon documents that plane names (`@lares`, `@lararium`), so the wiki it opens
 * is the hearth's. Every private plane stays behind the gate, and a crossing to any other gate widens nothing.
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId } from "@automerge/automerge-repo";
import {
  DeterministicFederationGate, LARES_DOC_URI, LARARIUM_DOC_URI, CATALOG_DOC_URI, DAEMON_BAG_ID,
  crossroadsDocUrl, mutableLarRecord, oracleGenesisDocUrl, emptyLarDoc, type LarDoc,
} from "@lararium/mesh";
import { HearthCanonGate, awaitHearthCanon, hearthCanonDocIds, hearthWikiPointer, isOwnHearthCrossing, type OracleWatch } from "../src/hearth-canon.js";

const NEXUS = "ab".repeat(32);
// Four distinct, well-formed document addresses: a random-id plane each, as a vessel mints them.
const LARES_URL    = generateAutomergeUrl();
const LARARIUM_URL = generateAutomergeUrl();
const DAEMON_URL   = generateAutomergeUrl();
const CATALOG_URL  = generateAutomergeUrl();
const id = (url: string): DocumentId => interpretAsDocumentId(url as AutomergeUrl) as DocumentId;

function oracleNaming(pointers: Record<string, string>): LarDoc {
  const doc = emptyLarDoc();
  for (const [title, text] of Object.entries(pointers)) doc.tiddlers[title] = mutableLarRecord(title, { text }, "test");
  return doc;
}

describe("isOwnHearthCrossing", () => {
  const HEARTH = "cd".repeat(32);
  test("the pinned gate must equal the key the admit named, and the vessel must hold its edge", () => {
    expect(isOwnHearthCrossing({ pinnedGatePubKey: HEARTH, hearthGatePubKey: HEARTH.toUpperCase(), holdsDeviceEdge: true })).toBe(true);
    // CONTROLS: another gate, a founder with no hearth key, no pin, and no edge each read false.
    expect(isOwnHearthCrossing({ pinnedGatePubKey: NEXUS, hearthGatePubKey: HEARTH, holdsDeviceEdge: true })).toBe(false);
    expect(isOwnHearthCrossing({ pinnedGatePubKey: HEARTH, hearthGatePubKey: null, holdsDeviceEdge: true })).toBe(false);
    expect(isOwnHearthCrossing({ pinnedGatePubKey: null, hearthGatePubKey: HEARTH, holdsDeviceEdge: true })).toBe(false);
    expect(isOwnHearthCrossing({ pinnedGatePubKey: HEARTH, hearthGatePubKey: HEARTH, holdsDeviceEdge: false })).toBe(false);
  });
});

describe("HearthCanonGate", () => {
  test("opens the oracle plane and the canon the oracle names; every private plane stays shut", () => {
    let oracle: LarDoc | null = null;
    const gate = new HearthCanonGate(new DeterministicFederationGate(NEXUS), () => oracle);
    // Before any pointer arrives: the oracle plane itself crosses, the canon does not yet.
    expect(gate.mayFederate(id(oracleGenesisDocUrl()))).toBe(true);
    expect(gate.mayFederate(id(LARES_URL))).toBe(false);

    oracle = oracleNaming({
      [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL,
      [DAEMON_BAG_ID]: DAEMON_URL, [CATALOG_DOC_URI]: CATALOG_URL,
    });
    // The gate reads the oracle at each verdict, so the canon opens the moment the pointers stand.
    expect(gate.mayFederate(id(LARES_URL))).toBe(true);
    expect(gate.mayFederate(id(LARARIUM_URL))).toBe(true);
    // The oracle also names the hearth's daemon bag and catalog: those are private planes and stay shut.
    expect(gate.mayFederate(id(DAEMON_URL))).toBe(false);
    expect(gate.mayFederate(id(CATALOG_URL))).toBe(false);
    // The outer gate's public shelf still federates.
    expect(gate.mayFederate(id(crossroadsDocUrl(NEXUS)))).toBe(true);
  });

  test("CONTROL: the bare cross-operator gate refuses the oracle plane and the canon alike", () => {
    const bare = new DeterministicFederationGate(NEXUS);
    expect(bare.mayFederate(id(oracleGenesisDocUrl()))).toBe(false);
    expect(bare.mayFederate(id(LARES_URL))).toBe(false);
  });

  test("a torn pointer names no canon", () => {
    const torn = oracleNaming({ [LARES_DOC_URI]: "not-a-document", [LARARIUM_DOC_URI]: "" });
    expect(hearthCanonDocIds(torn).size).toBe(0);
    expect(hearthWikiPointer(torn)).toBeNull();
  });
});

describe("awaitHearthCanon", () => {
  function watch(initial: LarDoc | null): OracleWatch & { set(doc: LarDoc): void; listeners: number } {
    let doc = initial;
    const listeners = new Set<() => void>();
    return {
      doc: () => doc,
      on: (_e, l) => { listeners.add(l); },
      off: (_e, l) => { listeners.delete(l); },
      set(next) { doc = next; for (const l of [...listeners]) l(); },
      get listeners() { return listeners.size; },
    };
  }

  test("a standing pointer answers at once", async () => {
    const oracle = watch(oracleNaming({ [LARES_DOC_URI]: LARES_URL }));
    expect(await awaitHearthCanon(oracle, { boundMs: 60_000 })).toEqual({ arrived: true, wikiDocUrl: LARES_URL });
    expect(oracle.listeners).toBe(0);
  });

  test("the change that carries the pointer resolves the wait and leaves no listener", async () => {
    const oracle = watch(emptyLarDoc());
    const waiting = awaitHearthCanon(oracle, { boundMs: 60_000 });
    oracle.set(oracleNaming({ [DAEMON_BAG_ID]: DAEMON_URL }));   // a change that names no canon keeps waiting
    oracle.set(oracleNaming({ [LARES_DOC_URI]: LARES_URL }));
    expect(await waiting).toEqual({ arrived: true, wikiDocUrl: LARES_URL });
    expect(oracle.listeners).toBe(0);
  });

  test("a closed crossing ends the wait by name, ahead of the bound", async () => {
    const oracle = watch(emptyLarDoc());
    let close: () => void = () => {};
    let unwatched = false;
    const waiting = awaitHearthCanon(oracle, {
      boundMs: 60_000,
      crossingClosed: (onClosed) => { close = onClosed; return () => { unwatched = true; }; },
    });
    close();
    expect(await waiting).toEqual({ arrived: false, why: "crossing-closed" });
    expect(unwatched).toBe(true);
    expect(oracle.listeners).toBe(0);
  });

  test("a crossing already closed when the wait begins answers at once", async () => {
    const oracle = watch(emptyLarDoc());
    const answer = await awaitHearthCanon(oracle, {
      boundMs: 60_000,
      crossingClosed: (onClosed) => { onClosed(); return () => {}; },
    });
    expect(answer).toEqual({ arrived: false, why: "crossing-closed" });
  });

  test("the bound only bounds the wait: a spent bound answers absent, never a pointer", async () => {
    const oracle = watch(emptyLarDoc());
    expect(await awaitHearthCanon(oracle, { boundMs: 5 })).toEqual({ arrived: false, why: "bound-spent" });
    expect(oracle.listeners).toBe(0);
  });
});
