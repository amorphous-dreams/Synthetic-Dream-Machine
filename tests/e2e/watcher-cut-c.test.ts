/**
 * watcher-cut-c.test.ts — Cut C: the file-watcher's end-to-end witness
 * (NEXT VECTOR build 4, the deferred cut; handoff #watcher-talk-story).
 *
 * A one-shot `lares ingest` walks disk, so a vanished carrier never appears in its
 * scan; the long-lived `lares watch` daemon, tracking what it last saw, witnesses a
 * vanish. The watcher tombstones nothing by itself and holds no clock over a vanish:
 * it hands each vanished address to the vessel's shore, where the carrier stands as a
 * PENDING REMOVAL until a person answers through `lares shore`. This vector drives the
 * real watcher process, the real vessel and the real answer door, and moves the disk:
 *
 *   live   — the cookie self-test fires on ext4 (a dead backend fails closed)
 *   coalesce — rapid edits drain to ONE wave, not per-keystroke dribbles
 *   transient — a delete+recreate leaves nothing pending and tombstones nothing
 *   rename — a delete + same-bytes add re-links by content (identity preserved)
 *   mass   — three vanished files read as ONE count; a wrong count refuses; `restore` returns them
 *   remove — a vanished file stays gone and unwritten until `remove` deletes its carrier in the wiki
 *
 * Staged-only (mutating, spawns watcher daemons). Carriers template from the
 * small canonical `tick.mem` with the URI slug swapped — cheap to parse, lands
 * clean through the ingest gate.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { stagedTarget, targetInstance, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const TICK_TMPL = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares/api/pono/tick.mem");
const LARES_URI = "lar:///ha.ka.ba/bags/lares";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lar: LarInstance;
let SRC = "";
let tickTemplate = "";

/** Disk path a `cutc-<slug>` carrier projects to under the staged bags mirror. */
function carrierPath(slug: string): string {
  return join(lar.root, "bags/lares/ha.ka.ba/lares/api/pono", `${slug}.mem`);
}
function carrierUri(slug: string): string {
  return `lar:///ha.ka.ba/lares/api/pono/${slug}`;
}

/** Template a fresh carrier from tick.mem, swapping ONLY the URI slug (the path
 *  derives the record URI; the body prose carries over untouched). */
function carrierBody(slug: string): string {
  return tickTemplate.replaceAll("pono/tick", `pono/${slug}`);
}

/** A carrier's check stamp, and the carrier's words with that stamp set aside. */
const CHECK_STAMP = /ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}/;
const unstamped = (text: string): string => text.replace(new RegExp(CHECK_STAMP.source, "g"), "ni:///sha-256;");

function writeCarrier(slug: string): void {
  const p = carrierPath(slug);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, carrierBody(slug));
}

/** Run the one-shot CLI against the staged instance (env carries root + port). */
function cli(args: readonly string[]): ReturnType<LarInstance["cli"]> {
  return lar.cli(args);
}

interface WatchProc {
  readonly log: () => string;
  readonly waitFor: (re: RegExp, timeoutMs?: number) => Promise<RegExpMatchArray>;
  readonly stop: () => Promise<void>;
}

/** Spawn `lares watch --apply` against the staged vessel; stream its log. */
function spawnWatch(): WatchProc {
  let log = "";
  const child = spawn(
    process.execPath,
    [
      CLI_BIN, "watch",
      "--source", SRC, "--to", LARES_URI, "--apply",
      "--debounce", "150",
    ],
    { cwd: REPO_ROOT, env: { ...process.env, LAR_ROOT: lar.root, LAR_PORT: String(lar.port) } },
  );
  child.stdout?.on("data", (d) => { log += String(d); });
  child.stderr?.on("data", (d) => { log += String(d); });

  const waitFor = async (re: RegExp, timeoutMs = 20_000): Promise<RegExpMatchArray> => {
    const start = Date.now();
    for (;;) {
      const m = log.match(re);
      if (m) return m;
      if (Date.now() - start > timeoutMs) {
        throw new Error(`watch waitFor ${re} timed out (${timeoutMs}ms):\n${log.slice(-1800)}`);
      }
      await sleep(120);
    }
  };
  const stop = async (): Promise<void> => {
    child.kill("SIGINT");
    await new Promise<void>((resolve) => {
      child.once("close", () => resolve());
      setTimeout(resolve, 2_500);
    });
  };
  return { log: () => log, waitFor, stop };
}

const SLUGS = ["cutc-edit", "cutc-trans", "cutc-ren", "cutc-del", "cutc-brake-1", "cutc-brake-2", "cutc-brake-3"];

