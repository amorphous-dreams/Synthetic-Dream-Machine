/**
 * genesis-boot — the engine a founded vessel runs boots from the tracked genesis CAS on both host paths, and
 * the island runtime it forges holds whole: the boot shadows land, the engine names itself by its own bytes,
 * the error reporter never ends the worker, a syntax error reads as one, and the host's lends never read as
 * leaks.
 *
 * Every vector here runs the kernel's own boot over the kernel's own bytes, so a green run says what a
 * vessel does, not what a fixture allows.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { bootGenesisWiki, genesisCoreBlob, genesisNote, genesisSkip } from "./genesis-boot.harness.js";
import { LENT_WINDOW_NAMES } from "../src/tw5-host-bridge.js";
import type { TW5Engine } from "../src/tw5-vm.js";

interface LooseTw {
  version?: string;
  utils: { error: (err: unknown) => void; escapeCSS?: (s: string) => string; evalSandboxed: (code: string, context: Record<string, unknown>, filename: string) => unknown };
  wiki: { getTiddler(title: string): { fields: Record<string, unknown> } | undefined; getTiddlersWithTag(tag: string): string[] };
}
const loose = (engine: TW5Engine): LooseTw => engine.$tw as unknown as LooseTw;

/** The names the host bridge lends the island's global scope on either path. */
const LENT_NAMES = ["global", "Buffer", "process", "setImmediate", "clearImmediate", "require", "module", ...LENT_WINDOW_NAMES];

