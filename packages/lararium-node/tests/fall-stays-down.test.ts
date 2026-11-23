/**
 * A FALLEN ENGINE STAYS DOWN, AND ITS TRAP-NAMED DOCUMENT HOLDS ON EVERY PATH.
 *
 * Measured on a live house: a vessel whose engine fell decided "stays down", and then a later throw from the dead wasm
 * module (`Module terminated` at `Automerge.getHeads`, from the storage source's attach) reached no handler, Node exited,
 * and the supervisor's `restart: unless-stopped` raised it again, every few seconds. And the document the first fall named
 * in flight (a catalog bag's document) loaded again at every boot through the Repo's storage source, a path the probe's
 * hold never reached.
 *
 *   K1  a vessel that stays down absorbs every later throw from the dead engine (any caller, a throw or a rejection): no
 *       exit, health still 503, the hold keeps the process up, and the log names the absorbed throw once.
 *   K2  the first fall exits `ENGINE_FALL_EXIT` once: a throw from the dead engine met during the flush, or a second
 *       signature, never exits a second time and never exits 1 ahead of the decision.
 *   K3  before any fall, an ordinary uncaught throw still ends the process with 1, as Node's own default does; a dead
 *       engine's throw met there first names the fall and leaves the exit to the fall's answer.
 *   K4  a boot that rejects after the fall reads as absorbed; before a fall it runs the boot's own fault path.
 *   K5  the keeper arms on the process's own two events.
 *   N1  a trap the storage source logs names its document in flight.
 *   H1  a fall naming a catalog document: the Repo never receives one chunk of it, its plane stands held and read-only over
 *       its own id (no writable stand-in), its bytes rest untouched, and every other document loads and takes writes.
 *   H2  an inbound sync message naming a held document never reaches the Repo.
 *
 * Every fall comes injected; no wasm instance runs out of anything, and no live vessel stands.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Repo, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { emptyLarDoc, sealedUnopened, seatSealedRest, standsIn, waitHandle, type LarDoc } from "@lararium/mesh";
import { createEngineWatch, tapInboundDocs, tapRepoLogs } from "../src/engine-watch.js";
import { createReadinessState } from "../src/readiness-face.js";
import {
  armFallKeeper, heldBackReason, heldInFlight, holdBackStorage, keepFallDown, readEngineFalls, restEngineFall,
  ENGINE_FALL_EXIT,
} from "../src/engine-fall.js";
import type { ShoreFlushReading } from "../src/shore-verb.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });
const scratch = (): string => (dir = mkdtempSync(join(tmpdir(), "lar-fall-stays-down-")));

const trap = (): Error => new WebAssembly.RuntimeError("unreachable");
const terminated = (): Error => new Error("Module terminated");
const clock = (): Date => new Date("2026-11-23T10:00:00.000Z");
const FLUSHED: ShoreFlushReading = { whole: true, islands: [] };
const settle = (): Promise<void> => new Promise((r) => setImmediate(r));

/** The keeper's ports, each act recorded in order. */
function keeperPorts(storageDir: string, life: string, flush: () => Promise<ShoreFlushReading | null> = async () => FLUSHED) {
  const acts: string[] = [];
  const lines: string[] = [];
  return {
    acts, lines,
    ports: {
      storageDir, life: () => life,
      flush: async () => { acts.push("flush"); return flush(); },
      exit: (code: number) => { acts.push(`exit ${code}`); },
      hold: () => { acts.push("hold"); },
      log: (line: string) => { lines.push(line); },
    },
  };
}

/** A fall from an earlier life, resting uncleared, so the next fall stays down. */
function restEarlierFall(storageDir: string, inFlight: string | null): void {
  const watch = createEngineWatch(clock);
  if (inFlight === null) watch.note(trap(), "repo"); else watch.carrying(inFlight, () => watch.note(trap(), "repo"));
  restEngineFall(storageDir, watch.fallen()!, "a".repeat(32));
}

