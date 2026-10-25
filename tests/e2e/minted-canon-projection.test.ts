/**
 * minted-canon-projection.test.ts — thread 1: a minted USER wiki's own
 * `@{slug}` canon projects to `bags/{slug}`.
 *
 * The disk grant carried literal mirrors for the lares and lararium bags and a per-wiki
 * working leaf, but nothing projected a freshly-minted wiki's own canon. The
 * self-canon grant (authority) + the recipe designating wikiBagUri(slug)
 * (designation) now close it: resolveDiskMirrors expands @{slug} → bags/{slug}
 * for a minted wiki, while the system wikis keep their literal roots.
 *
 *   mint a user wiki → set it active → REBOOT (the active marker only loads on
 *   boot) → LOAD a carrier into its working slot → MOVE it to canon → it lands under bags/{slug}.
 *
 * Staged-only (lifecycle-mutating). Rides the reboot harness pattern
 * (vessel-reboot) + the live CLI (LOAD into the minted working slot).
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, unlockStaged, stopChild, type LarInstance } from "../harness/instance.js";
import { promoteLoadedTitles } from "../harness/promote.js";
import { expectEntry } from "../harness/journal-expect.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");
const BOOT_MEME = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem");
const SLUG      = "my-world";
const WORKING   = `lar:///ha.ka.ba/wikis/${SLUG}/working`;
const CANON_BAG = `lar:///ha.ka.ba/bags/${SLUG}`;

let lar: LarInstance;
let second: ChildProcess | null = null;
let secondLog = "";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** True where `port` accepts a bind. */
function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}

beforeAll(async () => { lar = await targetInstance(); }, 180_000);
afterAll(async () => {
  // The second daemon's own exit event ends the wait (`stopChild`), never a pause after the signal.
  if (second) await stopChild(second);
  if (lar.mode === "staged") rmSync(lar.root, { recursive: true, force: true });
  await lar.stop();
});

describe("minted-canon projection — a user wiki's @{slug} canon reaches bags/{slug}", () => {
  test("mint → activate → reboot → LOAD into @{slug} canon → projects to bags/{slug}", async () => {
    if (lar.mode !== "staged") return;     // lifecycle-mutating — staged only

    // 1) mint a fresh user wiki + 2) set it active for the next boot
    const minted = await lar.cli(["wiki", "init", SLUG, "--json"]);
    expect(minted.json?.["ok"], `mint failed: ${JSON.stringify(minted.json)}`).toBe(true);
    const opened = await lar.cli(["wiki", "open", SLUG, "--json"]);
    expect(opened.json?.["ok"] ?? true).not.toBe(false);

    // 3) REBOOT — the active-wiki marker only takes on boot (open does not remount)
    // `stopDaemonOnly` returns on the old daemon's own `exit` event (`stopChild`): every descriptor it held, the
    // port included, went with the process. The reboot reuses lar.port, so a port still held reads here by name.
    await lar.stopDaemonOnly();
    expect(await portFree(lar.port), `port ${lar.port} still held after the old daemon exited`).toBe(true);
    second = spawn(process.execPath, [NODE_MAIN, "--root", lar.root, "--port", String(lar.port)], {
      cwd: NODE_CWD,
      env: { ...process.env, LAR_ROOT: lar.root, LAR_PORT: String(lar.port) },
    });
    second.stdout?.on("data", (d) => { secondLog += String(d); });
    second.stderr?.on("data", (d) => { secondLog += String(d); });
    // TWO MARKERS, AND THE UNLOCK BETWEEN THEM. Every boot rests at the floor: the reboot reaches `phase → live`
    // holding no vessel key, as a wiki-less floor that activates no wiki at all. The custody unlock composes the
    // hearth again, and only that composition reads the active-wiki marker. So the vector waits for the floor's
    // `phase → live`, opens the vessel through the test door, and then waits for `[lararium] live — wiki:`.
    // `main.ts` prints that line straight after the ACTIVE-WIKI-MARKER line (naming which wiki activated), so
    // its presence proves the activation decision already stands in the log: a causal marker, never a timing
    // guess, and never the hearth's own `phase → live`, which prints before the marker line.
    // Each wait rides the child's own output and exit events. One budget alarms; it decides nothing.
    const awaitLogLine = (line: string, what: string): Promise<void> => new Promise<void>((resolve, reject) => {
      const child = second!;
      if (secondLog.includes(line)) { resolve(); return; }
      const finish = (settle: () => void): void => {
        clearTimeout(alarm);
        child.stdout?.off("data", onData); child.stderr?.off("data", onData); child.off("exit", onExit);
        settle();
      };
      const onData = (): void => { if (secondLog.includes(line)) finish(resolve); };
      const onExit = (code: number | null): void => finish(() => reject(new Error(`reboot exited ${code} before ${what}:\n${secondLog.slice(-800)}`)));
      const alarm = setTimeout(() => finish(() => reject(new Error(`reboot never reached ${what}:\n${secondLog.slice(-800)}`))), 120_000);
      child.stdout?.on("data", onData); child.stderr?.on("data", onData); child.once("exit", onExit);
    });
    await awaitLogLine("phase → live", "the floor's live phase");
    unlockStaged(lar.root);
    await awaitLogLine("[lararium] live — wiki:", "the hearth's live line after the unlock");

    // sanity: the reboot actually activated the minted wiki (not the lares-wiki fallback) —
    // asserted only once the causal marker above proves the activation line has been written.
    expect(secondLog, "reboot did not activate the minted wiki").toContain(`→ ${SLUG}`);

    // 4) LOAD into the minted wiki's working slot, then promote its landed family.
    const r = await lar.cli(["act", "LOAD", "--source-uri", BOOT_MEME, "--to", WORKING, "--yes", "--json"]);
    expect(r.json?.["ok"], `LOAD --to ${WORKING} failed: ${JSON.stringify(r.json)}`).toBe(true);
    await promoteLoadedTitles(lar, r.json, SLUG);

    // 5) the self-canon mirror projects @{slug} canon to bags/{slug}. barrier: the projector journals
    // `bag-projected` once the first file of the bag stands (it writes the file, then appends the entry), so the
    // entry is the far-side event; the carrier reads present the moment it comes.
    await expectEntry(lar, { kind: "bag-projected", match: (e) => (e.data as Record<string, unknown>)["bagId"] === CANON_BAG }, { budgetMs: 90_000 });
    const projected = walk(join(lar.root, `bags/${SLUG}`)).some((f) => f.endsWith("noosphere-boot.mem"));
    expect(projected, `minted canon never projected to bags/${SLUG}`).toBe(true);
  }, 300_000);
});
