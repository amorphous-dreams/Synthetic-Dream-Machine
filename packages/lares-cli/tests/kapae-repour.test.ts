/**
 * A BURNED ROW STAYS BURNED ACROSS A RE-POUR. The working layer's projection exports a burned row (a kāpae
 * raised over it) and a live row; the export pours into a FRESH root whose canon still holds the burned
 * title. The shadow file raises the kāpae there, so the canon copy stays shadowed, and the live row stands.
 * The control pours the same export with its shadow withheld (the measured gap before this lane): the canon
 * copy falls through and the burned row comes back, so the proof reads a resurrection where one happens.
 */
import { afterEach, expect, test } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeStore, wikiSlotUri, type CapabilityAccess, type CapabilityVerifyResult, type Verb, type VerbContext } from "@lararium/mesh";
import { LarDiskProjector, SyncedTree } from "@lararium/node";
import { MemoryTiddlerStore, registerActionReactors, VerbTable } from "@lararium/tw5";
import { scanSource, candidatesOf } from "../src/ingest-core.js";

const bag = wikiSlotUri("daemon", "working");
const burned = "lar:///ha.ka.ba/t/repour/burned";
const live = "lar:///ha.ka.ba/t/repour/live";
const origin = { kind: "test" } as const;
const framed = (uri: string, prose: string): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\n` +
  `${prose}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

const roots: string[] = [];
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

/** The first root: a working layer projects both rows, then burns one. Answers the mirror the export stands in. */
async function exportFromFirstRoot(): Promise<{ root: string; mirrorRoot: string }> {
  const root = mkdtempSync(join(tmpdir(), "kapae-repour-a-"));
  roots.push(root);
  const mirrorRoot = join(root, "wikis", "kahua-repour");
  const store = new MemoryTiddlerStore(bag);
  for (const uri of [burned, live]) await store.put({ tiddler: { title: uri, text: framed(uri, `the ${uri} prose`) } }, origin);
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: bag, mirrorRoot }],
    carrierFileFn: async (uri) => ({ ext: ".mem", body: framed(uri, `the ${uri} prose`), defaultRelPath: `${uri.slice("lar:///".length)}.mem` }),
    recoveryStore: () => store,
    bagsHolding: async (uri) => { const record = await store.get(uri); return record && !record.meta?.deleted ? [bag] : []; },
    syncedTree: new SyncedTree(join(root, "synced")),
  });
  const internal = projector as unknown as { flush(b: string, t: string): Promise<void>; reconcile(t: string): Promise<void> };
  for (const uri of [burned, live]) await internal.flush(bag, uri);
  await store.tombstone(burned, origin);
  await internal.reconcile(burned);
  return { root, mirrorRoot };
}

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });

/** The fresh root: canon holds the burned title beneath an empty working layer; the export pours in. */
async function pourIntoFreshRoot(exported: { root: string; mirrorRoot: string }, withShadows: boolean): Promise<CompositeStore> {
  const fresh = mkdtempSync(join(tmpdir(), "kapae-repour-b-"));
  roots.push(fresh);
  const canon = new MemoryTiddlerStore("lar:///ha.ka.ba/bags/repour-canon");
  await canon.put({ tiddler: { title: burned, text: "the canon copy the operator believed gone" } }, origin);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: "lar:///ha.ka.ba/bags/repour-canon", store: canon, writable: false });
  composite.addLayer({ bagId: bag, store: new MemoryTiddlerStore(bag), writable: true });

  const scan = scanSource(exported.root, exported.mirrorRoot, bag, new SyncedTree(join(fresh, "synced")))!;
  const shadows = withShadows ? scan.shadows ?? [] : [];
  const args: Record<string, unknown> = {
    "source-uri": `file://${exported.mirrorRoot}`, "to-bag": bag, "change-id": "chg-repour",
    carriers: candidatesOf(scan.rows).map((r) => ({ uri: r.uri, file: r.file, text: r.text, diskHash: r.diskHash, syncedHash: r.syncedHash, ext: r.ext })),
    ...(shadows.length > 0 ? { kapae: shadows } : {}),
  };
  const invocation: Verb = {
    requestId: "req-repour", title: "lar:///lararium.local.vm/verbs/req-repour",
    action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-11-07T00:00:00Z",
  };
  const ctx: VerbContext = { daemon: composite, invocation, cap: allowCap };
  const table = new VerbTable();
  registerActionReactors(table, { composite });
  const result = await table.get("INGEST")!(args, ctx) as Record<string, unknown>;
  if (withShadows) expect((result["kapae"] as { raised: string[] }).raised).toEqual([burned]);
  return composite;
}

test("a burned row re-poured into a fresh root stays shadowed over its canon copy; the live row stands", async () => {
  const exported = await exportFromFirstRoot();
  const stem = join(exported.mirrorRoot, "ha.ka.ba/t/repour/burned");
  expect(existsSync(stem + ".mem")).toBe(false);
  expect(existsSync(stem + ".kapae")).toBe(true);
  const composite = await pourIntoFreshRoot(exported, true);
  // The resolved view meets the kāpae first: a tombstone, never the canon copy beneath it.
  const seen = await composite.get(burned);
  expect(seen?.meta?.deleted).toBe(true);
  expect(seen?.tiddler.text).toBeUndefined();
  expect((await composite.get(live))?.tiddler.text).toContain(`the ${live} prose`);
});

test("control: the same export poured without its shadow lets the canon copy fall through (the resurrection)", async () => {
  const exported = await exportFromFirstRoot();
  const composite = await pourIntoFreshRoot(exported, false);
  expect((await composite.get(burned))?.tiddler.text).toBe("the canon copy the operator believed gone");
  expect((await composite.get(live))?.tiddler.text).toContain(`the ${live} prose`);
});
