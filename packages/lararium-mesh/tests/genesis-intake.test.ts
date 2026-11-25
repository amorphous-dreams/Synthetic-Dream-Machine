/**
 * genesis-intake.test.ts — the ONE genesis intake core (isomorphism sweep).
 *
 * One validate→import→verify core for node and browser intake, beside the
 * emitter (genesis-doc.ts) in mesh, so one record shape and one authority
 * string hold; the platform wrappers keep only their byte SOURCES
 * (fs · bundle/IDB/OPFS/peer). The island stays the founding record: no
 * source merges one genesis document into another.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/genesis-intake
 */

import { describe, test, expect, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Repo } from "@automerge/automerge-repo";
import {
  validateGenesisBytes,
  importGenesisIsland,
  materializeGenesisIsland,
  genesisCasCidsFromOracle,
} from "../src/genesis-intake.js";
import {
  emptyLarDoc,
  ENGINE_CORE_ID,
  LARES_LARARIUM_PLUGIN_URI,
  LARES_MEMETIC_WIKITEXT_PLUGIN_URI,
  type LarDoc,
} from "../src/index.js";
import { GENESIS_SEED_FORMAT, oracleGenesisDocUrl } from "../src/genesis-doc.js";

const CORE_BYTES = new TextEncoder().encode("fake-tw5-core");

const RESTART_SEED = {
  format: GENESIS_SEED_FORMAT,
  actorSeed: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  blobs: {
    [ENGINE_CORE_ID]: { id: ENGINE_CORE_ID, version: "test", sha256: "1".repeat(64), mimeType: "application/javascript" },
    [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: {
      id: LARES_MEMETIC_WIKITEXT_PLUGIN_URI, version: "test", sha256: "2".repeat(64), mimeType: "application/javascript",
    },
  },
  tiddlers: {},
} as const;

function blobEntry(id: string, payload: string) {
  return {
    id,
    version:  "test",
    sha256:   "00",
    mimeType: "application/javascript",
    blob:     new TextEncoder().encode(payload),
  };
}

describe("genesis-intake — the one intake core", () => {
  const repos: Repo[] = [];

  afterEach(async () => {
    for (const r of repos.splice(0)) await r.shutdown();
  });

  function newRepo(): Repo {
    const r = new Repo({ sharePolicy: async () => true });
    repos.push(r);
    return r;
  }

  test("restart reloads the persisted oracle without consulting seed input", async () => {
    const repo = newRepo();
    const first = await materializeGenesisIsland(repo, RESTART_SEED, "first-breath");
    const restarted = await materializeGenesisIsland(repo, undefined, "restart");

    expect(restarted.url).toBe(first.url);
    expect(restarted.url).toBe(oracleGenesisDocUrl());
    expect(genesisCasCidsFromOracle(restarted.doc()!)).toEqual(["1".repeat(64), "2".repeat(64)]);
  });

  test("no source merges one genesis document into another: reconcileGenesisCid and its result type name nothing in src/", () => {
    const src = fileURLToPath(new URL("../src/", import.meta.url));
    const naming = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((f) => /\.(ts|mts|js)$/.test(f))
      .filter((f) => /\breconcileGenesisCid\b|\bGenesisReconcileResult\b/.test(readFileSync(join(src, f), "utf8")));
    expect(naming).toEqual([]);
  });

  test("CONTROL: a persisted island reloads untouched when a differing seed arrives", async () => {
    const repo = newRepo();
    const first = await materializeGenesisIsland(repo, RESTART_SEED, "first-breath");
    const other = { ...RESTART_SEED, blobs: { ...RESTART_SEED.blobs,
      [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { ...RESTART_SEED.blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI], sha256: "3".repeat(64) } } };
    const again = await materializeGenesisIsland(repo, other, "restart");
    expect(again.url).toBe(first.url);
    expect(genesisCasCidsFromOracle(again.doc()!)).toEqual(["1".repeat(64), "2".repeat(64)]);
  });

  test("first breath without seed refuses before an oracle or worker can stand", async () => {
    await expect(materializeGenesisIsland(newRepo(), undefined, "first-breath"))
      .rejects.toThrow(/oracle seed required for first materialization/);
  });

  /** Author a genesis-shaped doc and export its bytes. */
  async function genesisBytes(mutate?: (d: LarDoc) => void): Promise<Uint8Array> {
    const repo   = newRepo();
    const handle = repo.create<LarDoc>(emptyLarDoc());
    handle.change((d) => {
      const doc = d as { blobs?: Record<string, unknown>; tiddlers: Record<string, unknown> };
      doc.blobs = {
        [ENGINE_CORE_ID]:                    blobEntry(ENGINE_CORE_ID, "fake-tw5-core"),
        [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: blobEntry(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, "fake-plugin"),
      };
      if (mutate) mutate(d);
    });
    const bytes = await repo.export(handle.url);
    if (!bytes) throw new Error("export failed");
    return new Uint8Array(bytes);
  }

  test("valid bytes validate, import, and verify whole", async () => {
    const bytes  = await genesisBytes();
    const repo   = newRepo();

    const preview = validateGenesisBytes(bytes, "test-intake");
    expect(preview.blobs?.[ENGINE_CORE_ID]).toBeTruthy();

    const handle = await importGenesisIsland(repo, bytes, "test-intake");
    expect(handle.doc()?.blobs?.[ENGINE_CORE_ID]).toBeTruthy();
  });

  test("missing TW5 core blob refuses loudly, naming the blob id", async () => {
    const repo   = newRepo();
    const handle = repo.create<LarDoc>(emptyLarDoc());
    const bytes  = new Uint8Array((await repo.export(handle.url))!);

    expect(() => validateGenesisBytes(bytes, "test-intake")).toThrow(new RegExp(ENGINE_CORE_ID));
  });

  test("RED: a held split grammar (it packs no route) with no house skin refuses, naming the house; CONTROL: beside its house row, or a grammar packing its own route, it validates", async () => {
    const packedPlugin = (title: string, shadows: Record<string, Record<string, string>>) =>
      new TextEncoder().encode(JSON.stringify({ title, "plugin-type": "plugin", type: "application/json", text: JSON.stringify({ tiddlers: shadows }) }));
    const split = packedPlugin(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, { "lar:///x/parser": { title: "lar:///x/parser", "module-type": "parser", text: "" } });
    const whole = packedPlugin(LARES_MEMETIC_WIKITEXT_PLUGIN_URI, { "lar:///x/route": { title: "lar:///x/route", "module-type": "route", text: "" } });
    const torn = await genesisBytes();
    expect(() => validateGenesisBytes(torn, "test-intake", () => split)).toThrow(new RegExp(LARES_LARARIUM_PLUGIN_URI));
    expect(validateGenesisBytes(torn, "test-intake", () => whole).blobs?.[ENGINE_CORE_ID]).toBeTruthy();
    expect(validateGenesisBytes(torn, "test-intake").blobs?.[ENGINE_CORE_ID], "no bytes held: the row check alone").toBeTruthy();
    const housed = await genesisBytes((d) => {
      (d as { blobs: Record<string, unknown> }).blobs[LARES_LARARIUM_PLUGIN_URI] = { ...blobEntry(LARES_LARARIUM_PLUGIN_URI, "fake-house"), kind: "lararium" };
    });
    expect(validateGenesisBytes(housed, "test-intake", () => split).blobs?.[LARES_LARARIUM_PLUGIN_URI]).toBeTruthy();
  });

});
