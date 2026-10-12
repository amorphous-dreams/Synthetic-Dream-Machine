/**
 * working-layer-records-off-disk — the daemon's bookkeeping records follow the working layer and stay off its disk mirror.
 *
 * A receipt fact and a ward audit land in the working document like any bagless write. Each carries the
 * `disk-projection: no` opt-out the projector honours, so a mounted mirror receives no file for them; an
 * ordinary working-layer title projects.
 */
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore, buildReceiptFact, summon, wikiSlotUri, type LarTiddlerRecord } from "@lararium/mesh";
import { LarDiskProjector } from "../src/disk-projector.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { fileWardRefusal } from "../../lararium-tw5/src/worker-data-verbs.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
const WORKING = wikiSlotUri("daemon", "working");
let engine: TW5Engine;
let diskRoot = "";

beforeAll(async () => {
  engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(CORE)));
}, 60_000);
afterEach(() => { if (diskRoot) { rmSync(diskRoot, { recursive: true, force: true }); diskRoot = ""; } });

const filesUnder = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: "utf8" });

describe("daemon bookkeeping records stay off the working layer's disk mirror", () => {
  test("a receipt fact, a ward audit and a summons land in the working document and project no file; an ordinary title projects", async () => {
    const working = new MemoryTiddlerStore(WORKING);
    const composite = new CompositeStore();
    composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
    const origin = { kind: "test" } as const;
    await composite.put(buildReceiptFact({ requestId: "r1", state: "committed", seq: 0, inputDigest: "d" }), origin);
    await fileWardRefusal(composite, () => {}, { bagId: "mirror", uri: "lar:///ward/x", reason: "refused" });
    await composite.put(summon({ verb: "v", args: {}, requestedBy: "did:key:z", requestId: "s1" }), origin);
    await composite.put({ tiddler: { title: "lar:///ha.ka.ba/t/daemon/ordinary", text: "an ordinary note" } }, origin);

    const titles = await working.listVisible();
    const bookkeeping = titles.filter((t) => t.includes("/receipts/") || t.includes("/ledger/ward/") || t.includes("/summons/"));
    expect(bookkeeping.length, "the records did not land in the working document").toBe(3);

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
