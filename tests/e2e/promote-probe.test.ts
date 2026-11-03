/**
 * e2e/promote-probe — the live probe of PROMOTE on a staged hearth (a scratch `LAR_ROOT`, founded, unlocked through the test door).
 *
 *   P1  code lifts as inert data: a marked `startup` module and a `$:/tags/StartupAction` item lift to the kahua stage; the hearth restarts
 *       TWICE and NEITHER runs (no `probe/ran/*` file, no `probe/action-ran`). The lift never loads.
 *   P2  the rites wait: `lares promote list` shows both with origin, digest and code class; a seat session's commit refuses
 *       `promote-needs-hand`, its prepare lands on the board.
 *   P3  the hand commits: after `lares promote commit` for each and one restart the module ran once and the action ran.
 *   P4  the brake: `lares kapae raise` over the module's digest; a restart runs it NOT (the count holds); `lower` and a restart run it again.
 *   P5  the orphan: the stage withdraws the module's item; the boot names the orphan and the module KEEPS running; `promote orphan --keep`
 *       ends the asking.
 *   P6  the brake in place: with the module loaded, `lares kapae raise` makes the standing daemon island restart itself (the owner door's
 *       `island.state` counts one more restart, no process restart) and the shadowed rite does not run again; a `lower` restarts nothing.
 *   CONTROL  the stage's copy never runs: a re-lift with changed bytes changes nothing that boots (`update-waits`).
 *
 * The node's own reads decide each step. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { foundStagedHearth, openStaged, stagedTarget, vesselStorageDir, type CliResult, type LarInstance } from "../harness/instance.js";
import { sendCustodyFrame } from "../../packages/lares-cli/src/custody-door.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const built = existsSync(join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js")) && existsSync(join(REPO_ROOT, "packages/lararium-node/dist/src/main.js"));

// The module writes after the island's sync adaptor has attached (a write at startup precedes the working layer and never lands). It also
// copies the StartupAction's own marker, so a StartupAction that ran at boot shows through a persisted tiddler.
const MODULE = "exports.name=\"promote-probe\";exports.after=[\"startup\"];exports.synchronous=true;"
  + "exports.startup=function(){setTimeout(function(){$tw.wiki.addTiddler({title:\"probe/ran/\"+Date.now(),text:\"ran\"});"
  + "if($tw.wiki.getTiddler(\"probe/action-ran\")){$tw.wiki.addTiddler({title:\"probe/action-seen\",text:\"yes\"});}},4000);};";
const ACTION = "<$action-setfield $tiddler=\"probe/action-ran\" text=\"yes\"/>";
const SOURCES = JSON.stringify([{ title: "daemon/probe", revision: "r1" }]);

let hearth: LarInstance | null = null;
const said = (r: CliResult): string => `rc ${r.code}; stdout: ${r.stdout.slice(-700)}; stderr: ${r.stderr.slice(-700)}`;
const answer = (r: CliResult): Record<string, any> => JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}") as Record<string, any>;
// The staged hearth routes no plain title to a bag (its wiki bag holds nothing), so a tiddler the module writes never persists; the island
// adaptor names each write it could not land (`unrouted-save: "<title>"`) in the daemon's log. That line IS the observable: the module ran
// (one `probe/ran/<ms>` title per boot) and the StartupAction ran (its own marker `probe/action-ran`).
const ranFiles = (): string[] => [...new Set([...hearth!.bootLog().matchAll(/unrouted-save: "(probe\/ran\/\d+)"/g)].map((m) => m[1]!))];
// The action's OWN marker (`probe/action-ran`), never the copy the module makes: a lifted action that ran without a promotion must read here.
const actionRan = (): boolean => /unrouted-save: "probe\/action-ran"/.test(hearth!.bootLog());
async function settle<T>(read: () => T, done: (v: T) => boolean, ms = 30_000): Promise<T> {
  const deadline = performance.now() + ms;
  for (;;) { const v = read(); if (done(v) || performance.now() > deadline) return v; await new Promise((r) => setTimeout(r, 250)); }
}
async function restart(): Promise<void> {
  await hearth!.stopDaemonOnly();
  hearth = await openStaged({ root: hearth!.root, port: hearth!.port, found: async () => {} });
}
const list = async (): Promise<Record<string, any>> => { const r = await hearth!.cli(["promote", "list"]); expect(r.code, said(r)).toBe(0); return answer(r); };
const digestOf = (listing: Record<string, any>, title: string): string => {
  const hit = [...(listing["rows"] ?? []), ...(listing["waiting"] ?? [])].find((r: { title: string }) => r.title === title);
  if (!hit) throw new Error(`no ${title} in ${JSON.stringify(listing).slice(0, 800)}`);
  return hit.digest as string;
};

describe.skipIf(!stagedTarget || !built)("promote, live", () => {
  beforeAll(async () => {
    hearth = await openStaged({
      tag: "promote-probe",
      found: async (cli, root) => { await foundStagedHearth(cli, root, "hearth"); },
    });
  }, 600_000);
  afterAll(async () => { await hearth?.stop(); });

  test("P1 — code lifts as inert data: two restarts and neither the module nor the StartupAction runs", async () => {
    const mod = await hearth!.cli(["kahua", "lift", "rites/probe-module", "--text", MODULE, "--taint", "none", "--sources", SOURCES, "--fields", JSON.stringify({ "module-type": "startup", type: "application/javascript" })]);
    expect(mod.code, said(mod)).toBe(0);
    const act = await hearth!.cli(["kahua", "lift", "rites/probe-action", "--text", ACTION, "--taint", "none", "--sources", SOURCES, "--fields", JSON.stringify({ tags: "$:/tags/StartupAction" })]);
    expect(act.code, said(act)).toBe(0);
    for (const n of [1, 2]) {
      await restart();
      await new Promise((r) => setTimeout(r, 9000));
      expect(ranFiles(), `restart ${n}: the lifted module ran\n${hearth!.bootLog().slice(-1500)}`).toEqual([]);
      expect(actionRan(), `restart ${n}: the lifted StartupAction ran`).toBe(false);
    }
  }, 900_000);

  test("P2 — the rites wait with origin, digest and class; a seat's commit refuses and its prepare lands", async () => {
    const listing = await list();
    const titles = (listing["waiting"] as Array<{ title: string; classes: string[]; origin: unknown }>).map((r) => r.title).sort();
    expect(titles).toEqual(["rites/probe-action", "rites/probe-module"]);
    const mod = (listing["waiting"] as Array<{ title: string; classes: string[] }>).find((r) => r.title === "rites/probe-module")!;
    expect(mod.classes).toEqual(expect.arrayContaining(["module-type"]));
    const { openLocalSession } = await import(join(REPO_ROOT, "packages/lares-cli/dist/src/session-connector.js")) as {
      openLocalSession: (o: { faceRef: string; hand?: string; dataDir?: string | null }) => Promise<{ act(act: string, args: Record<string, unknown>): Promise<Record<string, unknown>>; call(verb: string, args: Record<string, unknown>, opts?: { timeoutMs?: number }): Promise<Record<string, unknown>>; close(): Promise<void> }>;
    };
    const seat = await openLocalSession({ faceRef: "h0", hand: "seat", dataDir: join(hearth!.root, "data/lares/vessel") });
    try {
      const digest = digestOf(listing, "rites/probe-module");
      const refused = await seat.act("promote-commit", { digest }).catch((e: Error) => ({ refused: e.message }));
      expect(JSON.stringify(refused)).toContain("promote-needs-hand");
      const prepared = await seat.act("promote-prepare", { digest, why: "the probe wants its startup module" });
      expect(prepared, JSON.stringify(prepared)).not.toHaveProperty("refused");
      // A verb summoned over a session (origin `channel`, the seat's or the CLI hand's) never commits: only the page's own control path does.
      for (const verb of ["promote-commit", "kapae-raise"]) {
        const refused = await seat.call(verb, { wiki: "daemon", digest }, { timeoutMs: 30_000 }).catch((e: Error) => ({ refused: e.message }));
        expect(JSON.stringify(refused), verb).toMatch(/promote-needs-hand|kapae-needs-hand|answers-on-the-socket/);
      }
    } finally { await seat.close(); }
    expect((await list())["rows"]).toEqual([]);
    expect(ranFiles()).toEqual([]);
  }, 300_000);

  test("P3 — the hand commits both; one restart and the module ran once and the action ran", async () => {
    const listing = await list();
    for (const title of ["rites/probe-module", "rites/probe-action"]) {
      const r = await hearth!.cli(["promote", "commit", digestOf(listing, title)]);
      expect(r.code, said(r)).toBe(0);
    }
    await restart();
    const ran = await settle(ranFiles, (f) => f.length >= 1, 60_000);
    expect(ran, hearth!.bootLog().slice(-2500)).toHaveLength(1);
    expect(actionRan()).toBe(true);
  }, 600_000);

  test("P4 — the brake: a raise keeps the module off at the next boot; a lower brings it back", async () => {
    const digest = digestOf(await list(), "rites/probe-module");
    const raised = await hearth!.cli(["kapae", "raise", digest]);
    expect(raised.code, said(raised)).toBe(0);
    await restart();
    await new Promise((r) => setTimeout(r, 9000));
    expect(ranFiles().length, "a shadowed rite ran").toBe(0);
    expect((await list())["shadowed"]).toEqual(expect.arrayContaining([digest]));
    const lowered = await hearth!.cli(["kapae", "lower", digest]);
    expect(lowered.code, said(lowered)).toBe(0);
    await restart();
    expect((await settle(ranFiles, (f) => f.length >= 1, 60_000)).length).toBe(1);
  }, 900_000);

  test("P6 — the brake in place: a raise restarts the standing daemon island at once and the shadowed rite stays off; a lower restarts nothing", async () => {
    const dataDir = vesselStorageDir(hearth!);
    const restarts = async (): Promise<number> => ((await sendCustodyFrame({ op: "act", act: "island.state", args: {} } as never, dataDir)) as Record<string, any> | null)?.["result"]?.restarts as number;
    const digest = digestOf(await list(), "rites/probe-module");
    const ranBefore = ranFiles().length;
    expect(ranBefore, "the module must stand loaded before the raise").toBeGreaterThanOrEqual(1);
    const before = await restarts();
    const raised = await hearth!.cli(["kapae", "raise", digest]);
    expect(raised.code, said(raised)).toBe(0);
    let seen = before;
    // The re-opened island replays its registrations (lit faces take a while), so the count lands well after the raise answered.
    const deadline = performance.now() + 300_000;
    while (performance.now() < deadline) { seen = await restarts(); if (seen > before) break; await new Promise((r) => setTimeout(r, 500)); }
    expect(seen, `a raise over a loaded rite restarts the daemon island in place; log: ${hearth!.bootLog().split("\n").filter((l) => /\[promote\]|\[daemon\]/.test(l)).slice(-20).join("\n")}`).toBe(before + 1);
    await new Promise((r) => setTimeout(r, 9000));
    expect(ranFiles().length, "the shadowed rite ran again after the in-place restart").toBe(ranBefore);
    const lowered = await hearth!.cli(["kapae", "lower", digest]);
    expect(lowered.code, said(lowered)).toBe(0);
    await new Promise((r) => setTimeout(r, 6000));
    expect(await restarts(), "a lower restarts nothing").toBe(before + 1);
  }, 600_000);

  test("CONTROL — a re-lift with changed bytes changes nothing that boots; the row reads `update-waits`", async () => {
    const digest = digestOf(await list(), "rites/probe-module");
    const head = answer(await hearth!.cli(["kahua", "get", "rites/probe-module"]))["item"]?.heads?.[0]?.cid as string;
    const relift = await hearth!.cli(["kahua", "lift", "rites/probe-module", "--text", `${MODULE}/*v2*/`, "--taint", "none", "--sources", SOURCES, "--parent", head, "--fields", JSON.stringify({ "module-type": "startup", type: "application/javascript" })]);
    expect(relift.code, said(relift)).toBe(0);
    const listing = await list();
    expect((listing["rows"] as Array<{ digest: string; state: string }>).find((r) => r.digest === digest)?.state).toBe("update-waits");
    await restart();
    expect((await settle(ranFiles, (f) => f.length >= 1, 60_000)).length).toBe(1);
  }, 600_000);

  test("P5 — the stage withdraws the item: the boot names the orphan, the module keeps running, and a keep ends the asking", async () => {
    const digest = digestOf(await list(), "rites/probe-module");
    const got = answer(await hearth!.cli(["kahua", "get", "rites/probe-module", "--history"]));
    for (const rev of got["history"] as Array<{ cid: string; withdrawn: boolean }>) if (!rev.withdrawn) await hearth!.cli(["kahua", "withdraw", rev.cid]);
    await restart();
    expect((await settle(ranFiles, (f) => f.length >= 1, 60_000)).length).toBe(1);
    expect(hearth!.bootLog()).toMatch(new RegExp(`\\[promote\\].*orphan.*${digest.slice(0, 12)}`));
    const kept = await hearth!.cli(["promote", "orphan", digest, "--keep"]);
    expect(kept.code, said(kept)).toBe(0);
    await restart();
    expect(hearth!.bootLog()).not.toMatch(new RegExp(`\\[promote\\].*orphan.*${digest.slice(0, 12)}`));
    expect((await settle(ranFiles, (f) => f.length >= 1, 60_000)).length, "a kept orphan stopped running").toBe(1);
  }, 900_000);
});
