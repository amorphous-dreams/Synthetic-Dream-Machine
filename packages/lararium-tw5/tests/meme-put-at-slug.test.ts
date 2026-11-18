/**
 * meme-put-at-slug.test — an `@`-prefixed slug through `meme-put` (the checks-owed witness).
 *
 * `bagUriOf` hands a bare slug to `bagUri`, so `bag: "@sdm"` reads as the bag `lar:///ha.ka.ba/bags/@sdm`. This pins what the
 * door does with it today: it never misroutes (no put lands in the daemon bag or any other layer) and it refuses by name,
 * `holds no writable layer`, exactly as a plain unknown slug does (the control). A recipe `@sdm` names no wiki and refuses.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/at-slug";
const meme = `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/at-slug"\n\`\`\`\n\n<<~ ahu slot=\`#/x\`>>\n\n! x\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
const ctx = (): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: async () => ({ ok: true }) });

function rig() {
  const composite = new CompositeStore();
  const daemon = new MemoryTiddlerStore(bagUri("daemon"));
  composite.addLayer({ bagId: bagUri("daemon"), store: daemon, writable: true });
  const opts: MemeVerbOptions = { composite, tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"] };
  return { opts, daemon };
}
const refusal = async (opts: MemeVerbOptions, args: Record<string, unknown>): Promise<string> => {
  try { await makeMemePutReactor(opts)({ uri: URI, text: meme, ...args }, ctx()); return "(landed)"; }
  catch (e) { return e instanceof Error ? e.message : String(e); }
};

describe("meme-put with an @-prefixed slug", () => {
  test("bag `@sdm` refuses by name, alike to a plain unknown slug beside it, and lands nothing", async () => {
    const r = rig();
    const said = await refusal(r.opts, { bag: "@sdm" });
    expect(said).toContain(`"${bagUri("@sdm")}"`);
    expect(said).toContain("holds no writable layer");
    expect(said.replace("@sdm", "SLUG")).toBe((await refusal(r.opts, { bag: "sdm" })).replace("sdm", "SLUG"));
    expect(await r.daemon.get(URI)).toBeNull();
  });

  test("recipe `@sdm` refuses and lands nothing", async () => {
    const r = rig();
    const said = await refusal(r.opts, { recipe: "@sdm" });
    expect(said).toContain('recipe "@sdm" not found in any registry plane');
    expect(await r.daemon.get(URI)).toBeNull();
  });
});
