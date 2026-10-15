import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LarDiskProjector } from "../src/disk-projector.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";

const CORE = join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
const BAG = "mirror-bag";
const unrelatedBag = "unmirrored-bag";
const rootPrefix = "lar:///ha.ka.ba/disk-gate";
let engine: TW5Engine;
let diskRoot = "";

beforeAll(async () => {
  engine = new TW5Engine();
  await engine.boot(new Uint8Array(readFileSync(CORE)));
}, 60_000);

afterEach(() => {
  if (engine?.$tw?.wiki) {
    for (const title of engine.$tw.wiki.getTiddlers()) if (title.startsWith(rootPrefix)) engine.$tw.wiki.deleteTiddler(title);
  }
  if (diskRoot) { rmSync(diskRoot, { recursive: true, force: true }); diskRoot = ""; }
});

function projector(carrierFileFn: (uri: string) => Promise<{ ext: string; body: string; defaultRelPath: string } | null>) {
  diskRoot = mkdtempSync(join(tmpdir(), "lar-disk-gate-"));
  return new LarDiskProjector({ mirrors: [{ bagId: BAG, mirrorRoot: diskRoot }], carrierFileFn });
}

function addCarrier(title: string, bagId = BAG): void {
  const tw = engine.$tw;
  tw.wiki.addTiddler(new tw.Tiddler({ title, text: `body:${title}`, type: "text/vnd.tiddlywiki", "$origin-bag": bagId }));
}

function fileName(title: string): string { return `${title.slice(title.indexOf("disk-gate/") + "disk-gate/".length)}.tid`; }
function diskPath(title: string): string { return join(diskRoot, title.slice("lar:///".length) + ".tid"); }
function carrierFile(uri: string) {
  return { ext: ".tid", body: `title: ${uri}\ntype: text/vnd.tiddlywiki\n\n${engine.$tw.wiki.getTiddler(uri)?.fields.text ?? ""}`, defaultRelPath: fileName(uri) };
}

describe("disk shore gate projector", () => {
  test("C: a post-seed mount projects every resident mirror root; a pre-seed mount does too", async () => {
    const afterTitles = Array.from({ length: 3 }, (_, i) => `${rootPrefix}/after-${i}`);
    for (const title of afterTitles) addCarrier(title);
    addCarrier(`${rootPrefix}/after-control`, unrelatedBag);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const counts = new Map<string, number>();
    const after = projector(async (uri) => { counts.set(uri, (counts.get(uri) ?? 0) + 1); return carrierFile(uri); });
    const stopAfter = after.start(engine);
    await after.idle();
    expect(afterTitles.map((title) => existsSync(diskPath(title)))).toEqual([true, true, true]);
    expect(afterTitles.map((title) => counts.get(title))).toEqual([1, 1, 1]);
    expect(counts.has(`${rootPrefix}/after-control`)).toBe(false);
    await stopAfter();

    const beforeTitles = Array.from({ length: 3 }, (_, i) => `${rootPrefix}/before-${i}`);
    const beforeCounts = new Map<string, number>();
    const before = projector(async (uri) => { beforeCounts.set(uri, (beforeCounts.get(uri) ?? 0) + 1); return carrierFile(uri); });
    const stopBefore = before.start(engine);
    for (const title of beforeTitles) addCarrier(title);
    addCarrier(`${rootPrefix}/before-control`, unrelatedBag);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await before.idle();
    expect(beforeTitles.map((title) => existsSync(diskPath(title)))).toEqual([true, true, true]);
    expect(beforeTitles.map((title) => beforeCounts.get(title))).toEqual([1, 1, 1]);
    expect(beforeCounts.has(`${rootPrefix}/before-control`)).toBe(false);
    expect(existsSync(diskPath(`${rootPrefix}/before-control`))).toBe(false);
    expect(existsSync(diskPath(`${rootPrefix}/after-control`))).toBe(false);
    await stopBefore();
  });

  test("D: 400 roots reconcile at most twice without timers; a repeated feed byte-skips", async () => {
    const titles = Array.from({ length: 400 }, (_, i) => `${rootPrefix}/storm-${i}`);
    const counts = new Map<string, number>();
    const p = projector(async (uri) => {
      counts.set(uri, (counts.get(uri) ?? 0) + 1);
      return carrierFile(uri);
    });
    const reconcile = (p as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile.bind(p);
    const reconciles = new Map<string, number>();
    (p as unknown as { reconcile: (uri: string) => Promise<void> }).reconcile = async (uri) => {
      reconciles.set(uri, (reconciles.get(uri) ?? 0) + 1);
      await reconcile(uri);
    };
    let writes = 0;
    const atomicWrite = (p as unknown as { atomicWrite: (path: string, body: string | Buffer) => void }).atomicWrite.bind(p);
    (p as unknown as { atomicWrite: (path: string, body: string | Buffer) => void }).atomicWrite = (path, body) => { writes++; atomicWrite(path, body); };
    const stop = p.start(engine);
    await p.idle();
    const timerSpy = vi.spyOn(globalThis, "setTimeout");
    const firstReconciles = new Map<string, number>();
    for (const title of titles) addCarrier(title);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await p.idle();
    expect(titles.every((title) => (reconciles.get(title) ?? 0) >= 1 && (reconciles.get(title) ?? 0) <= 2)).toBe(true);
    for (const title of titles) firstReconciles.set(title, reconciles.get(title) ?? 0);
    expect(titles.every((title) => existsSync(diskPath(title)))).toBe(true);
    expect(timerSpy).not.toHaveBeenCalled();
    const firstWrites = writes;
    for (let i = 0; i < titles.length; i++) {
      const tw = engine.$tw;
      tw.wiki.addTiddler(new tw.Tiddler({ title: titles[i], text: `body:${titles[i]}`, type: "text/vnd.tiddlywiki", "$origin-bag": BAG, modified: `202601010000000${i % 10}00` }));
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    await p.idle();
    expect(titles.every((title) => {
      const added = (reconciles.get(title) ?? 0) - firstReconciles.get(title)!;
      return added >= 1 && added <= 2;
    })).toBe(true);
    expect(writes).toBe(firstWrites);
    expect(timerSpy).not.toHaveBeenCalled();
    timerSpy.mockRestore();
    await stop();
  });

  test("teardown waits for the held reconcile to finish its file write", async () => {
    const title = `${rootPrefix}/held-write`;
    let entered!: () => void;
    let release!: () => void;
    const inCarrierFile = new Promise<void>((resolve) => { entered = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const p = projector(async (uri) => {
      entered();
      await hold;
      return carrierFile(uri);
    });
    const stop = p.start(engine);
    addCarrier(title);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await inCarrierFile;
    let stopped = false;
    const stopping = stop().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    release();
    await stopping;
    expect(existsSync(diskPath(title))).toBe(true);
  });
});
