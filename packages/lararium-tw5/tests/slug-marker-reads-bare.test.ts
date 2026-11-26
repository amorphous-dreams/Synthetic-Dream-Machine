/**
 * slug-marker-reads-bare.test — a leading `@` on a slug at the tiddler door reads as the slug (state/decisions, "Naming
 * freedom and the `@` marker").
 *
 * An entity name carries no marker; the kind-plane segment names it. `bag declare` already drops a leading `@`
 * (bag-declare-cmd.ts `bagArg`), so the content doors read the same name the same way: `bag: "@notes"` lands in the bag
 * `notes`, and `recipe: "@sdm"` names the wiki `sdm`. A bag URI passes through untouched.
 *
 *   AT1  bag `@daemon` lands in `lar:///ha.ka.ba/bags/daemon`, alike to the bare slug beside it (the control)
 *   AT2  recipe `@sdm` names the wiki `sdm`, never `@sdm`
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeTiddlerPutReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/at-slug";
const meme = `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/at-slug"\n\`\`\`\n\n<<~ ahu slot=\`#/x\`>>\n\n! x\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
const ctx = (): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: async () => ({ ok: true }) });

function rig() {
  const composite = new CompositeStore();
  const daemon = new MemoryTiddlerStore(bagUri("daemon"));
  composite.addLayer({ bagId: bagUri("daemon"), store: daemon, writable: true });
  const opts: TiddlerVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as TiddlerVerbOptions["tw5"],
  };
  return { opts, daemon };
}
const put = async (opts: TiddlerVerbOptions, args: Record<string, unknown>): Promise<string> => {
  try { await makeTiddlerPutReactor(opts)({ title: URI, text: meme, ...args }, ctx()); return "(landed)"; }
  catch (e) { return e instanceof Error ? e.message : String(e); }
};

describe("the tiddler door reads a leading @ on a slug as the slug", () => {
  test("AT1 — bag `@daemon` lands in the bag `daemon`; CONTROL: the bare slug lands there too", async () => {
    const control = rig();
    expect(await put(control.opts, { bag: "daemon" })).toBe("(landed)");
    expect(await control.daemon.get(URI)).not.toBeNull();
    const r = rig();
    expect(await put(r.opts, { bag: "@daemon" })).toBe("(landed)");
    expect(await r.daemon.get(URI)).not.toBeNull();
    expect(await r.daemon.get(`${URI}#/x`)).not.toBeNull();
  });

  test("AT2 — recipe `@sdm` names the wiki `sdm`", async () => {
    const r = rig();
    const said = await put(r.opts, { recipe: "@sdm" });
    expect(said).toMatch(/^wiki-unreached: .*"sdm"/);
    expect(said).not.toContain("@sdm");
    expect(await r.daemon.get(URI)).toBeNull();
  });
});