beforeAll(async () => {
  lar = await targetInstance();
  if (!stagedTarget) return;
  SRC = join(lar.root, "bags/lares");
  tickTemplate = readFileSync(TICK_TMPL, "utf8");

  // Write all test carriers, then land them in ONE ingest wave.
  for (const slug of SLUGS) writeCarrier(slug);
  const r = await cli(["ingest", "--source", SRC, "--to", LARES_URI, "--apply", "--yes", "--json"]);
  const d = r.json?.["data"] as Record<string, unknown> | undefined;
  if (!d) throw new Error(`setup ingest produced no data: ${JSON.stringify(r.json)}\n${r.stderr.slice(-600)}`);
  const carriers = (d["carriers"] as Array<Record<string, unknown>>) ?? [];
  const landed = carriers.filter((c) => c["decision"] === "ingest").map((c) => c["uri"]);
  for (const slug of SLUGS) {
    expect(landed, `carrier ${slug} must ingest cleanly`).toContain(carrierUri(slug));
  }

  // THE SETTLE WORD: the apply answers once the projection its records cause has run, so each carrier's
  // base stands pinned (the file in the framing the hand laid, beside the records' render) — the
  // watcher's baseline for "unchanged". No nap: the vessel says the moment.
  expect(d["settle"], `the apply names its settle word: ${JSON.stringify(d["settle"])}`).toMatchObject({ settled: true, mirrored: true, settledCount: landed.length });
  const r2 = await cli(["ingest", "--source", SRC, "--to", LARES_URI, "--json"]);
  const d2 = r2.json?.["data"] as Record<string, unknown>;
  expect(d2["changed"], "the mirror must be settled before the watcher cases").toBe(0);
}, 180_000);

afterAll(async () => { await lar.stop(); });