describe("a fallen engine stays down", () => {
  test("K1 — a vessel that stays down absorbs every later throw from the dead engine", async () => {
    const storageDir = scratch();
    restEarlierFall(storageDir, "yn91-catalog-doc");
    const watch = createEngineWatch(clock);
    const health = createReadinessState(watch);
    health.markReady();
    const p = keeperPorts(storageDir, "b".repeat(32));
    const keeper = keepFallDown(watch, p.ports);

    // The boot's load traps (the storage source's own logged error), and the fall decides: stays down.
    tapRepoLogs(watch, () => {})("automerge-repo:storage-source").error("Error loading document yn91-catalog-doc from storage", trap());
    await settle();
    expect(keeper.verdict()).toBe("stays-down");
    expect(p.acts).toEqual(["flush", "hold"]);

    // Then the dead module throws from every caller: getHeads, a storage-source rejection, a timer, a sync handler.
    keeper.uncaught(terminated());
    keeper.uncaught(new Error("Module terminated", { cause: trap() }));
    keeper.uncaught(trap());
    keeper.uncaught(new TypeError("Cannot read properties of undefined (reading 'getHeads')"));
    keeper.uncaught(terminated());
    await settle();

    expect(p.acts.filter((a) => a.startsWith("exit"))).toEqual([]);
    expect(health.status()).toBe("engine-terminated");
    const absorbed = p.lines.filter((l) => /absorbed/.test(l));
    expect(absorbed.filter((l) => /Module terminated/.test(l))).toHaveLength(1);
    expect(absorbed.join("\n")).toMatch(/stays down/);
  });

  test("K2 — the first fall exits ENGINE_FALL_EXIT once, never twice, never 1 ahead of the decision", async () => {
    const storageDir = scratch();
    const watch = createEngineWatch(clock);
    let releaseFlush: () => void = () => {};
    const p = keeperPorts(storageDir, "a".repeat(32), () => new Promise((r) => { releaseFlush = () => r(FLUSHED); }));
    const keeper = keepFallDown(watch, p.ports);

    watch.carrying("doc-in-flight", () => watch.note(trap(), "repo"));
    // While the flush runs, the dead engine throws from other callers, and a second signature reaches the watch.
    keeper.uncaught(terminated());
    watch.note(terminated(), "ledger");
    await Promise.resolve().then(() => keeper.uncaught(terminated()));
    expect(p.acts).toEqual(["flush"]);
    expect(keeper.verdict()).toBe("answering");

    releaseFlush();
    await settle();
    expect(p.acts).toEqual(["flush", `exit ${ENGINE_FALL_EXIT}`]);
    expect(keeper.verdict()).toBe("rise-once");
    // A throw after the exit was asked for exits nothing more.
    keeper.uncaught(terminated());
    expect(p.acts.filter((a) => a.startsWith("exit"))).toEqual([`exit ${ENGINE_FALL_EXIT}`]);
    expect(readEngineFalls(storageDir)).toHaveLength(1);
  });

  test("K3 — before any fall an ordinary uncaught throw exits 1; a dead engine's throw met first names the fall", async () => {
    const storageDir = scratch();
    const watch = createEngineWatch(clock);
    const p = keeperPorts(storageDir, "a".repeat(32));
    const keeper = keepFallDown(watch, p.ports);
    keeper.uncaught(new Error("an ordinary fault"));
    expect(p.acts).toEqual(["exit 1"]);
    expect(watch.fallen()).toBeNull();
    expect(p.lines.join("\n")).toMatch(/an ordinary fault/);

    const watch2 = createEngineWatch(clock);
    const q = keeperPorts(storageDir, "b".repeat(32));
    const keeper2 = keepFallDown(watch2, q.ports);
    keeper2.uncaught(terminated());
    await settle();
    expect(watch2.fallen()).toMatchObject({ cause: "module-terminated" });
    expect(q.acts).not.toContain("exit 1");
  });

  test("K4 — a boot that rejects after the fall reads as absorbed; before a fall it runs the boot's own fault path", async () => {
    const storageDir = scratch();
    restEarlierFall(storageDir, null);
    const watch = createEngineWatch(clock);
    const p = keeperPorts(storageDir, "b".repeat(32));
    const keeper = keepFallDown(watch, p.ports);
    expect(keeper.absorbs(new Error("a boot fault"))).toBe(false);
    watch.note(trap(), "repo");
    await settle();
    expect(keeper.absorbs(new Error("the composition refused: Module terminated"))).toBe(true);
    expect(p.acts.filter((a) => a.startsWith("exit"))).toEqual([]);
  });

  test("K5 — the keeper arms on the process's own uncaught throw and unhandled rejection", async () => {
    const storageDir = scratch();
    restEarlierFall(storageDir, null);
    const watch = createEngineWatch(clock);
    const p = keeperPorts(storageDir, "b".repeat(32));
    const keeper = keepFallDown(watch, p.ports);
    const proc = new EventEmitter();
    armFallKeeper(keeper, proc);
    proc.emit("uncaughtException", trap(), "uncaughtException");
    await settle();
    expect(keeper.verdict()).toBe("stays-down");
    proc.emit("unhandledRejection", terminated(), Promise.resolve());
    proc.emit("uncaughtException", terminated(), "uncaughtException");
    await settle();
    expect(p.acts.filter((a) => a.startsWith("exit"))).toEqual([]);
    expect(proc.listenerCount("uncaughtException")).toBe(1);
    expect(proc.listenerCount("unhandledRejection")).toBe(1);
  });

  test("N1 — a trap the storage source logs names its document in flight", () => {
    const watch = createEngineWatch(clock);
    tapRepoLogs(watch, () => {})("automerge-repo:storage-source").error("Error loading document yn91fKiK5nP6Fx7bc1v2FfBvyHx from storage", trap());
    expect(watch.fallen()).toMatchObject({ cause: "wasm-unreachable", path: "repo", inFlight: "yn91fKiK5nP6Fx7bc1v2FfBvyHx" });
  });
});

