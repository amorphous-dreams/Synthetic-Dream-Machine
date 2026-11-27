/**
 * every-blob-carries-its-pin — a blob reaches the engine only once its bytes hash to the pin that names it
 * (`lar:///ha.ka.ba/lares/api/pono/island-host-contract#/ses-gate`).
 *
 * On both island paths (the Node `worker_thread` path and the browser-Worker path, read off the genesis CAS):
 *   - the core blob: a blob with no `sha256`, or one whose bytes hash elsewhere, refuses by name before a byte evaluates;
 *   - a CAS blob: one whose bytes hash elsewhere than its CID refuses by name before a record of it reads;
 *   - past the blob, TiddlyWiki boots natively: every module a preload carries defines and runs, a loose one or a plugin's.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { bootGenesisWiki, genesisNote, genesisSkip, type EnginePath } from "./genesis-boot.harness.js";
import { CORE_BLOB_ABSENT, CORE_BLOB_PIN_MISMATCH, CORE_BLOB_UNPINNED, normalizeCoreBootBlob, prepareHostBootInstance, verifyCoreBootBlob } from "../src/tw5-host-bridge.js";
import { BLOB_PIN_MISMATCH, casBlobPreloads } from "../src/module-pins.js";
import { TW5Engine } from "../src/tw5-vm.js";

const flag = "__larPinProbeRan";
const g = globalThis as Record<string, unknown>;
afterEach(() => { delete g[flag]; vi.restoreAllMocks(); });

describe("the core blob carries its pin", () => {
  const bytes = new TextEncoder().encode(`globalThis.${flag} = true; exports.TiddlyWiki = () => ({ boot: {}, utils: {} });`);

  test("a blob with no sha256 refuses by name and never evaluates", async () => {
    expect(() => verifyCoreBootBlob({ bytes } as never)).toThrow(new RegExp(CORE_BLOB_UNPINNED));
    expect(() => verifyCoreBootBlob(normalizeCoreBootBlob(bytes))).toThrow(new RegExp(CORE_BLOB_UNPINNED));
    await expect(prepareHostBootInstance({ bytes } as never)).rejects.toThrow(new RegExp(CORE_BLOB_UNPINNED));
    await expect(new TW5Engine().boot(bytes as never)).rejects.toThrow(new RegExp(CORE_BLOB_UNPINNED));
    expect(g[flag], "the unpinned blob evaluated").toBeUndefined();
  });

  test("a pin that names no SHA-256 and an absent blob refuse by name", async () => {
    expect(() => verifyCoreBootBlob({ bytes, sha256: "not-a-digest" })).toThrow(new RegExp(CORE_BLOB_UNPINNED));
    expect(() => verifyCoreBootBlob(undefined)).toThrow(new RegExp(CORE_BLOB_ABSENT));
    await expect(new TW5Engine().boot(undefined)).rejects.toThrow(new RegExp(CORE_BLOB_ABSENT));
  });

  test("a blob whose bytes hash elsewhere refuses by name and never evaluates; CONTROL: the pinned blob evaluates", async () => {
    const wrong = sha256HexBytesSync(new TextEncoder().encode("other bytes"));
    await expect(prepareHostBootInstance({ bytes, sha256: wrong })).rejects.toThrow(new RegExp(CORE_BLOB_PIN_MISMATCH));
    // The refusal names its cure: the vendor bake writes the core and its pin in one pass, then the tree rebuilds over it.
    expect(() => verifyCoreBootBlob({ bytes, sha256: wrong })).toThrow(/pnpm --filter @lararium\/tw5 run build:tw5-vendor/);
    expect(g[flag]).toBeUndefined();
    await prepareHostBootInstance({ bytes, sha256: sha256HexBytesSync(bytes).toUpperCase() });
    expect(g[flag], "CONTROL: the pinned blob evaluated").toBe(true);
  });
});

describe("CAS blobs carry their pins", () => {
  test("a CAS blob whose bytes hash elsewhere than its CID refuses by name", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ title: "x", text: "y" }));
    expect(casBlobPreloads(bytes, sha256HexBytesSync(bytes))).toEqual([{ title: "x", text: "y" }]);
    expect(() => casBlobPreloads(bytes, sha256HexBytesSync(new TextEncoder().encode("z")))).toThrow(new RegExp(BLOB_PIN_MISMATCH));
  });
});

describe.skipIf(genesisSkip)(`past the blob, the island boots its modules natively${genesisNote}`, () => {
  const engines: Array<{ dispose(): void }> = [];
  afterEach(() => { for (const engine of engines.splice(0)) engine.dispose(); });

  const probe = (title: string, type: string, text: string) => ({ title, type: "application/javascript", "module-type": type, text });
  // A module's own global differs by path (the node path runs it in a `vm` context), so the probe speaks through the wiki.
  const RAN = "$:/temp/pin-probe/ran";
  const startup = probe("$:/plugins/lar/pin-probe/startup.js", "startup", `exports.name = "lar-pin-probe"; exports.synchronous = true; exports.startup = function() { $tw.wiki.addTiddler(new $tw.Tiddler({ title: "${RAN}", text: "ran" })); };`);
  type Wiki = { getTiddler(t: string): { fields: Record<string, unknown> } | undefined };
  const library = probe("$:/plugins/lar/pin-probe/library.js", "library", "exports.answer = 42;");
  const packed = { title: "$:/plugins/lar/pin-probe-plugin", "plugin-type": "plugin", type: "application/json",
    text: JSON.stringify({ tiddlers: { "$:/plugins/lar/pin-probe-plugin/lib.js": { title: "$:/plugins/lar/pin-probe-plugin/lib.js", type: "application/javascript", "module-type": "library", text: "exports.packed = 7;" } } }) };

  for (const path of ["node", "browser-worker"] as EnginePath[]) {
    test(`${path}: a loose startup module, a loose library and a plugin's module each define and run, with no pin asked`, async () => {
      const engine = await bootGenesisWiki({ path, preloads: [startup, library, packed] });
      engines.push(engine);
      const tw = engine.$tw as unknown as { modules: { execute(t: string): Record<string, unknown> }; wiki: Wiki };
      expect(tw.wiki.getTiddler(RAN)?.fields["text"], "the startup module ran at boot").toBe("ran");
      expect(tw.modules.execute(library.title)["answer"]).toBe(42);
      expect(tw.modules.execute("$:/plugins/lar/pin-probe-plugin/lib.js")["packed"]).toBe(7);
    }, 120_000);
  }
});
