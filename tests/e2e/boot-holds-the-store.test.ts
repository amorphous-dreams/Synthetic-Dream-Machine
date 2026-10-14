/**
 * e2e/boot-holds-the-store — a booting vessel holds its store from before its Repo opens, so no lares command
 * opens a second Repo beside it at any instant of the boot.
 *
 * ONE STORE, ONE HOLDER, AT EVERY INSTANT. A command routes its verb through the vessel whenever a holder answers at
 * the store's rendezvous name, and opens the store itself (`via: direct`) only when none answers. The vessel claims
 * that name before it opens its Repo and holds it for its life, so a command during the boot waits on the vessel's
 * verb channel instead of opening the store beside it.
 *
 * Proven, each act begun at the vessel's OWN word and none against the machine's pace:
 *   · CONTROL: with no vessel standing, `lares nexus kapae --list` runs `via: direct`;
 *   · AN ACT THAT BEGAN BEFORE THE BOOT HOLDS THE STORE, and the vessel waits it out: this vector holds the store
 *     as a direct act, the booting vessel says it waits on that act, and it says it holds its store only after the
 *     act let go. A command run while the act holds refuses by name and opens nothing;
 *   · THE ORDER, read off the boot's own lines: the vessel says it holds its store, then that its boot begins,
 *     then that its Repo opened, then `live`. A claim taken late puts those lines in another order and reads red;
 *   · RED: one act begins once the vessel said it holds its store, and one once it said its boot begins. Neither
 *     runs `via: direct`: each meets the vessel (its verb channel, or a refusal that names the vessel);
 *   · an act begun after `live` runs `via: daemon`, and the rendezvous name still answers the live vessel.
 *
 * NO LOAD STANDS HERE. The law gets pinned by a handshake with the booting vessel: each act begins at a line the
 * vessel itself wrote. No loop asks again, and nothing hammers the store to catch an instant by chance. The
 * vector says which of the boot's words stood when each act began, and claims no narrower instant than that: the
 * window between the claim and the verb channel's open belongs to `owned-store`'s own vectors, which hold it.
 *
 * THE PROBE RIDES THE STORE DOOR. `lares nexus kapae --list` reads the antigen board through the store's door
 * table and opens no sealed row, so it answers at the floor too. `lares host` and `lares walk` ride the custody
 * door, a second channel that proves nothing about who holds the store.
 */
import { afterAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cliFor, freePort, stageDir, stopChild, rendezvousSocket, unlockStaged, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { claimStore } from "../../packages/lararium-node/src/owned-store.js";
import { arrival } from "../../packages/lararium-mesh/tests/handshake.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");
/** The bound on each of the booting vessel's words. It only fails: it names the word that never came. */
const BOOT_WORD_MS = 150_000;

let daemon: ChildProcess | null = null;
let root = "";
afterAll(async () => {
  if (daemon) await stopChild(daemon);
  if (root) rmSync(root, { recursive: true, force: true });
});

/** The store-door read each act sends. */
const PROBE = ["nexus", "kapae", "--list", "--json"] as const;