describe.skipIf(!stagedTarget)("watcher Cut C — the disk peer witnessed end-to-end", () => {
  test("live + coalesce — backend self-test fires; rapid edits drain to ONE wave", async () => {
    const w = spawnWatch();
    try {
      await w.waitFor(/backend live/);          // cookie echoed on ext4 — fails closed if dead
      await w.waitFor(/watching/);

      // Five rapid edits inside the debounce window → one coalesced wave.
      //
      // THE CARRIER SPEAKS MEMETIC-WIKITEXT, where bold reads `''…''` and never `**…**`. Hunting the
      // markdown form matched nothing, so all five "edits" wrote byte-identical content: the watcher
      // correctly reported `0 changed`, and the timeout that followed read as a watcher fault. A probe
      // that fails to edit must fail as a PROBE, so the guard rides below.
      const base  = readFileSync(carrierPath("cutc-edit"), "utf8");
      const nth   = (k: number) => base.replace("''Status: DEFERRED''", `''Status: DEFERRED-edit-${k}''`);
      expect(nth(1), "the edit changed nothing — the carrier's prose moved").not.toBe(base);
      for (let k = 1; k <= 5; k++) writeFileSync(carrierPath("cutc-edit"), nth(k));
      await w.waitFor(/INGEST\s+lar:\/\/\/ha\.ka\.ba\/lares\/api\/pono\/cutc-edit/);
      await sleep(2_500);                        // let any re-projection settle

      // Exactly one ingest of cutc-edit: the 5 keystrokes coalesced, the
      // canonical re-projection re-scanned as unchanged (the gofmt-loop guard).
      const ingests = w.log().match(/INGEST\s+\S*cutc-edit\b/g) ?? [];
      expect(ingests.length).toBe(1);
      expect(readFileSync(carrierPath("cutc-edit"), "utf8")).toContain("DEFERRED-edit-5");
    } finally {
      await w.stop();
    }
  }, 60_000);

  /** What the vessel's shore holds pending, as `lares shore --json` answers it (the list looks at the disk first). */
  async function pendingUris(): Promise<string[]> {
    const r = await cli(["shore", "list", "--json"]);
    const data = r.json?.["data"] as Record<string, unknown> | undefined;
    if (!data) throw new Error(`lares shore answered no data: ${JSON.stringify(r.json)}\n${r.stderr.slice(-600)}`);
    return ((data["pending"] as Array<Record<string, unknown>>) ?? []).map((p) => String(p["uri"]));
  }

  test("transient vanish — delete+recreate leaves nothing pending and tombstones nothing", async () => {
    const w = spawnWatch();
    try {
      await w.waitFor(/watching/);
      const path = carrierPath("cutc-trans");
      const bytes = readFileSync(path, "utf8");

      rmSync(path);                              // a transient vanish (git-checkout flood shape)
      await w.waitFor(/vanished from disk/);     // the watcher saw it leave, and tombstoned nothing
      writeFileSync(path, bytes);                // returns, byte-identical
      await w.waitFor(/touched · 0 changed/);    // the watcher saw it return

      expect(existsSync(path), "the recreated carrier survives").toBe(true);
      expect(readFileSync(path, "utf8")).toBe(bytes);
      expect(await pendingUris()).not.toContain(carrierUri("cutc-trans"));
      expect(w.log()).not.toMatch(/TOMBSTONE\s+\S*cutc-trans/);
      // THE COUNT IS THE CLAIM, so the pattern names a NON-ZERO one: a wave carrying only changes
      // prints `0 rename(s) submitted`.
      expect(w.log()).not.toMatch(/[1-9]\d* rename\(s\) submitted/);
    } finally {
      await w.stop();
    }
  }, 90_000);

  test("rename — delete + same-bytes add re-links the record by content", async () => {
    const w = spawnWatch();
    try {
      await w.waitFor(/watching/);
      const from = carrierPath("cutc-ren");
      const to   = carrierPath("cutc-ren2");
      const bytes = readFileSync(from, "utf8");

      // Move: same canonical bytes land at a new name; the old name vanishes.
      writeFileSync(to, bytes);
      rmSync(from);

      await w.waitFor(/RENAME/);                 // unique-hash match → re-link, not tombstone+create
      expect(existsSync(to), "the renamed carrier holds its new name").toBe(true);
      expect(w.log()).not.toMatch(/TOMBSTONE\s+\S*cutc-ren\b/);
      expect(await pendingUris()).not.toContain(carrierUri("cutc-ren"));
    } finally {
      await w.stop();
    }
  }, 90_000);

  test("mass vanish — three files read as one count; nothing tombstones; a wrong count refuses; restore returns them", async () => {
    const w = spawnWatch();
    const slugs = ["cutc-brake-1", "cutc-brake-2", "cutc-brake-3"];
    try {
      await w.waitFor(/watching/);
      const bytes = new Map(slugs.map((slug) => [slug, readFileSync(carrierPath(slug), "utf8")] as const));
      for (const slug of slugs) rmSync(carrierPath(slug));

      await w.waitFor(/stand pending at the vessel's shore/, 30_000);
      const pending = await pendingUris();
      for (const slug of slugs) expect(pending).toContain(carrierUri(slug));
      for (const slug of slugs) expect(existsSync(carrierPath(slug)), `${slug} stays unwritten while it pends`).toBe(false);
      expect(w.log()).not.toMatch(/TOMBSTONE\s+\S*cutc-brake/);

      // An answer over many names the count that stands. One short refuses and changes nothing.
      const short = await cli(["shore", "restore", "--all", "--count", String(pending.length + 1), "--yes", "--json"]);
      expect(short.json?.["ok"]).toBe(false);
      expect((short.json?.["error"] as Record<string, unknown>)["code"]).toBe("pending-count-moved");
      for (const slug of slugs) expect(existsSync(carrierPath(slug))).toBe(false);

      const restored = await cli(["shore", "restore", "--all", "--count", String(pending.length), "--yes", "--json"]);
      expect(restored.json?.["ok"], JSON.stringify(restored.json)).toBe(true);
      // `restore` writes the RECORDS' RENDER back. A hand-laid carrier stands in its own framing while it
      // says what the records say (an unchanged carrier takes no write), so the render differs from the
      // bytes that vanished in the check stamp alone: every other byte returns.
      for (const slug of slugs) {
        const back = readFileSync(carrierPath(slug), "utf8");
        expect(unstamped(back)).toBe(unstamped(bytes.get(slug)!));
        expect(back, `${slug} came back with no check stamp`).toMatch(CHECK_STAMP);
      }
      expect(await pendingUris()).toEqual([]);
    } finally {
      await w.stop();
    }
  }, 120_000);

  test("remove — a vanished file stays gone and unwritten until a person removes its carrier in the wiki", async () => {
    const w = spawnWatch();
    try {
      await w.waitFor(/watching/);
      const path = carrierPath("cutc-del");
      rmSync(path);                              // a hand's delete

      await w.waitFor(/stand pending at the vessel's shore/, 30_000);
      expect(await pendingUris()).toEqual([carrierUri("cutc-del")]);
      expect(existsSync(path), "nothing writes the file back while it pends").toBe(false);
      expect(w.log()).not.toMatch(/TOMBSTONE\s+\S*cutc-del/);

      const removed = await cli(["shore", "remove", carrierUri("cutc-del"), "--yes", "--json"]);
      expect(removed.json?.["ok"], JSON.stringify(removed.json)).toBe(true);
      expect((removed.json?.["data"] as Record<string, unknown>)["done"]).toEqual([carrierUri("cutc-del")]);
      expect(existsSync(path), "a removed carrier stays gone from disk").toBe(false);
      expect(await pendingUris()).toEqual([]);
    } finally {
      await w.stop();
    }
  }, 120_000);
});
