/**
 * seed-fixed-point-corpus — the seed finds its fixed point over the WHOLE house corpus.
 *
 * A fixture pins the grammar; only the corpus pins the reader. This vector copies every tracked file
 * of both house bags into a scratch workspace, walks the seed's own gesture over it (the scan, the
 * INGEST reactor through a booted wiki behind the daemon's own outcome bound, the settling gesture
 * that asks again under the row cap and pins what landed), mounts the records in
 * that wiki, and runs the disk projector over the scratch mirrors with the congruences the island
 * wires. Then it reads the scratch tree back.
 *
 * The law it holds: disk and records co-project, and a projection of an unchanged carrier writes
 * nothing. So after the seed every file reads byte for byte as it arrived, no file arrived or left,
 * no standoff surfaced, a second scan reads every carrier `unchanged`, and a second projection pass
 * writes nothing. A carrier whose render differs from its bytes on disk says the same thing in another
 * framing: the projector pins the base and leaves the file, and the vector names which framing class
 * each such carrier falls in. A carrier outside every named class fails the vector.
 *
 * The run never writes into the tracked tree: every path it writes sits under one scratch directory.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BAG_MANIFEST_FILE, CompositeStore, VERB_RESULT_KEY, bagUri } from "@lararium/mesh";
import type { CapabilityAccess, CapabilityVerifyResult, Verb, VerbContext } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { VerbTable } from "../../lararium-tw5/src/verb-dispatcher.js";
import { registerActionReactors, makeTw5Deserializer } from "../../lararium-tw5/src/action-handler.js";
import { TW5Engine } from "../../lararium-tw5/src/tw5-vm.js";
import { exportCarrierFile } from "../../lararium-tw5/src/meme-write.js";
import { canonicalizeCarrierText } from "../../lararium-tw5/src/carrier-canonical.js";
import { canonicalizeNativeCarrierText } from "../../lararium-tw5/src/native-canonical.js";
import { parseTaploFields } from "../../lararium-tw5/src/toml-ast.js";
import LARES_MEMETIC_WIKITEXT_PLUGIN from "../../lararium-tw5/plugins/lares-memetic-wikitext.json" with { type: "json" };
import { TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME } from "../../lararium-tw5/src/generated-tw5-version.js";
import { candidatesOf, scanSource, settleIngest, type ScanRow, type SubmitIngestOpts } from "../../lares-cli/src/ingest-core.js";
import type { SubmitResult } from "../../lares-cli/src/verb-result.js";
import { boundOutcomeOutput } from "../../lararium-tw5/src/verb-vm.js";
import { LarDiskProjector } from "../src/disk-projector.js";
import { SyncedTree } from "../src/synced-tree.js";

const REPO = new URL("../../..", import.meta.url).pathname;
const CORE = path.join(TW5_CORE_DIR, TW5_CORE_SCRIPT_FILENAME);
const coreBlobSkip = existsSync(CORE)
  ? false
  : `TW5 core blob absent at ${CORE} — run: pnpm --filter @lararium/tw5 build:tw5-vendor`;

/** The house bags the seed carries. */
const HOUSE_BAGS = ["lares", "lararium"] as const;

