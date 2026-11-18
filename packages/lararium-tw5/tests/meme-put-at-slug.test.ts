/**
 * meme-put-at-slug.test — a leading `@` on a slug at the meme doors reads as the slug (state/decisions, "Naming freedom
 * and the `@` marker").
 *
 * An entity name carries no marker; the kind-plane segment names it. `bag declare` already drops a leading `@`
 * (bag-declare-cmd.ts `bagArg`), so the content doors read the same name the same way: `bag: "@notes"` lands in the bag
 * `notes`, and `recipe: "@sdm"` resolves the wiki `sdm`. A bag URI passes through untouched.
 *
 *   AT1 RED  bag `@daemon` lands in `lar:///ha.ka.ba/bags/daemon`, alike to the bare slug beside it (the control)
 *   AT2 RED  recipe `@sdm` asks the registry for `sdm`, never `@sdm`
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
  const asked: string[] = [];
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    recipeOf: async (slug) => { asked.push(slug); return null; },
  };
  return { opts, daemon, asked };
}
const put = async (opts: MemeVerbOptions, args: Record<string, unknown>): Promise<string> => {
  try { await makeMemePutReactor(opts)({ uri: URI, text: meme, ...args }, ctx()); return "(landed)"; }
  catch (e) { return e instanceof Error ? e.message : String(e); }
};

describe("meme-put reads a leading @ on a slug as the slug", () => {
  test("AT1 — bag `@daemon` lands in the bag `daemon`; CONTROL: the bare slug lands there too", async () => {
    const control = rig();
    expect(await put(control.opts, { bag: "daemon" })).toBe("(landed)");
    expect(await control.daemon.get(URI)).not.toBeNull();
    const r = rig();
    expect(await put(r.opts, { bag: "@daemon" })).toBe("(landed)");
    expect(await r.daemon.get(URI)).not.toBeNull();
  });

  test("AT2 — recipe `@sdm` asks the registry for the wiki `sdm`", async () => {
    const r = rig();
    const said = await put(r.opts, { recipe: "@sdm" });
    expect(r.asked).toEqual(["sdm"]);
    expect(said).toContain('recipe "sdm" not found in any registry plane');
    expect(await r.daemon.get(URI)).toBeNull();
  });
});
