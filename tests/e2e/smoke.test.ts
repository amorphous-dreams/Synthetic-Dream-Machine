/**
 * e2e/smoke — the first stable harness layer. Codifies the 2026-06-10 live
 * witnesses as repeatable assertions, driven through the REAL lares CLI
 * against a staged (or live) instance. Current canon only:
 *
 *   1. the vessel boots to live with the lares hearth wiki seated (quine default)
 *   2. the invariant plane carries the operator-minted lares-bag oracle
 *   3. LOAD feeds the hearth carrier-borne (boot meme → 17 records)
 *   4. wiki init + add-bag write the user registry (catalog composition lane)
 *
 * Staged-only tests guard on instance.mode — a LIVE target never gets reset,
 * re-seeded, or asserted against genesis state.
 *
 * THE BOOT LOG IS READ AS IT GROWS, NEVER AS ONE SNAPSHOT. The harness resolves `targetInstance()` on
 * `phase → live`; the `live — wiki:` line and the oracle's operator-mint lares-bag record land a beat after
 * that, and under whole-set load the beat outlasts a test's first read. So test 1 waits on its causal line
 * in the vessel's own log, and test 2 waits until the oracle doc's STORED history holds the record. Each
 * wait ends on its event; its ceiling bounds a hang and nothing else, and a miss names what never arrived.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { targetInstance, bootDocUrl, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { memeticWikitextDeserializer } from "../../packages/lararium-tw5/src/deserializer.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const BOOT_MEME = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
const BOOT_URI  = "lar:///ha.ka.ba/lares/api/noosphere-boot";
const LARES_URI = "lar:///ha.ka.ba/bags/lares";

let lar: LarInstance;

beforeAll(async () => { lar = await targetInstance(); });
afterAll(async () => { await lar.stop(); });

/** A hang guard for each wait below: the test's own budget less a margin for the assertion to report. */
const WAIT_CEILING_MS = 55_000;
const TEST_BUDGET_MS  = 60_000;
/** How often a wait re-reads a source that grows on its own (the log buffer, the stored doc). It paces reads; it never decides. */
const READ_PACE_MS = 100;

/**
 * Wait until the vessel's own log holds `line`. The log is the vessel's stdout as the harness captures it, so the
 * wait re-reads the growing buffer and ends the moment the line lands. Past the ceiling it fails NAMING the line.
 */
async function untilLogLine(instance: LarInstance, line: RegExp, ceilingMs = WAIT_CEILING_MS): Promise<string> {
  const deadline = Date.now() + ceilingMs;
  for (;;) {
    const hit = line.exec(instance.bootLog());
    if (hit) return hit[0];
    if (Date.now() > deadline) {
      throw new Error(`the vessel's log never printed ${String(line)} within ${ceilingMs}ms; its tail:\n${instance.bootLog().slice(-800)}`);
    }
    await new Promise((r) => setTimeout(r, READ_PACE_MS));
  }
}

type OracleRecord = { tiddler?: { text?: string }; meta?: { authority?: string } };

/**
 * Wait until the oracle doc's STORED history holds the record at `title`, read off the vessel's own storage through
 * a throwaway repo per read (one repo loads a doc's storage once). The wait ends on the record; the ceiling bounds a
 * hang, and a miss names the record and the doc it never reached.
 */
async function untilOracleHolds(instance: LarInstance, oracleUrl: string, title: string, ceilingMs = WAIT_CEILING_MS): Promise<OracleRecord> {
  const deadline = Date.now() + ceilingMs;
  for (;;) {
    const repo = new Repo({ storage: new NodeFSStorageAdapter(vesselStorageDir(instance)) });
    try {
      const isle = await repo.find(oracleUrl as never);
      const rec = (isle.doc() as { tiddlers?: Record<string, OracleRecord> })?.tiddlers?.[title];
      if (rec) return rec;
    } catch { /* the stored doc is not yet loadable — the next read sees what has landed since */ }
    finally { await repo.shutdown().catch(() => {}); }
    if (Date.now() > deadline) throw new Error(`the stored oracle doc ${oracleUrl} never held ${title} within ${ceilingMs}ms`);
    await new Promise((r) => setTimeout(r, READ_PACE_MS * 5));
  }
}

