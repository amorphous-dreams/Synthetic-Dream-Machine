/**
 * genesis-reconcile-two-bakes.test.ts — KNOWN RED, UNCURED: two genesis bakes under the one oracle doc id.
 *
 * Two real seeds, pinned as fixtures by the grammar blob each carries:
 *   bake A — grammar aacd2f0d…, grammarCid bafkreihllvx6…, floor e50202e5…, actor 192d60dd…  (baked first)
 *   bake B — grammar 2f9cf234…, grammarCid bafkreidxhckj…, floor 3bd74e21…, actor 0c42190a…  (the re-bake)
 * Both materialize under `oracleGenesisDocUrl()`, one fixed id for every bake.
 *
 * WHAT THE INTAKE DOES, measured:
 *   1. `reconcileGenesisCid(liveA, incomingB)` reads `live.url === incoming.url` (the one id) as the self-merge
 *      guard, merges nothing and answers `updated: false` with every `previous*Cid` set to the INCOMING value,
 *      while the live doc still reads grammarCid bafkreihllvx6…, grammar blob aacd2f0d…, floor e50202e5….
 *   2. A merge of the two histories (the shape a sync of the one id takes) settles the root `blobs` and
 *      `tiddlers` maps as ONE conflict each, won whole by the higher actor (192d… > 0c42…), never by the later
 *      bake: in BOTH merge orders the island reads bake A entire, and an operator write that rested in bake B's
 *      `tiddlers` map leaves the island.
 *   3. Where the reconcile DOES merge (the incoming island under an id of its own), it merges first and then rewrites
 *      only the three region witnesses to the incoming bake, so the grammar witness names bake B while the island
 *      serves bake A's grammar blob. The node keel never reaches this merge at boot: open-node-vessel's loadGenesis
 *      reloads a persisted oracle as it stands ("no merge-into-stale"), so a store founded on bake A keeps bake A.
 * Each red states the correct island; it turns green (and `test.fails` turns red) the day the intake lands it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/genesis-intake
 */

import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { materializeGenesisIsland, reconcileGenesisCid } from "../src/genesis-intake.js";
import { mergeGuarded } from "../src/prototype-key-shore.js";
import {
  GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER,
  computeEngineCid, computeGrammarCid, materializeGenesisDoc, oracleGenesisDocUrl, type GenesisSeed,
} from "../src/genesis-doc.js";
import { plainField, ENGINE_CORE_ID, LARES_MEMETIC_WIKITEXT_PLUGIN_URI, type LarDoc } from "../src/index.js";

const seed = (name: string): GenesisSeed =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as GenesisSeed;
const BAKE_A = seed("genesis-seed-grammar-aacd2f0d.json");
const BAKE_B = seed("genesis-seed-grammar-2f9cf234.json");

const FLOOR_TIDDLER = "lar:///ha.ka.ba/bags/oracle/genesis-cid-floor";
const OPERATOR_NOTE = "lar:///ha.ka.ba/test/operator/note";

interface IslandReading { engine: unknown; grammar: unknown; plugins: unknown; floor: unknown; grammarBlob: unknown; blobs: Record<string, string> }
function readIsland(doc: LarDoc | undefined): IslandReading {
  const tiddlers = doc?.tiddlers ?? {};
  const cid = (title: string) => plainField(tiddlers[title], "cid");
  const blobs = Object.fromEntries(Object.entries(doc?.blobs ?? {}).map(([k, v]) => [k, v.sha256]));
  return {
    engine: cid(GENESIS_CID_ENGINE_TIDDLER), grammar: cid(GENESIS_CID_GRAMMAR_TIDDLER), plugins: cid(GENESIS_CID_PLUGINS_TIDDLER),
    floor: cid(FLOOR_TIDDLER), grammarBlob: blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI], blobs,
  };
}
/** The island a seed stands as plain data: what a correct intake of that seed reads. */
function seedReading(s: GenesisSeed): IslandReading {
  const cid = (title: string) => (s.tiddlers[title] as { tiddler: { cid?: string } }).tiddler.cid;
  const blobs = Object.fromEntries(Object.entries(s.blobs).map(([k, v]) => [k, v.sha256]));
  return {
    engine: cid(GENESIS_CID_ENGINE_TIDDLER), grammar: cid(GENESIS_CID_GRAMMAR_TIDDLER), plugins: cid(GENESIS_CID_PLUGINS_TIDDLER),
    floor: cid(FLOOR_TIDDLER), grammarBlob: blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI], blobs,
  };
}

/**
 * BLOB EQUALS WITNESS: each region witness against the CID the blob the doc SERVES folds to — the engine witness
 * against computeEngineCid(core blob sha256), the grammar witness against computeGrammarCid(the grammar blob), the
 * floor witness against the floor manifest's sha256. A correct island answers every row `true`.
 */
function servedMatchesWitness(doc: LarDoc | undefined): { engine: boolean; grammar: boolean; floor: boolean } {
  const tiddlers = doc?.tiddlers ?? {};
  const blobs = doc?.blobs ?? {};
  const cid = (title: string) => plainField(tiddlers[title], "cid");
  const grammarBlob = blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI];
  return {
    engine:  cid(GENESIS_CID_ENGINE_TIDDLER) === computeEngineCid(blobs[ENGINE_CORE_ID]?.sha256 ?? ""),
    grammar: !!grammarBlob && cid(GENESIS_CID_GRAMMAR_TIDDLER) === computeGrammarCid([{ id: grammarBlob.id, version: grammarBlob.version, sha256: grammarBlob.sha256 }]),
    floor:   cid(FLOOR_TIDDLER) === blobs["floor-manifest"]?.sha256,
  };
}
const ALL_SERVED = { engine: true, grammar: true, floor: true };