/** Where one store-door read ran: `daemon`, `direct`, or the refusal it met. */
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
    expect((await cli(["vessel", "found", "--hearth", "--name", "staged", "--root", root, "--skip-build"])).code).toBe(0);

    // CONTROL: no vessel stands, so the command holds the store itself for its act.
    const alone = await cli(PROBE);
    expect(via(alone)).toBe("direct");

    // THE VESSEL'S OWN WORDS. Each word resolves an arrival the moment its line lands in the daemon's output; a
    // daemon that exits first fails every word still owed, naming it.
    const WAITS = "the store waits on a direct act before this vessel opens it";
    const CLAIMED = "this vessel holds its store at";
    const BOOTING = "phase → boot";
    const REPO_OPEN = "phase → repo-open";
    const LIVE = "phase → live";
    const words = [WAITS, CLAIMED, BOOTING, REPO_OPEN, LIVE] as const;
    const said = new Map(words.map((w) => [w, arrival<void>(`the booting vessel saying "${w}"`, BOOT_WORD_MS)]));
    let bootLog = "";
    const hear = (d: unknown): void => {
      bootLog += String(d);
      for (const w of words) if (bootLog.includes(w)) said.get(w)!.arrive();
    };
    /** Which of the boot's words stood, by this process's own reading, at the moment of the call. */
    const stood = (): string => (said.get(LIVE)!.came ? "live" : said.get(REPO_OPEN)!.came ? "repo-open" : said.get(BOOTING)!.came ? "boot" : said.get(CLAIMED)!.came ? "claimed" : "before the claim");

    // THE VECTOR HOLDS THE STORE FIRST, as a direct act that began before the boot.
    const act = await claimStore(vesselStorageDir({ root } as unknown as LarInstance));
    const exited = arrival<number | null>("the daemon's exit", 2 * BOOT_WORD_MS);
    daemon = spawn(process.execPath, [NODE_MAIN, "--root", root, "--port", String(port)], { cwd: NODE_CWD, env: { ...process.env, ...env } });
    daemon.stdout?.on("data", hear);
    daemon.stderr?.on("data", hear);
    daemon.on("exit", (code) => { exited.arrive(code); });
    /** Wait for one of the vessel's words; a daemon that exits before it says the word fails the wait by name. */
    const word = (w: (typeof words)[number]): Promise<void> => Promise.race([
      said.get(w)!.arrived,
      exited.arrived.then((code) => { throw new Error(`the daemon exited ${code} before it said "${w}":\n${bootLog.slice(-2000)}`); }),
    ]);
    let besideTheAct = "";
    try {
      // The booting vessel met the held store and says it waits: it opened nothing beside the act.
      await word(WAITS);
      expect(bootLog.includes(CLAIMED), "the vessel claimed a store a direct act still held").toBe(false);
      // A command run now meets the act's own answer at the store's name. It refuses by name and opens nothing.
      besideTheAct = via(await cli(PROBE));
      expect(besideTheAct, "a command opened the store beside a direct act").not.toBe("direct");
      expect(besideTheAct, "a command reached a vessel that held nothing yet").not.toBe("daemon");
      expect(besideTheAct, "the refusal names the store the act holds").toMatch(/^error:.*store/i);
    } finally {
      await act.release();
    }

    // ONE ACT AT EACH WORD. The first begins once the vessel said it holds its store; the second once it said its
    // boot begins. Each records which of the boot's words stood when it began.
    const begun: Record<string, string> = {};
    const atClaim = word(CLAIMED).then(() => { begun["atClaim"] = stood(); return cli(PROBE); });
    const atBoot = word(BOOTING).then(() => { begun["atBoot"] = stood(); return cli(PROBE); });
    await word(LIVE);
    unlockStaged(root);
    const heldActs = [via(await atClaim), via(await atBoot)];
    process.stderr.write(`boot-holds-the-store acts ${JSON.stringify({ besideTheAct, atClaim: heldActs[0], atBoot: heldActs[1], begun })}\n`);

    expect(daemon.exitCode, bootLog.slice(-2000)).toBeNull();
    // THE ORDER: the vessel waited on the act, then held its store, then began its boot, then opened its Repo.
    const at = words.map((w) => bootLog.indexOf(w));
    expect(at.every((i) => i >= 0), `the boot never said one of its words: ${JSON.stringify(at)}`).toBe(true);
    expect(at, "the wait, the claim, the boot, the Repo's open, live: in that order").toEqual([...at].sort((a, b) => a - b));
    // Neither act opened the store beside the vessel: each met its verb channel, or a refusal naming the vessel.
    expect(heldActs.filter((v) => v === "direct")).toEqual([]);
    for (const v of heldActs) expect(v === "daemon" || /^error:.*(vessel|store|boot)/i.test(v), `an act begun once the vessel held its store answered ${v}`).toBe(true);
    // The rendezvous name still answers the live vessel.
    expect(existsSync(rendezvousSocket({ root } as unknown as LarInstance))).toBe(true);
    expect(via(await cli(PROBE))).toBe("daemon");
  }, 400_000);
});
