import { afterEach, expect, test } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { daemonWorkingMirror, kahuaFaceFolder } from "../src/bag-paths.js";
import { LarDiskProjector } from "../src/disk-projector.js";

const bag = wikiSlotUri("daemon", "working");
const title = "lar:///ha.ka.ba/t/daemon/shadow-test";
const tag = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
const origin = { kind: "test" } as const;
let root = "";
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); });

async function rig() {
  root = mkdtempSync(join(tmpdir(), "kapae-disk-"));
  const store = new MemoryTiddlerStore(bag);
  await store.put({ tiddler: { title, text: "live" } }, origin);
  const projector = new LarDiskProjector({
    mirrors: [daemonWorkingMirror(root, tag)],
    carrierFileFn: async () => ({ ext: ".mem", body: "live", defaultRelPath: "ha.ka.ba/t/daemon/shadow-test.mem" }),
    recoveryStore: () => store,
    bagsHolding: async () => { const record = await store.get(title); return record && !record.meta?.deleted ? [bag] : []; },
  });
  const internal = projector as unknown as { flush(b: string, t: string): Promise<void>; reconcile(t: string): Promise<void> };
  await internal.flush(bag, title);
  const stem = join(root, "wikis", kahuaFaceFolder(tag), "ha.ka.ba/t/daemon/shadow-test");
  return { store, internal, stem };
}

test("exclusion projects a persistent kāpae alongside the removed carrier", async () => {
  const { store, internal, stem } = await rig();
  expect(existsSync(stem + ".mem")).toBe(true);
  await store.tombstone(title, origin);
  await internal.reconcile(title);
  expect(existsSync(stem + ".mem")).toBe(false);
  expect(JSON.parse(readFileSync(stem + ".kapae", "utf8"))).toEqual({ title, kapae: "raised" });
});

test("control: retract-to-absent leaves no kāpae", async () => {
  const { store, internal, stem } = await rig();
  const canon = new MemoryTiddlerStore("canon");
  await canon.put({ tiddler: { title, text: "canon" } }, origin);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: "canon", store: canon, writable: false });
  composite.addLayer({ bagId: bag, store, writable: true });
  expect((await composite.get(title))?.tiddler.text).toBe("live");
  await store.remove(title, origin);
  await internal.reconcile(title);
  expect(existsSync(stem + ".mem")).toBe(false);
  expect(existsSync(stem + ".kapae")).toBe(false);
  expect((await composite.get(title))?.tiddler.text).toBe("canon");
});

test("control: lowering the kāpae (the record returns live) takes the shadow down as the carrier writes back", async () => {
  const { store, internal, stem } = await rig();
  await store.tombstone(title, origin);
  await internal.reconcile(title);
  expect(existsSync(stem + ".kapae")).toBe(true);
  await store.put({ tiddler: { title, text: "live" } }, origin);
  await internal.flush(bag, title);
  expect(existsSync(stem + ".mem")).toBe(true);
  expect(existsSync(stem + ".kapae")).toBe(false);
});
