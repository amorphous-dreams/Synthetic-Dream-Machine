/**
 * THE WIKI A FOUNDED VESSEL BOOTS — the genesis bytes answer a frameless body whole.
 *
 * A founded vessel boots its wiki from `genesis/`: the engine blob and the grammar plugin blob the seed
 * names, pulled by address from `genesis/cas`. The daemon's doors run from `dist`; the in-VM face
 * (`$tw.lares.meme`) and the plain-server routes run the plugin bytes GENESIS carries. A cure that lands
 * in the tw5 source and its tracked bundle reaches those two doors only through a genesis bake.
 *
 * So this suite boots a wiki from the genesis bytes ALONE (no tracked bundle, no vendored core, no
 * `dist`) and asks the in-VM face the question a person asks: place a body with no frame, read it back.
 * A genesis that carries a plugin from before the bare-body cure answers an empty text.
 *
 * The bundle-to-genesis comparison itself belongs to `tools/genesis-carries-the-bundle-witness.sh`;
 * this suite reads behaviour, never an address.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/meme-api-surface
 */
import { describe, test, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, sha256HexBytesSync, type GenesisSeed } from "@lararium/mesh";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import type { LaresMemeFace } from "../../lararium-tw5/src/types/lares-globals.js";

// The repo's OWN tracked genesis, read off this file's path: a scratch `LAR_ROOT` never redirects it.
const GENESIS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "genesis");
const SEED_PATH = join(GENESIS_DIR, "seed.json");
const ENGINE_BLOB_ID = "tiddlywikicore";

const absent = existsSync(SEED_PATH) ? false : `genesis/seed.json absent at ${SEED_PATH}`;

/** One blob the seed names, read by its address and checked against it. */
function genesisBlob(seed: GenesisSeed, id: string): Uint8Array {
  const sha = (seed.blobs as Record<string, { sha256: string }>)[id]?.sha256;
  if (!sha) throw new Error(`genesis seed names no blob "${id}"`);
  const bytes = new Uint8Array(readFileSync(join(GENESIS_DIR, "cas", sha)));
  if (sha256HexBytesSync(bytes) !== sha) throw new Error(`genesis CAS member ${sha} does not hash to its name`);
  return bytes;
}

describe.skipIf(absent)(`the wiki booted from genesis bytes${absent ? ` [SKIPPED: ${absent}]` : ""}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;

  beforeAll(async () => {
    const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as GenesisSeed;
    const core = genesisBlob(seed, ENGINE_BLOB_ID);
    const grammar = JSON.parse(new TextDecoder().decode(genesisBlob(seed, LARES_MEMETIC_WIKITEXT_PLUGIN_URI))) as Record<string, unknown>;
    engine = new TW5Engine();
    await engine.boot(core, [grammar]);
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  }, 120_000);

  test("the genesis grammar stands in the wiki and publishes the in-VM face", () => {
    expect(engine.wiki.getTiddler(LARES_MEMETIC_WIKITEXT_PLUGIN_URI)).toBeTruthy();
    expect(typeof face.place).toBe("function");
    expect(typeof face.read).toBe("function");
  });

  test("★ a frameless body placed through the in-VM face reads back byte for byte ★", async () => {
    const uri = "lar:///t/genesis-bare-body";
    const body = "a body with no frame\n\nand a second paragraph\n";
    const receipt = await face.place(uri, body);
    expect(receipt.decision).toBe("ingest");
    const back = await face.read(uri);
    expect(back?.text).toBe(body);
  });

  test("CONTROL: a framed carrier reads back whole through the same face", async () => {
    const uri = "lar:///t/genesis-framed";
    const framed =
      `<<!DOCTYPE type=\`memetic-wikitext+tiddlywiki\` spec=\`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext\`>>\n\n` +
      `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
      "```toml meta\nuri-path = \"t/genesis-framed\"\n```\n\n" +
      `<<~ ahu slot=\`#/a\`>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
    const receipt = await face.place(uri, framed);
    expect(receipt.decision).toBe("ingest");
    expect((await face.read(uri))?.text).toContain("<<~ ahu slot=`#/a`>>");
  });

  test("★ a put of no bytes refuses by name and lands nothing ★", async () => {
    const uri = "lar:///t/genesis-empty";
    const receipt = await face.place(uri, "").then((r) => r, (e: unknown) => e);
    const said = receipt instanceof Error ? receipt.message : JSON.stringify(receipt);
    expect(said).toContain("empty-body");
    expect(await face.read(uri)).toBeNull();
  });
});
