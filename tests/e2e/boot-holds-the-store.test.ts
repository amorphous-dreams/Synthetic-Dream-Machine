/**
 * e2e/boot-holds-the-store — a booting vessel holds its store from before its Repo opens, so no lares command
 * opens a second Repo beside it at any instant of the boot.
 *
 * ONE STORE, ONE HOLDER, AT EVERY INSTANT. A command routes its verb through the vessel whenever a holder answers at
 * the store's rendezvous name, and opens the store itself (`via: direct`) only when none answers. The vessel claims
 * that name before it opens its Repo and holds it for its life, so a command during the boot waits on the vessel's
 * verb channel instead of opening the store beside it.
 *
 * Proven:
 *   · CONTROL: with no vessel standing, `lares host` runs `via: direct`;
 *   · RED: six `lares host` loops hammer the store, three from the spawn of the daemon and three from the instant
 *     its claim stands, until well after `live`. An act
 *     that began before the vessel claimed its store may hold it (the vessel waits that act out); not one act that
 *     began after the claim runs `via: direct`, every act after `live` runs `via: daemon`, and the rendezvous name
 *     still answers the live vessel when the loops end.
 */
import { afterAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cliFor, freePort, stageDir, stopChild, rendezvousSocket, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");
/** How long the loops keep hammering once the vessel stands live. */
const AFTER_LIVE_MS = 8_000;

let daemon: ChildProcess | null = null;
let root = "";
afterAll(async () => {
  if (daemon) await stopChild(daemon);
  if (root) rmSync(root, { recursive: true, force: true });
});

/** Where one `lares host` act ran: `daemon`, `direct`, or the refusal it met. */
function via(r: { json?: Record<string, unknown> | null; stderr: string }): string {
  const data = r.json?.["data"] as { via?: string } | undefined;
  if (data?.via) return data.via;
  return `error:${JSON.stringify(r.json?.["error"] ?? r.stderr.slice(-160)).slice(0, 160)}`;
}

describe("a booting vessel holds its store", () => {
  test("no lares command opens the store beside a booting vessel", async () => {
    root = mkdtempSync(join(stageDir(), "lares-staged-boot-holds-"));
    const port = await freePort();
    const env = { LAR_ROOT: root, LAR_PORT: String(port) };
    const cli = cliFor(env);
    expect((await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"])).code).toBe(0);
    expect((await cli(["persona", "new", "0", "--name", "staged"])).code).toBe(0);

    // CONTROL: no vessel stands, so the command holds the store itself for its act.
    const alone = await cli(["host", "--json"]);
    expect(via(alone)).toBe("direct");

    let bootLog = "";
    daemon = spawn(process.execPath, [NODE_MAIN, "--root", root, "--port", String(port)], { cwd: NODE_CWD, env: { ...process.env, ...env } });
    daemon.stdout?.on("data", (d) => { bootLog += String(d); });
    daemon.stderr?.on("data", (d) => { bootLog += String(d); });

    const CLAIMED = "this vessel holds its store at";
    let liveAt: number | null = null;
    const tally: Record<string, number> = {};
    const loop = async (): Promise<void> => {
      while (liveAt === null || performance.now() - liveAt < AFTER_LIVE_MS) {
        if (daemon?.exitCode !== null) return;
        const stage = liveAt !== null ? "live" : bootLog.includes(CLAIMED) ? "claimed" : "spawned";
        const r = await cli(["host", "--json"]);
        const k = `${stage}:${via(r)}`;
        tally[k] = (tally[k] ?? 0) + 1;
      }
    };
    const watcher = (async () => {
      const by = performance.now() + 150_000;
      while (!bootLog.includes("phase → live") && daemon?.exitCode === null && performance.now() < by) {
        await new Promise((r) => setTimeout(r, 50));
      }
      liveAt = performance.now();
    })();
    // Half the loops start at the spawn, before the claim can stand; half start the instant the claim stands, so an
    // act begins inside the boot's held window however long each held act waits on the vessel.
    const afterClaim = async (): Promise<void> => {
      while (!bootLog.includes(CLAIMED) && daemon?.exitCode === null && liveAt === null) await new Promise((r) => setTimeout(r, 20));
      await loop();
    };
    await Promise.all([loop(), loop(), loop(), afterClaim(), afterClaim(), afterClaim(), watcher]);
    process.stderr.write(`boot-holds-the-store tally ${JSON.stringify(tally)}\n`);

    expect(daemon.exitCode, bootLog.slice(-2000)).toBeNull();
    expect(bootLog).toContain("phase → live");
    expect(bootLog).toContain(CLAIMED);
    // Acts that began once the claim stood: some met the booting vessel, and none opened the store beside it.
    const claimed = Object.entries(tally).filter(([k]) => k.startsWith("claimed:"));
    expect(claimed.length).toBeGreaterThan(0);
    const direct = Object.entries(tally).filter(([k]) => k.endsWith(":direct") && !k.startsWith("spawned:"));
    expect(direct).toEqual([]);
    const live = Object.entries(tally).filter(([k]) => k.startsWith("live:"));
    expect(live.length).toBeGreaterThan(0);
    // An act that began after `live` met the vessel's verb channel, never a refusal.
    expect(live.filter(([k]) => k !== "live:daemon")).toEqual([]);
    // The rendezvous name still answers the live vessel.
    expect(existsSync(rendezvousSocket({ root } as unknown as LarInstance))).toBe(true);
    expect(via(await cli(["host", "--json"]))).toBe("daemon");
  }, 400_000);
});
