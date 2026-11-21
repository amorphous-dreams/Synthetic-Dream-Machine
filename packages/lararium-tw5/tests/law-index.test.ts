/**
 * law-index — the law index derives from canon in the wiki's own engine, its pins first.
 *
 * The daemon wiki seeds two config tiddlers into its shadow layer (`daemon-law-tiddlers`): the law (a filter over every
 * root meme under a bag's `api/` tree) and the pin set (the boot seed, then the Mu family). `LAW_INDEX_FILTER` composes
 * them, and the tiddler door answers it as TiddlyWiki answers any filter. A pin a face writes lands in its working layer
 * over the seeded shadow, and the index reads it at once.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-law-tiddlers
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWikiFilterReactor, makeTiddlerGetReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
import {
  seedDaemonLawTiddlers, DAEMON_LAW_TIDDLERS, LAW_INDEX_FILTER, LAW_PINS_FILTER, LAW_PINS_TITLE, LAW_FILTER_TITLE, LAW_BOOT_SEED, LAW_MU_ROOT,
} from "../src/daemon-law-tiddlers.js";
import { seedDaemonProtocol } from "../src/daemon-protocol-seed.js";
import { HULLS_TS_ONLY } from "@lararium/mesh";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const CANON = bagUri("lares");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const API = "lar:///ha.ka.ba/lares/api";
const law = (title: string, role: string): Record<string, string> => ({ title, role, type: "text/vnd.tiddlywiki", text: role });

/** Canon in small: law under two bags' api trees, the Mu family, a slot, a docs record and a memory row. */
const CANON_ROWS = [
  law(LAW_BOOT_SEED, "the constitution"),
  law(LAW_MU_ROOT, "null-oracle core"),
  law(`${API}/mu/the-four-tools`, "the four tools"),
  law(`${API}/mu/chao`, "chao"),
  law(`${API}/pono/lar-uri`, "the address law"),
  law(`${API}/pono/drift-ward`, "the ward"),
  law(`${API}/masks/stage`, "the mask stage"),
  law("lar:///ha.ka.ba/lararium/api/residency-model", "the residency model"),
  law(`${API}/pono/lar-uri#/anatomy`, "a slot"),
  law("lar:///ha.ka.ba/lares/docs/pono/grammar-watch", "a docs record"),
  law("lar:///ha.ka.ba/kahua/memory/state/handoff", "a memory row"),
];

type Cap = VerbContext["cap"];
const writer: Cap = async (access, bag) => (bag === DAEMON || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" });
const ctx = (): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: writer });

async function rig(seed = true) {
  const engine = await bootTestWiki({ tiddlers: [{ title: WORKING_POINTER, text: DAEMON }, ...CANON_ROWS] });
  if (seed) seedDaemonLawTiddlers(engine);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: new MemoryTiddlerStore(CANON), writable: false });
  composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
  const opts: TiddlerVerbOptions = { composite, tw5: engine };
  const filter = async (f: string): Promise<string[]> => (await makeWikiFilterReactor(opts)({ recipe: "default", filter: f }, ctx()))["titles"] as string[];
  return { engine, opts, filter };
}

describe("the law config seed", () => {
  test("the seed lays the pin set and the law as shadows, beside the rest of the protocol seed", () => {
    const shadows: { plugin: string; titles: string[] }[] = [];
    const engine = { setTiddler: () => { throw new Error("an ordinary write"); }, setShadowTiddlers: (plugin: string, records: readonly Record<string, unknown>[]) => { shadows.push({ plugin, titles: records.map((r) => String(r["title"])) }); } };
    seedDaemonProtocol(engine as unknown as TW5Engine, HULLS_TS_ONLY);
    const lawPlugin = shadows.find((s) => s.titles.includes(LAW_PINS_TITLE));
    expect(lawPlugin?.titles).toEqual([LAW_PINS_TITLE, LAW_FILTER_TITLE]);
    expect(lawPlugin?.plugin.startsWith("$:/temp/")).toBe(true);
    expect(DAEMON_LAW_TIDDLERS.map((r) => r["title"])).toEqual([LAW_PINS_TITLE, LAW_FILTER_TITLE]);
  });
});

describe.skipIf(wikiSkip)(`the law index in the wiki's own engine${skipNote}`, () => {
  test("derivation: every root meme under a bag's api tree, sorted; CONTROL: a slot, a docs record and a memory row stay out", async () => {
    const r = await rig();
    const rows = await r.filter(`[subfilter{${LAW_FILTER_TITLE}}]`);
    expect(rows).toEqual([
      `${API}/masks/stage`, LAW_MU_ROOT, `${API}/mu/chao`, `${API}/mu/the-four-tools`, LAW_BOOT_SEED,
      `${API}/pono/drift-ward`, `${API}/pono/lar-uri`, "lar:///ha.ka.ba/lararium/api/residency-model",
    ].sort());
    expect(rows).not.toContain(`${API}/pono/lar-uri#/anatomy`);
    expect(rows).not.toContain("lar:///ha.ka.ba/lares/docs/pono/grammar-watch");
    expect(rows).not.toContain("lar:///ha.ka.ba/kahua/memory/state/handoff");
  });

  test("pin order: the boot seed, the Mu root, the Mu members by title, then the law the pins left out, each once", async () => {
    const r = await rig();
    const pins = [LAW_BOOT_SEED, LAW_MU_ROOT, `${API}/mu/chao`, `${API}/mu/the-four-tools`];
    expect(await r.filter(LAW_PINS_FILTER)).toEqual(pins);
    expect(await r.filter(LAW_INDEX_FILTER)).toEqual([
      ...pins,
      "lar:///ha.ka.ba/lararium/api/residency-model", `${API}/masks/stage`, `${API}/pono/drift-ward`, `${API}/pono/lar-uri`,
    ]);
  });

  test("a pin a face writes lands in its working layer over the shadow, and the index reads it first; an unpin run drops a derived member", async () => {
    const r = await rig();
    const get = await makeTiddlerGetReactor(r.opts)({ recipe: "default", title: LAW_PINS_TITLE }, ctx());
    const held = get["tiddler"] as { hash: string; fields: Record<string, string> };
    const text = `${held.fields["text"]} [[${API}/pono/lar-uri]] -[[${API}/mu/chao]]`;
    const put = await makeTiddlerPutReactor(r.opts)({ recipe: "default", title: LAW_PINS_TITLE, text, base: held.hash }, ctx());
    expect(put["decision"]).toBe("put");
    expect(await r.filter(LAW_INDEX_FILTER)).toEqual([
      LAW_BOOT_SEED, LAW_MU_ROOT, `${API}/mu/the-four-tools`, `${API}/pono/lar-uri`,
      "lar:///ha.ka.ba/lararium/api/residency-model", `${API}/masks/stage`, `${API}/mu/chao`, `${API}/pono/drift-ward`,
    ]);
  });

  test("a pin naming no tiddler stays out of the index; CONTROL: with no law config standing, the index answers nothing and refuses nothing", async () => {
    const r = await rig();
    r.engine.wiki.addTiddler({ title: LAW_PINS_TITLE, text: `[[${LAW_BOOT_SEED}]] [[lar:///ha.ka.ba/lares/api/pono/absent]]` });
    expect((await r.filter(LAW_INDEX_FILTER))[0]).toBe(LAW_BOOT_SEED);
    expect(await r.filter(LAW_INDEX_FILTER)).not.toContain("lar:///ha.ka.ba/lares/api/pono/absent");
    const bare = await rig(false);
    expect(await bare.filter(LAW_INDEX_FILTER)).toEqual([]);
  });
});