describe("genesis reconcile — two bakes under the one oracle doc id", () => {
  const repos: Repo[] = [];
  afterEach(async () => { for (const r of repos.splice(0)) await r.shutdown(); });

  /** One store per bake: the one oracle id cannot hold two histories in one Repo. */
  async function island(s: GenesisSeed): Promise<DocHandle<LarDoc>> {
    const repo = new Repo({ sharePolicy: async () => false });
    repos.push(repo);
    return materializeGenesisIsland(repo, s, "two-bakes");
  }
  function writeOperatorNote(h: DocHandle<LarDoc>): void {
    h.change((d) => {
      (d.tiddlers as Record<string, unknown>)[OPERATOR_NOTE] = { tiddler: { title: OPERATOR_NOTE, text: "the operator's own row" }, meta: {} };
    });
  }

  test("CONTROL: the two bakes stand under the one oracle id, each island reads its own seed, and the bakes differ in grammar, floor and actor", async () => {
    const a = await island(BAKE_A);
    const b = await island(BAKE_B);
    expect(a.url).toBe(oracleGenesisDocUrl());
    expect(b.url).toBe(a.url);
    expect(readIsland(a.doc())).toEqual(seedReading(BAKE_A));
    expect(readIsland(b.doc())).toEqual(seedReading(BAKE_B));
    expect(seedReading(BAKE_A).engine).toBe(seedReading(BAKE_B).engine);
    expect(seedReading(BAKE_A).grammar).not.toBe(seedReading(BAKE_B).grammar);
    expect(seedReading(BAKE_A).floor).not.toBe(seedReading(BAKE_B).floor);
    expect(servedMatchesWitness(a.doc()), "bake A serves the blobs its witnesses name").toEqual(ALL_SERVED);
    expect(servedMatchesWitness(b.doc()), "bake B serves the blobs its witnesses name").toEqual(ALL_SERVED);
    expect(BAKE_A.actorSeed > BAKE_B.actorSeed, "bake A's actor sorts higher: the actor tiebreak favours the bake made first").toBe(true);
  });

  test.fails("RED (uncured): a store founded on bake A reconciles bake B under the one id — the island reads bake B and the result names bake A's grammar as previous", async () => {
    const live     = await island(BAKE_A);
    const incoming = await island(BAKE_B);
    const result   = reconcileGenesisCid(live, incoming);
    // Measured: updated false, previousGrammarCid === incomingGrammarCid, the live island still bake A whole.
    expect(result.previousGrammarCid).toBe(seedReading(BAKE_A).grammar);
    expect(result.updated).toBe(true);
    expect(readIsland(live.doc())).toEqual(seedReading(BAKE_B));
  });

  test.fails("RED (uncured): merging the two bakes' histories lands bake B and keeps the operator's row, in either merge order", async () => {
    // Order 1: the operator's row rests on a store founded on bake A, bake B arrives.
    const liveA = await island(BAKE_A);
    writeOperatorNote(liveA);
    mergeGuarded(liveA, await island(BAKE_B), "two-bakes");
    // Order 2: the operator's row rests on a store founded on bake B, bake A arrives from a peer.
    const liveB = await island(BAKE_B);
    writeOperatorNote(liveB);
    mergeGuarded(liveB, await island(BAKE_A), "two-bakes");
    // Measured: both orders read bake A whole (actor 192d… wins the root maps), and order 2 loses the row.
    expect(servedMatchesWitness(liveA.doc()), "order 1 serves the blobs its witnesses name").toEqual(ALL_SERVED);
    expect(servedMatchesWitness(liveB.doc()), "order 2 serves the blobs its witnesses name").toEqual(ALL_SERVED);
    expect(liveB.doc()?.tiddlers[OPERATOR_NOTE], "the operator's row survives the merge").toBeTruthy();
    expect(readIsland(liveA.doc())).toEqual(seedReading(BAKE_B));
    expect(readIsland(liveB.doc())).toEqual(seedReading(BAKE_B));
  });

  test.fails("RED (uncured): where the reconcile does merge (bake B arriving under its own id), every witness names the blob the island serves", async () => {
    const live = await island(BAKE_A);
    const repo = new Repo({ sharePolicy: async () => false });
    repos.push(repo);
    const incoming = repo.import<LarDoc>(materializeGenesisDoc(BAKE_B));
    await incoming.whenReady();
    expect(incoming.url).not.toBe(live.url);
    const result = reconcileGenesisCid(live, incoming);
    expect(result.updated).toBe(true);
    // Measured: the merge keeps bake A's blobs whole (actor order) and the reconcile then rewrites the three witnesses to
    // bake B: the grammar witness names bafkreidxhckj… while the island serves grammar blob aacd2f0d… (folds to
    // bafkreihllvx6…); the floor witness, never rewritten, keeps naming bake A's e50202e5… and so matches bake A's blob;
    // the engine matches only because both bakes carry one core (4da77b10…). The island reads neither bake.
    expect(servedMatchesWitness(live.doc())).toEqual(ALL_SERVED);
    expect(readIsland(live.doc())).toEqual(seedReading(BAKE_B));
  });
});