describe("smoke — the vessel stands", () => {
  test("staged vessel reaches live with the lares hearth wiki seated", async () => {
    if (lar.mode !== "staged") return;   // a live hearth already stands; its log is its own
    expect(lar.bootLog()).toContain("phase → live");
    expect(await untilLogLine(lar, /live — wiki: lares/)).toMatch(/live — wiki: lares/);
  }, TEST_BUDGET_MS);

  test("the invariant plane carries the operator-minted lares-bag oracle", async () => {
    if (lar.mode !== "staged") return;   // raw-storage read assumes an owned root
    // The lares-bag oracle pointer rides the oracle plane (operator ruling
    // 2026-06-16: the oracle, lararium and lares docs stand separate).
    await untilLogLine(lar, /oracle:\s+automerge:[A-Za-z0-9]+/);
    const oracleUrl = bootDocUrl(lar, "oracle");
    expect(oracleUrl).toBeTruthy();
    const rec = await untilOracleHolds(lar, oracleUrl!, LARES_URI);
    expect(rec.tiddler?.text).toMatch(/^automerge:/);
    expect(rec.meta?.authority).toBe("operator-mint");
  }, TEST_BUDGET_MS);

  test("CONTROL: a wait on a line the vessel never prints fails, naming the line", async () => {
    if (lar.mode !== "staged") return;
    await expect(untilLogLine(lar, /a line no vessel prints/, 300)).rejects.toThrow(/never printed \/a line no vessel prints\//);
  });
});

describe("smoke — residency canon through the real CLI", () => {
  test("LOAD feeds the hearth carrier-borne: boot meme → parent + every ahu child", async () => {
    if (lar.mode !== "staged") return;   // mutating gesture — staged only
    const r = await lar.cli(["act", "LOAD", "--source-uri", BOOT_MEME, "--to", LARES_URI, "--yes", "--json"]);
    expect(r.json?.["ok"]).toBe(true);
    const data = r.json?.["data"] as { count: number; titles: string[] };
    // DERIVE FROM THE DESERIALIZER, never from a formula over the source. `1 + ahuCount` encoded a
    // model — parent plus one record per ahu — that the D-lift changed under it: four positional parts
    // of a carrier became records of their own, so the boot meme now yields 22 where the formula says
    // 20. A count the membrane computes cannot drift from the membrane.
    const expected = memeticWikitextDeserializer(readFileSync(BOOT_MEME, "utf8"), { title: BOOT_URI }).length;
    expect(data.count).toBe(expected);
    expect(data.titles).toContain("lar:///ha.ka.ba/lares/api/noosphere-boot");
    expect(data.titles).toContain("lar:///ha.ka.ba/lares/api/noosphere-boot#/exchange-protocol");
  });

  test("LOAD refuses a carrier-less gesture loudly (islands never fetch)", async () => {
    if (lar.mode !== "staged") return;
    const r = await lar.cli(["act", "LOAD", "--source-uri", "https://example.org/nope", "--to", LARES_URI, "--yes", "--json"]);
    expect(r.json?.["ok"]).toBe(false);
    // The CLI's error rides a STRUCTURED envelope — `{ code, message, hint? }`. Stringifying the whole
    // object yields "[object Object]", which matches no assertion and names no cause.
    const err = r.json?.["error"] as { message?: string } | string | undefined;
    expect(typeof err === "string" ? err : (err?.message ?? "")).toMatch(/no carriers/);
  });

  test("wiki init + add-bag compose the user registry", async () => {
    if (lar.mode !== "staged") return;   // mints registry entries — staged only
    const g = await lar.cli(["wiki", "init", "garden", "--json"]);
    expect(g.json?.["ok"]).toBe(true);
    expect((g.json?.["data"] as { recipeUri?: string })?.recipeUri).toMatch(/recipes\/garden/);
    const v = await lar.cli(["wiki", "init", "grove", "--json"]);
    expect(v.json?.["ok"]).toBe(true);

    const a = await lar.cli(["wiki", "add-bag", "garden", "lar:///ha.ka.ba/bags/grove", "--json"]);
    expect(a.json?.["ok"]).toBe(true);
    const data = a.json?.["data"] as { status?: string; stack?: string[] };
    expect(data?.status).toBe("added");
    expect(data?.stack?.join(" ")).toMatch(/bags\/grove/);
  });

  test("bag stats answers with the operator's real identity (no placeholder DID)", async () => {
    if (lar.mode !== "staged") return;
    const r = await lar.cli(["bag", "stats"]);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).not.toMatch(/bad hex length/);
  });
});

describe("smoke — any target (live-safe reads)", () => {
  test("lares vessel read answers from the targeted instance", async () => {
    const r = await lar.cli(["vessel", "read", "--json"]);
    // A read of local instance health; ok on both modes, and the gesture
    // mutates nothing — the one assertion a LIVE hearth always tolerates.
    expect(r.code).toBe(0);
  });
});