/** A store with two documents, flushed and closed: the catalog document the fall names, and a sound sibling. */
async function storeWithTwoDocs(storageDir: string): Promise<{ catalogUrl: string; siblingUrl: string }> {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const catalog = repo.create<LarDoc>(emptyLarDoc());
  catalog.change((doc) => { (doc.tiddlers as Record<string, unknown>)["lar:///ha.ka.ba/lares/canon"] = { title: "lar:///ha.ka.ba/lares/canon", text: "the canon" }; });
  const sibling = repo.create<LarDoc>(emptyLarDoc());
  sibling.change((doc) => { (doc.tiddlers as Record<string, unknown>)["lar:///ha.ka.ba/probe/sibling"] = { title: "lar:///ha.ka.ba/probe/sibling", text: "a sibling" }; });
  await repo.flush();
  await repo.shutdown();
  return { catalogUrl: catalog.url, siblingUrl: sibling.url };
}

/** Every file under a store, with its size and bytes, so a moved or rewritten byte reads. */
function storeFiles(storageDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const p = join(at, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(p.slice(storageDir.length), readFileSync(p).toString("base64"));
    }
  };
  walk(storageDir);
  return out;
}

/** What the Repo receives from its storage: every chunk handed up, by document. */
function recording(inner: StorageAdapterInterface): { adapter: StorageAdapterInterface; handed: Set<string> } {
  const handed = new Set<string>();
  const note = (key: StorageKey, data: Uint8Array | undefined): void => { if (data !== undefined && key[0]) handed.add(key[0]); };
  return {
    handed,
    adapter: {
      load: async (key) => { const data = await inner.load(key); note(key, data); return data; },
      loadRange: async (prefix) => { const chunks: Chunk[] = await inner.loadRange(prefix); for (const c of chunks) note(c.key, c.data); return chunks; },
      save: (key, data) => inner.save(key, data),
      remove: (key) => inner.remove(key),
      removeRange: (prefix) => inner.removeRange(prefix),
    },
  };
}

describe("the trap-named document holds on every load path", () => {
  test("H1 — a fall naming a catalog document: no chunk reaches the Repo, the plane stands held, the rest stands", async () => {
    const storageDir = scratch();
    const { catalogUrl, siblingUrl } = await storeWithTwoDocs(storageDir);
    const catalogId = catalogUrl.replace(/^automerge:/, "");
    const siblingId = siblingUrl.replace(/^automerge:/, "");
    restEarlierFall(storageDir, catalogId);
    const before = storeFiles(storageDir);

    // The boot: the held set the resting falls name, the storage wrap, and the Repo's own door over it.
    const held = heldInFlight(readEngineFalls(storageDir));
    expect(held).toEqual([catalogId]);
    const lines: string[] = [];
    const rec = recording(holdBackStorage(new NodeFSStorageAdapter(storageDir), held, (line) => lines.push(line)));
    const repo = new Repo({ storage: rec.adapter });
    seatSealedRest(repo, { restsSealed: () => false, heldBack: heldBackReason(held) });

    let fallbacks = 0;
    const blank = () => { fallbacks++; return repo.create<LarDoc>(emptyLarDoc()); };
    const plane = await waitHandle<LarDoc>(repo, catalogUrl, blank, 50);
    const sound = await waitHandle<LarDoc>(repo, siblingUrl, blank, 2000);

    expect(rec.handed.has(catalogId)).toBe(false);
    expect(plane.documentId).toBe(catalogId);
    expect(fallbacks).toBe(0);
    expect(standsIn(plane)).toBe(true);
    expect(sealedUnopened(plane)).toMatch(/held/);
    expect(lines.join("\n")).toContain(catalogId);

    expect(rec.handed.has(siblingId)).toBe(true);
    expect(sealedUnopened(sound)).toBeUndefined();
    expect(Object.keys(sound.doc()?.tiddlers ?? {})).toContain("lar:///ha.ka.ba/probe/sibling");
    sound.change((doc) => { (doc.tiddlers as Record<string, unknown>)["lar:///ha.ka.ba/probe/after"] = { title: "lar:///ha.ka.ba/probe/after", text: "a write" }; });
    await repo.flush();
    await repo.shutdown();

    const after = storeFiles(storageDir);
    for (const [path, bytes] of before) if (path.includes(catalogId.slice(2))) expect(after.get(path)).toBe(bytes);
    expect([...after.keys()].filter((p) => p.includes(catalogId.slice(2)))).toEqual([...before.keys()].filter((p) => p.includes(catalogId.slice(2))));
  }, 30_000);

  test("H2 — an inbound sync message naming a held document never reaches the Repo", () => {
    const watch = createEngineWatch(clock);
    const subsystem = new EventEmitter();
    const reached: string[] = [];
    subsystem.on("message", (msg: { documentId: string }) => { reached.push(msg.documentId); });
    tapInboundDocs(subsystem, watch, ["held-doc"]);
    subsystem.emit("message", { type: "sync", documentId: "held-doc" });
    subsystem.emit("message", { type: "sync", documentId: "light-doc" });
    expect(reached).toEqual(["light-doc"]);
  });
});
