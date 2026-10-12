/**
 * hearth-canon — AN ADMITTED LEAF TAKES THE CANON DOCUMENTS ITS OWN ADMIT NAMES, AND NOTHING ELSE.
 *
 * The cross-operator gate federates the public boards alone. A leaf dialing the hearth that admitted it also
 * takes the documents its carried admit names (`@lares`, `@lararium`), so the wiki it opens is the hearth's.
 * The oracle plane stays behind the gate with every other private plane: each vessel holds that document
 * under one derived id, the hearth boots from it, and a leaf's replica of it never merges with the hearth's.
 */
import { describe, expect, test } from "vitest";
import { Repo, generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import {
  DeterministicFederationGate, LARES_DOC_URI, LARARIUM_DOC_URI, CATALOG_DOC_URI, DAEMON_BAG_ID,
  crossroadsDocUrl, materializeSharedLarDoc, mutableLarRecord, oracleGenesisDocUrl, emptyLarDoc, tiddlerText,
  type FederationGate, type LarDoc,
} from "@lararium/mesh";
import { HearthCanonGate, admittedCanonDocs, hearthCanonDocIds, hearthCrossingOf, isOwnHearthCrossing, seatHearthCanon } from "../src/hearth-canon.js";
import { browserShareConfig } from "../src/open-browser-vessel.js";

const NEXUS = "ab".repeat(32);
// Four distinct, well-formed document addresses: a random-id plane each, as a vessel mints them.
const LARES_URL    = generateAutomergeUrl();
const LARARIUM_URL = generateAutomergeUrl();
const DAEMON_URL   = generateAutomergeUrl();
const CATALOG_URL  = generateAutomergeUrl();
const id = (url: string): DocumentId => interpretAsDocumentId(url as AutomergeUrl) as DocumentId;

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

describe("admittedCanonDocs — what a carried admit may name", () => {
  test("keeps the canon titles with well-formed document urls, and drops everything else", () => {
    expect(admittedCanonDocs({
      [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL,
      // A carried admit names canon alone: a private plane's title, a torn url and a non-string each fall out.
      [DAEMON_BAG_ID]: DAEMON_URL, [CATALOG_DOC_URI]: CATALOG_URL,
    })).toEqual({ [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL });
    expect(admittedCanonDocs({ [LARES_DOC_URI]: "not-a-document", [LARARIUM_DOC_URI]: 7 })).toEqual({});
    expect(admittedCanonDocs(undefined)).toEqual({});
    expect(admittedCanonDocs("automerge:x")).toEqual({});
    expect([...hearthCanonDocIds({ [LARES_DOC_URI]: LARES_URL })]).toEqual([id(LARES_URL)]);
  });
});

describe("HearthCanonGate", () => {
  const gate = new HearthCanonGate(new DeterministicFederationGate(NEXUS), { [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL });

  test("opens exactly the documents the admit names", () => {
    expect(gate.mayFederate(id(LARES_URL))).toBe(true);
    expect(gate.mayFederate(id(LARARIUM_URL))).toBe(true);
    // The outer gate's public shelf still federates.
    expect(gate.mayFederate(id(crossroadsDocUrl(NEXUS)))).toBe(true);
  });

  test("the oracle plane stays shut, with the daemon bag and the catalog", () => {
    expect(gate.mayFederate(id(oracleGenesisDocUrl())), "the leaf federates its hearth's whole oracle plane").toBe(false);
    expect(gate.mayFederate(id(DAEMON_URL))).toBe(false);
    expect(gate.mayFederate(id(CATALOG_URL))).toBe(false);
  });

  test("an admit that names no canon widens nothing", () => {
    const bare = new HearthCanonGate(new DeterministicFederationGate(NEXUS), {});
    expect(bare.mayFederate(id(LARES_URL))).toBe(false);
    expect(bare.mayFederate(id(oracleGenesisDocUrl()))).toBe(false);
    expect(bare.mayFederate(id(crossroadsDocUrl(NEXUS)))).toBe(true);
  });
});

describe("seatHearthCanon — the leaf's own oracle replica names the admitted canon", () => {
  test("writes each named pointer once, and a second seating writes nothing", () => {
    const doc = emptyLarDoc();
    let changes = 0;
    const oracle = { doc: () => doc, change: (fn: (d: LarDoc) => void) => { changes++; fn(doc); } };
    seatHearthCanon(oracle, { [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL });
    expect(tiddlerText(doc.tiddlers[LARES_DOC_URI])).toBe(LARES_URL);
    expect(tiddlerText(doc.tiddlers[LARARIUM_DOC_URI])).toBe(LARARIUM_URL);
    expect(changes).toBe(1);
    seatHearthCanon(oracle, { [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL });
    expect(changes).toBe(1);
    seatHearthCanon(oracle, {});
    expect(changes).toBe(1);
  });
});

/**
 * THE WRITE PATH, MEASURED OVER A LIVE SYNC. Two Repos stand as leaf and hearth over one channel, each holding
 * the oracle document under its derived id. The hearth shares everything with the leaf (a same-operator
 * device). What decides is the LEAF's own gate, seated on announce and access both.
 */
describe("a leaf's write to the oracle document never reaches its hearth", () => {
  const settle = (ms = 400): Promise<void> => new Promise((r) => setTimeout(r, ms));

  async function crossing(gateOf: (named: Record<string, string>) => FederationGate) {
    const { port1, port2 } = new MessageChannel();
    const hearth = new Repo({ peerId: "hearth" as PeerId, network: [new MessageChannelNetworkAdapter(port1 as never)], sharePolicy: async () => true });
    const hearthOracle = await materializeSharedLarDoc(hearth, oracleGenesisDocUrl(), "oracle");
    const hearthLares = hearth.create<LarDoc>(emptyLarDoc());
    hearthLares.change((d) => { d.tiddlers["lar:///t/canon/lady-aki"] = mutableLarRecord("lar:///t/canon/lady-aki", { text: "the hearth holds her" }, "test"); });
    hearthOracle.change((d) => { d.tiddlers[LARES_DOC_URI] = mutableLarRecord(LARES_DOC_URI, { text: hearthLares.url }, "hearth-boot"); });

    const named = { [LARES_DOC_URI]: hearthLares.url as string };
    const gate = gateOf(named);
    const leaf = new Repo({
      peerId: "leaf" as PeerId,
      network: [new MessageChannelNetworkAdapter(port2 as never)],
      shareConfig: browserShareConfig(new Set(["hearth"]), () => gate),
    });
    const leafOracle = await materializeSharedLarDoc(leaf, oracleGenesisDocUrl(), "oracle");
    return { hearth, leaf, hearthOracle, leafOracle, hearthLares, named, close: () => { port1.close(); port2.close(); } };
  }

  const MOVED = "automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu";   // where a hostile or mistaken leaf would point `bags/lares`

  test("under the admit's gate: the named canon arrives, and the leaf's oracle write stays on the leaf", async () => {
    const boards = new DeterministicFederationGate(NEXUS);
    const c = await crossing((named) => new HearthCanonGate(boards, named));
    try {
      // The named canon document crosses: the leaf reads what the hearth holds.
      const canon = await c.leaf.find<LarDoc>(c.hearthLares.url);
      expect(tiddlerText(canon.doc()?.tiddlers["lar:///t/canon/lady-aki"])).toBe("the hearth holds her");

      // The leaf seats its admitted pointer on its OWN oracle replica, then writes where the hearth boots from.
      seatHearthCanon(c.leafOracle, c.named);
      c.leafOracle.change((d) => {
        d.tiddlers[LARES_DOC_URI] = mutableLarRecord(LARES_DOC_URI, { text: MOVED }, "leaf-write");
        d.tiddlers["lar:///t/leaf/planted"] = mutableLarRecord("lar:///t/leaf/planted", { text: "from the leaf" }, "leaf-write");
      });
      await settle();
      expect(tiddlerText(c.hearthOracle.doc()?.tiddlers[LARES_DOC_URI]), "the leaf moved the pointer its hearth boots from").toBe(c.hearthLares.url);
      expect(c.hearthOracle.doc()?.tiddlers["lar:///t/leaf/planted"], "a leaf's oracle write reached the hearth").toBeUndefined();
      // And nothing the hearth's oracle names beyond the admit reaches the leaf.
      c.hearthOracle.change((d) => { d.tiddlers[DAEMON_BAG_ID] = mutableLarRecord(DAEMON_BAG_ID, { text: DAEMON_URL }, "hearth-boot"); });
      await settle();
      expect(c.leafOracle.doc()?.tiddlers[DAEMON_BAG_ID], "the hearth's private pointers crossed to the leaf").toBeUndefined();
    } finally { c.close(); }
  }, 30_000);

  test("CONTROL: a gate that opens the oracle plane carries the same write to the hearth", async () => {
    const oracleId = id(oracleGenesisDocUrl());
    const c = await crossing(() => ({ mayFederate: (documentId) => documentId === oracleId }));
    try {
      c.leafOracle.change((d) => { d.tiddlers["lar:///t/leaf/planted"] = mutableLarRecord("lar:///t/leaf/planted", { text: "from the leaf" }, "leaf-write"); });
      await settle();
      expect(tiddlerText(c.hearthOracle.doc()?.tiddlers["lar:///t/leaf/planted"]), "the instrument cannot see a crossing write").toBe("from the leaf");
    } finally { c.close(); }
  }, 30_000);
});

describe("hearthCrossingOf — the vessel's crossing wears the widened gate for its own hearth alone", () => {
  const HEARTH = "cd".repeat(32);
  const FOREIGN = "ef".repeat(32);
  const admit = { [LARES_DOC_URI]: LARES_URL, [LARARIUM_DOC_URI]: LARARIUM_URL };
  const at = (over: Partial<Parameters<typeof hearthCrossingOf>[0]>) => hearthCrossingOf({
    pinnedGatePubKey: HEARTH, hearthGatePubKey: HEARTH, holdsDeviceEdge: true, hearthCanonDocs: admit,
    relayGatePubKey: HEARTH, nexusPubkey: NEXUS, ...over,
  });
  const opens = (gate: FederationGate | null, url: string) => gate?.mayFederate(id(url) as DocumentId);

  test("the own-hearth admit opens exactly the documents it names, and the boards", () => {
    const own = at({});
    expect(own.ownHearth).toBe(true);
    expect(opens(own.gate, LARES_URL)).toBe(true);
    expect(opens(own.gate, LARARIUM_URL)).toBe(true);
    expect(opens(own.gate, crossroadsDocUrl(NEXUS))).toBe(true);
    expect(opens(own.gate, DAEMON_URL)).toBe(false);
    expect(opens(own.gate, oracleGenesisDocUrl())).toBe(false);
  });

  test("an own-hearth admit that names no canon opens no canon document", () => {
    const bare = at({ hearthCanonDocs: {} });
    expect(opens(bare.gate, LARES_URL)).toBe(false);
    expect(opens(bare.gate, crossroadsDocUrl(NEXUS))).toBe(true);
    expect(at({ hearthCanonDocs: undefined }).hearthCanon).toEqual({});
  });

  test("a foreign hearth, a founder with no hearth key and a vessel without its edge wear the narrow gate and name no canon", () => {
    for (const foreign of [
      at({ pinnedGatePubKey: FOREIGN, relayGatePubKey: FOREIGN }),
      at({ hearthGatePubKey: null }),
      at({ holdsDeviceEdge: false }),
    ]) {
      expect(foreign.ownHearth).toBe(false);
      expect(foreign.hearthCanon).toEqual({});
      expect(opens(foreign.gate, LARES_URL)).toBe(false);
      expect(opens(foreign.gate, LARARIUM_URL)).toBe(false);
      expect(opens(foreign.gate, crossroadsDocUrl(NEXUS))).toBe(true);
    }
  });

  test("CONTROL: no gate key pinned is the operator's own node, so no federation gate stands", () => {
    expect(at({ relayGatePubKey: undefined }).gate).toBeNull();
  });
});