/** Every tracked file under one bag, repo-relative. */
function trackedFiles(bag: string): string[] {
  return execFileSync("git", ["ls-files", "-z", "--", `bags/${bag}`], { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0").filter((f) => f !== "");
}

/** Every file under a directory, relative to it, sorted. */
function walk(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => statSync(path.join(dir, f)).isFile())
    .map((f) => f.split(path.sep).join("/"))
    .sort();
}

const allowCap = async (_a: CapabilityAccess, _b: string): Promise<CapabilityVerifyResult> => ({ ok: true });
function ctx(composite: CompositeStore, args: Record<string, unknown>, requestId: string): VerbContext {
  const invocation: Verb = {
    requestId, title: `lar:///lararium.local.vm/verbs/${requestId}`,
    action: "INGEST", args, targets: [], batchMode: "best-effort",
    status: "pending", requestedBy: "operator-test", requestedAt: "2026-10-13T00:00:00Z",
  };
  return { daemon: composite, invocation, cap: allowCap };
}

/** The INGEST carriers as the gesture packs them (`submitIngest`), bodies inline. */
function wireCarriers(candidates: readonly ScanRow[]): Array<Record<string, unknown>> {
  return candidates.map((r) => ({
    uri: r.uri, file: r.file, size: Buffer.byteLength(r.text, "utf8"), diskHash: r.diskHash, syncedHash: r.syncedHash,
    ...(r.syncedRecordsHash !== undefined ? { syncedRecordsHash: r.syncedRecordsHash } : {}),
    ext: r.ext, text: r.text, ...(r.meta !== undefined ? { meta: r.meta } : {}),
  }));
}

// ── The framing classes a canonical render may move, each backed by the writer's law ───────────────
// (`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing#/canonical-form`). A class names what a later
// REAL change would normalize as it writes; an unchanged carrier keeps its bytes.
const META_FENCE_RE = /```toml meta\n[\s\S]*?\n```\n/g;
const CHECK_RE = /ni:\/\/\/sha-256;[A-Za-z0-9_-]+/g;
const noCheck = (t: string) => t.replace(CHECK_RE, "ni:///sha-256;<CHECK>");
const noMeta = (t: string) => noCheck(t).replace(META_FENCE_RE, "```toml meta\n<META>\n```\n");
const noMargins = (t: string) => noMeta(t).replace(/\n{2,}/g, "\n");
const sidecarSet = (t: string) => t.split("\n").filter((l) => l !== "").sort().join("\n");

/** One meta fence read as data: sorted key and value pairs, whatever order, column or table spelling the fence wears. */
function metaData(fence: string): string {
  const fields = parseTaploFields(fence.replace(/^```toml meta\n/, "").replace(/\n```\n$/, ""));
  return JSON.stringify(Object.keys(fields).sort().map((k) => [k, fields[k]]));
}

type FramingClass = "check-restamp" | "meta-layout" | "blank-margin" | "sidecar-layout";

/** The named classes that together account for the distance between a carrier's bytes and its render, or null. */
function framingClassesOf(disk: { body: string; meta?: string }, render: { body: string; meta?: string }): FramingClass[] | null {
  const out = new Set<FramingClass>();
  if (disk.body !== render.body) {
    if (noCheck(disk.body) !== noCheck(render.body)) {
      if (noMeta(disk.body) !== noMeta(render.body)) {
        if (noMargins(disk.body) !== noMargins(render.body)) return null;
        out.add("blank-margin");
      }
      const diskMeta = disk.body.match(META_FENCE_RE) ?? [], renderMeta = render.body.match(META_FENCE_RE) ?? [];
      if (diskMeta.join("") !== renderMeta.join("")) {
        // LAYOUT ALONE: each fence, read as data by the grammar's own TOML reader, states the same
        // keys and values on both sides. A key or a value the render would move names no layout.
        if (diskMeta.length !== renderMeta.length) return null;
        for (let i = 0; i < diskMeta.length; i++) if (metaData(diskMeta[i]!) !== metaData(renderMeta[i]!)) return null;
        out.add("meta-layout");
      }
    }
    out.add("check-restamp");
  }
  if (disk.meta !== render.meta) {
    if (disk.meta === undefined || render.meta === undefined) return null;
    if (sidecarSet(disk.meta) !== sidecarSet(render.meta)) return null;
    out.add("sidecar-layout");
  }
  return [...out];
}

describe.skipIf(coreBlobSkip)(
  `the seed's fixed point over both house bags${coreBlobSkip ? ` [SKIPPED: ${coreBlobSkip}]` : ""}`,
() => {
  let scratch = "";
  let engine: TW5Engine;
  let tree: SyncedTree;
  let projector: LarDiskProjector;
  const tracked = new Map<string, string[]>();
  const firstWaveRows = new Map<string, Array<Record<string, unknown>>>();
  const settlements = new Map<string, { waves: number; refused: number; conflicts: number; recorded: number; submitted: number }>();
  let pinnedByGesture: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const refusals: string[] = [];
  const stores = new Map<string, MemoryTiddlerStore>();

  beforeAll(async () => {
    scratch = mkdtempSync(path.join(tmpdir(), "lar-seed-fixed-point-"));
    for (const bag of HOUSE_BAGS) {
      const files = trackedFiles(bag);
      tracked.set(bag, files);
      for (const f of files) {
        mkdirSync(path.dirname(path.join(scratch, f)), { recursive: true });
        cpSync(path.join(REPO, f), path.join(scratch, f));
      }
    }
    engine = new TW5Engine();
    await engine.boot(new Uint8Array(readFileSync(CORE)), [LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>]);
    tree = new SyncedTree(path.join(scratch, "state", "synced-tree.json"), 0);

    // THE SEED'S GESTURE, one bag at a time: scan, INGEST, record what landed.
    const composite = new CompositeStore();
    for (const bag of HOUSE_BAGS) {
      const store = new MemoryTiddlerStore(bagUri(bag));
      stores.set(bag, store);
      composite.addLayer({ bagId: bagUri(bag), store, writable: true, defaultWritable: false });
    }
    const table = new VerbTable();
    registerActionReactors(table, { composite, tw5: makeTw5Deserializer(engine) });
    for (const bag of HOUSE_BAGS) {
      const scan = scanSource(scratch, path.join(scratch, "bags", bag), bagUri(bag), tree)!;
      const candidates = candidatesOf(scan.rows);
      // The island answers through the daemon's own outcome bound, so a whole-bag wave crosses the row cap
      // and the gesture settles it as it does against a standing vessel: asking again under the cap.
      let wave = 0;
      const submit = async (o: SubmitIngestOpts): Promise<SubmitResult> => {
        const requestId = `req-seed-${bag}-${++wave}`;
        const args = { "source-uri": `file://${scratch}/bags/${bag}`, "to-bag": o.toBag, "change-id": `seed-${bag}-${wave}`, carriers: wireCarriers(o.candidates) };
        const result = await table.get("INGEST")!(args, ctx(composite, args, requestId)) as Record<string, unknown>;
        const rows = result["carriers"] as Array<Record<string, unknown>>;
        if (wave === 1) firstWaveRows.set(bag, rows);
        return { status: "done", requestId, results: { [VERB_RESULT_KEY]: { ok: true, output: boundOutcomeOutput(result) } } } as SubmitResult;
      };
      const settled = await settleIngest({ source: path.join(scratch, "bags", bag), toBag: bagUri(bag), candidates, did: "did:test" }, tree, submit);
      settlements.set(bag, { waves: wave, refused: settled.refused.length, conflicts: settled.conflicts.length, recorded: settled.recorded, submitted: candidates.length });
    }
    tree.flush();
    pinnedByGesture = JSON.parse(readFileSync(path.join(scratch, "state", "synced-tree.json"), "utf8")) as Record<string, unknown>;

    // THE RECORDS REACH THE WIKI as a wave lands them: each under its title, stamped with the bag it came from.
    const $tw = engine.$tw as unknown as { Tiddler: new (...f: Array<Record<string, unknown>>) => unknown; wiki: { addTiddler(t: unknown): void } };
    for (const bag of HOUSE_BAGS) {
      const store = stores.get(bag)!;
      for (const title of await store.listVisible()) {
        const rec = await store.get(title);
        if (rec && !rec.meta?.deleted) $tw.wiki.addTiddler(new $tw.Tiddler(rec.tiddler as Record<string, unknown>, { "$origin-bag": bagUri(bag) }));
      }
    }

    // THE PROJECTING LEG, wired as the island wires it (`mountDiskProjection`).
    const deserializer = makeTw5Deserializer(engine);
    projector = new LarDiskProjector({
      mirrors: HOUSE_BAGS.map((bag) => ({ bagId: bagUri(bag), mirrorRoot: path.join(scratch, "bags", bag) })),
      carrierFileFn: (uri) => { try { return Promise.resolve(exportCarrierFile(engine, uri)); } catch { return Promise.resolve(null); } },
      canonicalizeFn: canonicalizeCarrierText,
      canonicalizeNativeFn: (uri, ext, body, meta) => canonicalizeNativeCarrierText(deserializer, uri, ext, body, meta),
      syncedTree: tree,
      onConflict: (info) => { conflicts.push(`${info.uri}: ${info.reason}`); },
      onRefusal: (info) => { refusals.push(`${info.uri}: ${info.reason}`); },
    });
    const stop = projector.start(engine);
    await projector.idle();
    await stop();
  }, 600_000);

  afterAll(() => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });

  test("the corpus presents both bags, and the seed lands every carrier", () => {
    for (const bag of HOUSE_BAGS) {
      const carriers = tracked.get(bag)!.filter((f) => !f.endsWith(".meta"));
      expect(carriers.length, `bags/${bag} presents carriers`).toBeGreaterThan(150);
      const rows = firstWaveRows.get(bag)!;
      const notLanded = rows.filter((r) => r["decision"] !== "ingest").map((r) => `${String(r["uri"])}: ${String(r["decision"])} ${JSON.stringify(r["warnings"] ?? r["reason"] ?? "")}`);
      expect(notLanded, `bags/${bag}: every carrier lands`).toEqual([]);
      expect(rows.length).toBeGreaterThan(150);
      // The wave crossed the outcome's row cap, and the gesture still pinned a base for every carrier.
      const settled = settlements.get(bag)!;
      expect(settled.submitted).toBe(rows.length);
      expect(settled.recorded).toBe(rows.length);
      expect(settled.refused + settled.conflicts).toBe(0);
    }
  });

  test("the gesture and the projector pin the same base: the projection pass moves no row of the tree", () => {
    const after = JSON.parse(readFileSync(path.join(scratch, "state", "synced-tree.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys(pinnedByGesture).length).toBeGreaterThan(300);
    expect(after).toEqual(pinnedByGesture);
    // The setup took: some base holds two sides that differ (a carrier standing in another framing).
    const twoSided = Object.values(after).filter((b) => (b as { disk: string; records: string }).disk !== (b as { disk: string; records: string }).records);
    expect(twoSided.length).toBeGreaterThan(10);
  });

  test("the projection wrote nothing: every tracked file reads byte for byte as it arrived", () => {
    const moved: string[] = [];
    for (const bag of HOUSE_BAGS) {
      for (const f of tracked.get(bag)!) {
        const at = path.join(scratch, f);
        if (!existsSync(at)) { moved.push(`${f}: LEFT`); continue; }
        if (!readFileSync(at).equals(readFileSync(path.join(REPO, f)))) moved.push(`${f}: bytes moved`);
      }
    }
    expect(moved, `${moved.length} tracked file(s) the seed rewrote or removed`).toEqual([]);
  });

  test("no file arrived: the scratch bags hold the tracked paths and nothing else", () => {
    for (const bag of HOUSE_BAGS) {
      const here = walk(path.join(scratch, "bags", bag)).map((f) => `bags/${bag}/${f}`);
      expect(here).toEqual([...tracked.get(bag)!].sort());
    }
  });

  test("no standoff and no ward refusal surfaced", () => {
    expect(conflicts).toEqual([]);
    expect(refusals).toEqual([]);
  });

  test("a second scan reads every carrier unchanged, and a second projection pass writes nothing", async () => {
    const reopened = new SyncedTree(path.join(scratch, "state", "synced-tree.json"), 0);
    for (const bag of HOUSE_BAGS) {
      const scan = scanSource(scratch, path.join(scratch, "bags", bag), bagUri(bag), reopened)!;
      const unsettled = scan.rows.filter((r) => r.status !== "unchanged").map((r) => `${r.uri}: ${r.status}`);
      expect(unsettled, `bags/${bag}: the second seed submits nothing`).toEqual([]);
      expect(scan.rows.length).toBeGreaterThan(150);
    }
    const before = new Map<string, number>();
    for (const bag of HOUSE_BAGS) for (const f of tracked.get(bag)!) before.set(f, statSync(path.join(scratch, f)).mtimeMs);
    const stop = projector.start(engine);
    await projector.idle();
    await stop();
    const touched = [...before].filter(([f, at]) => statSync(path.join(scratch, f)).mtimeMs !== at).map(([f]) => f);
    expect(touched).toEqual([]);
  }, 600_000);

  test("every carrier whose render differs from its bytes falls in a named framing class", () => {
    const unnamed: string[] = [];
    const byClass = new Map<string, number>();
    let differing = 0;
    for (const bag of HOUSE_BAGS) {
      for (const f of tracked.get(bag)!) {
        if (f.endsWith(".meta")) continue;
        const rel = f.slice(`bags/${bag}/`.length);
        // A bag's own declaration stays on disk and never becomes a record (`listCarriers`).
        if (rel === BAG_MANIFEST_FILE) continue;
        const uri = `lar:///${rel.replace(/\.[^/.]+$/, "")}`;
        const file = exportCarrierFile(engine, uri);
        if (file === null) { unnamed.push(`${f}: the wiki holds no record under ${uri}`); continue; }
        if (!f.endsWith(file.ext)) { unnamed.push(`${f}: arrived as ${path.extname(f)} and would leave as ${file.ext}`); continue; }
        if (file.encoding === "base64" || file.pointerCid !== undefined) continue;
        const metaAt = path.join(REPO, `${f}.meta`);
        const disk = { body: readFileSync(path.join(REPO, f), "utf8"), ...(existsSync(metaAt) ? { meta: readFileSync(metaAt, "utf8") } : {}) };
        const render = { body: file.body, ...(file.metaBody !== undefined ? { meta: file.metaBody } : {}) };
        const classes = framingClassesOf(disk, render);
        if (classes === null) { unnamed.push(`${f}: the render moves bytes no framing class names`); continue; }
        if (classes.length === 0) continue;
        differing++;
        for (const c of classes) byClass.set(c, (byClass.get(c) ?? 0) + 1);
      }
    }
    expect(unnamed).toEqual([]);
    // The reading a person takes from a run: how many carriers stand in another framing, by class.
    console.info(`[seed-fixed-point] ${differing} carrier(s) stand in a framing their render would normalize: ${JSON.stringify(Object.fromEntries(byClass))}`);
  });

  test("CONTROL: the classifier refuses a moved body, a lost sidecar field and a changed meta value", () => {
    const body = "<<^ code=\"&#x0002;\">>\n\n```toml meta\na = 1\n```\n\nprose\n\n<<^ code=\"&#x0003;\">>ni:///sha-256;AAAA\n";
    expect(framingClassesOf({ body }, { body })).toEqual([]);
    expect(framingClassesOf({ body }, { body: body.replace("prose", "other prose") })).toBeNull();
    expect(framingClassesOf({ body, meta: "title: x\ntype: text/markdown\nsource: y\n" }, { body, meta: "title: x\ntype: text/plain" })).toBeNull();
    expect(framingClassesOf({ body, meta: "title: x\ntype: text/markdown\n" }, { body, meta: "type: text/markdown\ntitle: x" })).toEqual(["sidecar-layout"]);
    expect(framingClassesOf({ body }, { body: body.replace("prose\n\n", "prose\n\n\n").replace("AAAA", "BBBB") })).toEqual(["blank-margin", "check-restamp"]);
    expect(framingClassesOf({ body }, { body: body.replace("a = 1", "a = 2").replace("AAAA", "BBBB") })).toBeNull();
    const table = body.replace("a = 1", "a = 1\n\n[ref]\nkey = \"v\"");
    expect(framingClassesOf({ body: table }, { body: body.replace("a = 1", "a       = 1\nref-key = \"v\"").replace("AAAA", "BBBB") })).toEqual(["meta-layout", "check-restamp"]);
  });

  test("CONTROL: a real change to one record writes that carrier and no other", async () => {
    const victim = "lar:///ha.ka.ba/wsl2/setup";
    const at = path.join(scratch, "bags/lares/ha.ka.ba/wsl2/setup.mem");
    const neighbour = path.join(scratch, "bags/lares/ha.ka.ba/lares/ref/RFC-2119.mem");
    const neighbourBefore = readFileSync(neighbour);
    const before = readFileSync(at, "utf8");
    const $tw = engine.$tw as unknown as {
      Tiddler: new (...f: Array<unknown>) => unknown;
      wiki: { addTiddler(t: unknown): void; getTiddler(t: string): { fields: Record<string, unknown> } | undefined; addEventListener(type: string, fn: (changes: Record<string, unknown>) => void): void };
    };
    const stop = projector.start(engine);
    await projector.idle();
    const standing = $tw.wiki.getTiddler(victim)!;
    // The wiki dispatches a change on a later turn; the vector waits on that dispatch, then on the gate.
    const dispatched = new Promise<void>((resolve) => { $tw.wiki.addEventListener("change", (changes) => { if (victim in changes) resolve(); }); });
    $tw.wiki.addTiddler(new $tw.Tiddler(standing, { role: "a role a hand changed in the wiki" }));
    await dispatched;
    await projector.idle();
    await stop();
    const after = readFileSync(at, "utf8");
    expect(after).not.toBe(before);
    expect(after).toContain("a role a hand changed in the wiki");
    expect(readFileSync(neighbour).equals(neighbourBefore)).toBe(true);
  }, 600_000);
});
