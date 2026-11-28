/**
 * working-layer-records-off-disk — the daemon's state records rest in the state document, so the working layer's
 * disk mirror never meets one.
 *
 * Placement decides residency: a receipt fact and a summons rest in the vessel's state document
 * (`vessel-state`), which no mirror names. The working layer holds only what its own writers put there, so a mounted
 * mirror projects the ordinary title and nothing else.
 */
import { vendoredCore } from "../../lararium-tw5/tests/test-wiki.js";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { buildReceiptFact, summon } from "@lararium/mesh/verb-tiddler";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { LarDiskProjector } from "../src/disk-projector.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { fileWardRefusal } from "../../lararium-tw5/src/worker-data-verbs.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";

const WORKING = wikiSlotUri("daemon", "working");
let engine: TW5Engine;
let diskRoot = "";

beforeAll(async () => {
  engine = new TW5Engine();
  await engine.boot(vendoredCore());
}, 60_000);
afterEach(() => { if (diskRoot) { rmSync(diskRoot, { recursive: true, force: true }); diskRoot = ""; } });

const filesUnder = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: "utf8" });

describe("daemon state records never reach the working layer's disk mirror", () => {
  test("a receipt fact and a summons rest in the state document and project no file; an ordinary title projects", async () => {
    const working = new MemoryTiddlerStore(WORKING);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const controlBag = new MemoryTiddlerStore(VESSEL_STATE_ID);
    const state = new CompositeStore();
    state.addLayer({ bagId: VESSEL_STATE_ID, store: controlBag, writable: true, defaultWritable: true });
    const origin = { kind: "test" } as const;
    await state.put(buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" }), origin);
    await fileWardRefusal(composite, state, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    await state.put(summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" }), origin);
    await composite.put({ tiddler: { title: "lar:///ha.ka.ba/t/daemon/ordinary", text: "an ordinary note" } }, origin);

    const controlTitles = await controlBag.listVisible();
    const bookkeeping = controlTitles.filter((t) => t.includes("/receipts/") || t.includes("/summons/"));
    expect(bookkeeping.length, "the records did not land in the state document").toBe(2);
    const titles = await working.listVisible();
    expect(titles, "a state record reached the working layer").toEqual(["lar:///ha.ka.ba/t/daemon/ordinary"]);

    diskRoot = mkdtempSync(join(tmpdir(), "lar-records-off-disk-"));
    const tw = engine.$tw;
    for (const title of titles) {
      const rec = (await working.get(title)) as LarTiddlerRecord;
      tw.wiki.addTiddler(new tw.Tiddler({ ...(rec.tiddler as Record<string, string>), "$origin-bag": WORKING }));
    }
    const projector = new LarDiskProjector({
      mirrors: [{ bagId: WORKING, mirrorRoot: diskRoot }],
      carrierFileFn: async (uri) => ({ ext: ".mem", body: `body of ${uri}\n`, defaultRelPath: `${uri.slice("lar:///".length)}.mem` }),
    });
    const stop = projector.start(engine);
    await projector.idle();
    await stop();
    const files = filesUnder(diskRoot).filter((f) => f.endsWith(".mem"));
    expect(files, "a bookkeeping record reached the mirror").toEqual(["ha.ka.ba/t/daemon/ordinary.mem"]);
    expect(existsSync(join(diskRoot, "ha.ka.ba/t/daemon/ordinary.mem"))).toBe(true);
    for (const title of titles) tw.wiki.deleteTiddler(title);
  }, 60_000);
});
