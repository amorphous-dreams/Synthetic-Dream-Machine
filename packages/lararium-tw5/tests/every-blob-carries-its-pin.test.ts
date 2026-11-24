/**
 * every-blob-carries-its-pin — the island evaluates only code whose bytes match a pin the house carries
 * (`lar:///ha.ka.ba/lares/api/pono/island-host-contract#/ses-gate`).
 *
 * Two halves, on both island paths (the Node `worker_thread` path and the browser-Worker path, read off the genesis CAS):
 *   - the core blob: a blob with no `sha256`, or one whose bytes hash elsewhere, refuses by name before a byte evaluates;
 *   - the modules: a module whose text no pin names never enters the module table (`ModuleUnpinned`), whether it rides a loose
 *     preload or a plugin, or replaces a core module under the core's own title. CONTROL: the same module, pinned, runs.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import { bootGenesisWiki, genesisCoreBlob, genesisModulePins, genesisNote, genesisPreloads, genesisSkip, type EnginePath } from "./genesis-boot.harness.js";
import { CORE_BLOB_ABSENT, CORE_BLOB_PIN_MISMATCH, CORE_BLOB_UNPINNED, normalizeCoreBootBlob, prepareHostBootInstance, verifyCoreBootBlob } from "../src/tw5-host-bridge.js";
import { BLOB_PIN_MISMATCH, casBlobPreloads, moduleDigest, modulePin, modulePinsOf, MODULE_UNPINNED } from "../src/module-pins.js";
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

describe("module pins", () => {
  test("modulePinsOf reads loose modules and plugin shadows, and nothing else", () => {
    const loose = { title: "a.js", type: "application/javascript", "module-type": "library", text: "exports.a = 1;" };
    const data = { title: "b", text: "plain" };
    const plugin = { title: "$:/plugins/p", "plugin-type": "plugin", text: JSON.stringify({ tiddlers: { "p/c.js": { "module-type": "startup", text: "exports.c = 1;" }, "p/d": { text: "shadow" } } }) };
    expect([...modulePinsOf([loose, data, plugin])].sort()).toEqual([modulePin("a.js", "library", "exports.a = 1;"), modulePin("p/c.js", "startup", "exports.c = 1;")].sort());
  });

  test("a CAS blob whose bytes hash elsewhere than its CID refuses by name", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ title: "x", text: "y" }));
    expect(casBlobPreloads(bytes, sha256HexBytesSync(bytes))).toEqual([{ title: "x", text: "y" }]);
    expect(() => casBlobPreloads(bytes, sha256HexBytesSync(new TextEncoder().encode("z")))).toThrow(new RegExp(BLOB_PIN_MISMATCH));
  });
});

describe.skipIf(genesisSkip)(`the island evaluates only pinned modules${genesisNote}`, () => {
  const engines: TW5Engine[] = [];
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
    test(`${path}: an unpinned loose module and an unpinned plugin module refuse by name and never run; the alert rail names them`, async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const engine = await bootGenesisWiki({ path, preloads: [startup, library, packed] });
      engines.push(engine);
      const tw = engine.$tw as unknown as { modules: { titles: Record<string, unknown> }; wiki: Wiki };
      expect(tw.wiki.getTiddler(RAN), "the unpinned startup module ran").toBeUndefined();
      for (const title of [startup.title, library.title, "$:/plugins/lar/pin-probe-plugin/lib.js"]) {
        expect(tw.modules.titles[title], `${title} entered the module table`).toBeUndefined();
        expect(engine.refusedModules.map((r) => r.title)).toContain(title);
        expect(String(tw.wiki.getTiddler(`$:/temp/lares/alert/refused/module-unpinned/${title}`)?.fields["text"] ?? "")).toContain(MODULE_UNPINNED);
      }
      // CONTROL: the house's own modules stood: the genesis boot set's grammar plugin defined.
      expect(Object.keys(tw.modules.titles).length).toBeGreaterThan(100);
    }, 120_000);

    test(`${path}: CONTROL: the same modules, pinned, run`, async () => {
      const engine = await bootGenesisWiki({ path, preloads: [startup, library, packed], modulePins: modulePinsOf([startup, library, packed]) });
      engines.push(engine);
      const tw = engine.$tw as unknown as { modules: { execute(t: string): Record<string, unknown> }; wiki: Wiki };
      expect(tw.wiki.getTiddler(RAN)?.fields["text"]).toBe("ran");
      expect(tw.modules.execute(library.title)["answer"]).toBe(42);
      expect(tw.modules.execute("$:/plugins/lar/pin-probe-plugin/lib.js")["packed"]).toBe(7);
      expect(engine.refusedModules).toEqual([]);
    }, 120_000);
  }

  test("a preload that replaces a core module under its own title refuses: the core pin covers only the core's bytes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // The core's `now` macro: TW5 defines no shadow module a real tiddler overrides, so the forged text alone stands to define.
    const FORGED = "$:/temp/pin-probe/forged";
    const forged = probe("$:/core/modules/macros/now.js", "macro", `exports.name = "now"; exports.params = []; exports.run = function() { return "forged"; }; $tw.wiki.addTiddler(new $tw.Tiddler({ title: "${FORGED}", text: "ran" }));`);
    const engine = await bootGenesisWiki({ path: "node", preloads: [forged] });
    engines.push(engine);
    expect((engine.$tw as unknown as { wiki: Wiki }).wiki.getTiddler(FORGED), "the forged core module ran").toBeUndefined();
    expect(engine.refusedModules.map((r) => r.title)).toContain(forged.title);
  }, 120_000);

  test("a pin binds its title and module type: another title carrying a pinned module's text refuses; CONTROL: the pinned title runs", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // A guard-shaped title shadowed by a no-op whose text a pin names under its own title.
    const shadow = probe("$:/plugins/lar/pin-probe/guard.js", "library", library.text);
    const retyped = probe("$:/plugins/lar/pin-probe/retyped.js", "startup", startup.text);
    const engine = await bootGenesisWiki({ path: "node", preloads: [library, startup, shadow, retyped], modulePins: modulePinsOf([library, startup]) });
    engines.push(engine);
    const tw = engine.$tw as unknown as { modules: { titles: Record<string, unknown>; execute(t: string): Record<string, unknown> } };
    expect(tw.modules.titles[shadow.title], "a pinned text under another title defined").toBeUndefined();
    expect(engine.refusedModules.map((r) => r.title)).toEqual(expect.arrayContaining([shadow.title, retyped.title]));
    expect(tw.modules.execute(library.title)["answer"], "CONTROL: the pinned title runs").toBe(42);
  }, 120_000);

  for (const [kind, type, text] of [["json", "application/json", '{"htmlUnsafeElements":[]}'], ["dictionary", "application/x-tiddler-dictionary", "htmlUnsafeElements: "]] as const) {
    test(`a record-sourced ${kind} module carries its pin like code: unpinned, the script guard stands; CONTROL: pinned, it applies`, async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const config = { title: `$:/plugins/lar/pin-probe/config-${kind}`, type, "module-type": "config", text };
      const unpinned = await bootGenesisWiki({ path: "node", preloads: [config] });
      engines.push(unpinned);
      const tw = (e: TW5Engine) => e.$tw as unknown as { config: { htmlUnsafeElements: unknown } };
      expect(tw(unpinned).config.htmlUnsafeElements, "an unpinned config record cleared the script guard").toEqual(["script"]);
      expect(unpinned.refusedModules.map((r) => r.title)).toContain(config.title);
      const pinned = await bootGenesisWiki({ path: "node", preloads: [config], modulePins: modulePinsOf([config]) });
      engines.push(pinned);
      expect(tw(pinned).config.htmlUnsafeElements, "CONTROL: the pinned config record applies").not.toEqual(["script"]);
    }, 120_000);
  }

  test("a module defined after boot meets the same gate; CONTROL: a pinned one defines", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = new TW5Engine();
    const late = "exports.late = 1;";
    await engine.boot(genesisCoreBlob(), genesisPreloads(), undefined, { modulePins: genesisModulePins() });
    engines.push(engine);
    const tw = engine.$tw as unknown as { modules: { define(n: string, t: string, d: unknown): void; titles: Record<string, unknown> } };
    tw.modules.define("$:/late.js", "library", late);
    expect(tw.modules.titles["$:/late.js"]).toBeUndefined();
    expect(engine.refusedModules).toEqual([{ title: "$:/late.js", digest: moduleDigest(late) }]);
    // An object or function definition carries no text to evaluate: host code already in the realm, never a string the island evals.
    tw.modules.define("$:/late-fn.js", "library", { late: 2 });
    expect(tw.modules.titles["$:/late-fn.js"]).toBeDefined();
  }, 120_000);
});
