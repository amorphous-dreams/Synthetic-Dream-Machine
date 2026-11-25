/**
 * genesis-reconcile-two-bakes.test.ts — two genesis bakes under the one oracle doc id.
 *
 * Two real seeds, pinned as fixtures by the grammar blob each carries:
 *   bake A — grammar aacd2f0d…, grammarCid bafkreihllvx6…, floor e50202e5…, actor 192d60dd…  (baked first)
 *   bake B — grammar 2f9cf234…, grammarCid bafkreidxhckj…, floor 3bd74e21…, actor 0c42190a…  (the re-bake)
 * Both materialize under `oracleGenesisDocUrl()`, one fixed id for every bake.
 *
 * The island stays the founding record: no source merges one genesis document into another, and a store founded on
 * bake A keeps bake A until its floor pin moves. A merge of the two histories (the shape a sync of the one id takes)
 * settles the root `blobs` and `tiddlers` maps as ONE conflict each, won whole by the higher actor (192d… > 0c42…), never
 * by the later bake; that red stands (`test.fails` turns red the day a sync lands the later bake). What a store that
 * takes bake B must read (the island whole, every witness naming the blob it serves) rides 3d, adopt per ratchet
 * (lar:///ha.ka.ba/kahua/memory/research/plan-floor-flip#/adopt), as a skipped title until that move exists.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/genesis-intake
 */

import { describe, test, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { materializeGenesisIsland } from "../src/genesis-intake.js";
import { mergeGuarded } from "../src/prototype-key-shore.js";
import {
  GENESIS_CID_ENGINE_TIDDLER, GENESIS_CID_GRAMMAR_TIDDLER, GENESIS_CID_PLUGINS_TIDDLER,
  computeEngineCid, computeGrammarCid, oracleGenesisDocUrl, type GenesisSeed,
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

describe("genesis intake — two bakes under the one oracle doc id", () => {
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

  test.skip("3d · adopt per ratchet carries this, skipped until the adopt lands: a store founded on bake A that adopts bake B reads bake B's island whole, every witness naming the blob it serves, and bake A stands as the prior the undo reverts to", async () => {
    const live = await island(BAKE_A);
    const prior = readIsland(live.doc());
    // 3d's adopt moves this store's floor pin to bake B here.
    expect(prior.grammar, "the undo's prior names bake A's grammar").toBe(seedReading(BAKE_A).grammar);
    expect(readIsland(live.doc())).toEqual(seedReading(BAKE_B));
    expect(servedMatchesWitness(live.doc())).toEqual(ALL_SERVED);
  });

  test.fails("RED: merging the two bakes' histories lands bake B and keeps the operator's row, in either merge order", async () => {
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
});