describe.skipIf(genesisSkip)(`the genesis boot${genesisNote}`, () => {
  const engines: TW5Engine[] = [];
  afterEach(() => { for (const e of engines.splice(0)) e.dispose(); vi.restoreAllMocks(); });

  test("the boot shadows land as tiddlers: the palette, the Kumu tag and the .mem file-type mapping stand after boot", async () => {
    const engine = await bootGenesisWiki();
    engines.push(engine);
    const tw = loose(engine);
    expect(tw.wiki.getTiddler("$:/palette")?.fields["text"]).toBe("lar:///ha.ka.ba/lares/api/lararium/palette/gruvbox-dark");
    expect(tw.wiki.getTiddler("$:/tags/LarariumKumu")?.fields["tags"]).toEqual(["$:/tags/Global"]);
    expect(tw.wiki.getTiddler("$:/config/FileTypeMappings/text/x-memetic-wikitext")?.fields["text"]).toBe("text/x-memetic-wikitext");
    // CONTROL: a title the seed never carried reads absent, so presence above comes from the seed alone.
    expect(tw.wiki.getTiddler("$:/config/FileTypeMappings/text/x-never-seeded")).toBeUndefined();
  }, 120_000);

  test("on the node path the engine names itself by its own bytes and carries the CSS escape; the error reporter logs and returns", async () => {
    const engine = await bootGenesisWiki({ path: "node" });
    engines.push(engine);
    const tw = loose(engine);
    expect(tw.version).toBe(genesisCoreBlob().sha256);
    expect(tw.utils.escapeCSS?.("a b")).toBe("a\\ b");
    // The fork's own reporter ends a non-browser process. The island's reporter surfaces and continues.
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => { throw new Error(`process.exit(${code})`); }) as never);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => tw.utils.error("a boot warning")).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
    expect(logged.mock.calls.flat().join(" ")).toContain("a boot warning");
    // CONTROL: the spy itself trips on a reporter that does exit.
    expect(() => process.exit(1)).toThrow(/process\.exit\(1\)/);
  }, 120_000);

  test("on the browser-worker path a syntax error throws a fault named SyntaxError; CONTROL: sound code answers its value", async () => {
    const engine = await bootGenesisWiki({ path: "browser-worker" });
    engines.push(engine);
    const tw = loose(engine);
    expect(tw.version).toBe(genesisCoreBlob().sha256);
    let fault: unknown;
    try { tw.utils.evalSandboxed("this is not javascript", {}, "probe.js"); } catch (error) { fault = error; }
    expect(fault).toBeInstanceOf(Error);
    expect((fault as Error).name).toBe("SyntaxError");
    // The fault belongs to no built-in class, so TW5's executor reports it rather than re-throwing it.
    expect(fault).not.toBeInstanceOf(SyntaxError);
    expect(tw.utils.evalSandboxed("exports.answer = 41 + 1;", { exports: {} }, "sound.js")).toMatchObject({ answer: 42 });
  }, 120_000);

  test("a preloaded module with a syntax error ends that module, named, and the island boots on either path; CONTROL: a sound module runs", async () => {
    // A startup module runs at boot; a library runs on its first `require`. The broken one must run at boot
    // to threaten the boot.
    const broken = { title: "$:/plugins/lar/probe/broken.js", type: "application/javascript", "module-type": "startup", text: "exports.name = 'lar-probe-broken'; exports.startup = function() {}; exports.x = this is not javascript;" };
    const sound  = { title: "$:/plugins/lar/probe/sound.js", type: "application/javascript", "module-type": "library", text: "exports.answer = 42;" };
    for (const path of ["browser-worker", "node"] as const) {
      const reported: string[] = [];
      const logged = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { reported.push(args.map(String).join(" ")); });
      const engine = await bootGenesisWiki({ path, tiddlers: [] , preloads: [broken, sound] });
      engines.push(engine);
      logged.mockRestore();
      const tw = engine.$tw as unknown as { wiki: { getTiddler(t: string): unknown }; modules: { execute(t: string): unknown } };
      expect(tw.wiki.getTiddler("$:/palette"), `${path}: the island booted past the broken module`).toBeDefined();
      expect(reported.join("\n"), `${path}: the broken module reads by name`).toMatch(/broken\.js[\s\S]*SyntaxError/);
      expect(tw.modules.execute("$:/plugins/lar/probe/sound.js")).toMatchObject({ answer: 42 });
    }
  }, 180_000);

  test("on the node path a boot error raises an alert the frame can paint; CONTROL: the alert names the error", async () => {
    const engine = await bootGenesisWiki({ path: "node" });
    engines.push(engine);
    const tw = loose(engine);
    vi.spyOn(console, "error").mockImplementation(() => {});
    tw.utils.error("a boot fault the vessel must hear");
    const alerts = tw.wiki.getTiddlersWithTag("$:/tags/Alert");
    expect(alerts.length).toBeGreaterThan(0);
    const texts = alerts.map((t) => String(tw.wiki.getTiddler(t)?.fields["text"] ?? ""));
    expect(texts.some((text) => text.includes("a boot fault the vessel must hear"))).toBe(true);
  }, 120_000);

  test("on the browser-worker path the host's lends never read as global assignments; CONTROL: a plain assignment does", async () => {
    // The bridge lends a name only where the host lacks it. Node already holds `global`, `Buffer`, `process`,
    // `setImmediate` and `clearImmediate` as its own enumerable globals, so on this host the bridge lends none
    // of them, and the leak check reads Node's own keys. The vector asks about what the BRIDGE defined.
    const standingBefore = new Set(Object.keys(globalThis));
    const warned = new Set<string>();
    const log = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      if (String(args[0]).includes("Global assignment detected")) for (const name of (args[1] as string[]) ?? []) warned.add(name);
    });
    const engine = await bootGenesisWiki({ path: "browser-worker" });
    engines.push(engine);
    const leaks = LENT_NAMES.filter((name) => warned.has(name) && !standingBefore.has(name));
    expect(leaks, "lent names reported as global assignments").toEqual([]);
    // CONTROL: the fork's leak check still sees a plain enumerable assignment on the global.
    const g = globalThis as Record<string, unknown>;
    g["larProbeLeak"] = 1;
    try {
      warned.clear();
      loose(engine).utils.evalSandboxed("exports.ok = true;", { exports: {} }, "control.js");
      expect(warned.has("larProbeLeak")).toBe(true);
    } finally {
      delete g["larProbeLeak"];
      log.mockRestore();
    }
  }, 120_000);
});
