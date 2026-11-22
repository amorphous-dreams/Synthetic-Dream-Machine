/**
 * LEAD RUNS: this suite stands a staged daemon with three faces.
 * e2e/share-grant-reaches-face — A LANDED GRANT REACHES ITS FACE (the referee walk's friction 4, road
 * lar:///ha.ka.ba/kahua/memory/road/referee-walk-frictions).
 *
 * Walked live (2026-11-21): the steward (h0) shared a house canon wiki (`elyncia-referee`, its canon sourced from the checkout's
 * `bags/`) with write to the referee (h2); the share answered landed, and h2, worn, still read `wiki-unreached` for the wiki on
 * every door, across a remount. A house canon wiki's row delegated no canon (right: every face reads house canon from the
 * floor) and so handed the grantee nothing, not even the wiki's recipe row, and no catalog the grantee's mount read named the
 * wiki. The walk here stands the same house on a scratch root:
 *
 *   CONTROL  before the share, h2 worn reaches no such wiki (`wiki-unreached`)
 *   RED      h0 shares the house canon wiki with write to h2; h2 worn reaches it, reads its canon, and its write lands in the
 *            wiki's working layer
 *   RED      `lares wear 2` onto the face already worn replays the landing and changes nothing more; h2 still reaches the wiki
 *
 * The canon source is the root's own `bags/` (a copy of the checkout's `elyncia-referee` alone), so the vessel seats the wiki as
 * house canon as the live house did. Every answer the walk reads prints as a `[walk]` line. SKIPS LOUDLY when the built CLI or
 * vessel stands absent. Staged only.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { cpSync, existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { openStaged, awaitRendezvous, foundStagedHearth, stageDir, type CliResult, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_DIST = join(REPO_ROOT, "packages/lararium-node/dist/src/index.js");
const TEST_DOOR = join(REPO_ROOT, "tools/unlock-test-custody.mjs");
const SLUG = "elyncia-referee";

const gaps = [CLI_BIN, NODE_DIST].filter((p) => !existsSync(p)).map((p) => `built ${p} (pnpm build)`);
if (process.env["LAR_TARGET"] === "live") gaps.push("a STAGED target — this walk writes, and never writes to a live hearth");
if (gaps.length > 0) console.error(`share-grant-reaches-face: SKIPPED — missing ${gaps.join("; ")}`);

const said = (r: CliResult): string => `${r.stdout}\n${r.stderr}`.trim();
const say = (what: string, r: CliResult): void => console.log(`[walk] ${what} (rc ${r.code}): ${said(r).split("\n").slice(0, 8).join(" | ")}`);

let lar: LarInstance;
let priorHome: string | undefined;
let door: { unlockTestCustody: (root: string, act?: string, face?: number) => Promise<Record<string, unknown> | null> };
const wear = async (face: number): Promise<void> => {
  const a = await door.unlockTestCustody(lar.root, "unlock", face);
  console.log(`[walk] the test door wears h${face}: ${JSON.stringify({ wears: a?.["wears"], reading: a?.["reading"], held: a?.["held"] })}`);
  expect(a?.["wears"]).toBe(face);
};

describe.skipIf(gaps.length > 0)("★ a landed grant reaches its face: a house canon wiki shared with write reaches its grantee ★", () => {
  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-grant-reaches-"));
    priorHome = process.env["HOME"];
    process.env["HOME"] = join(root, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    // THE CANON SOURCE: the root's own bags/, holding the referee's wiki alone, so the vessel seats it as house canon.
    cpSync(join(REPO_ROOT, "bags", SLUG), join(root, "bags", SLUG), { recursive: true });
    lar = await openStaged({ root, tag: "grant-reaches", found: async (cli, staged) => {
      await foundStagedHearth(cli, staged, "steward");
      for (const [n, name] of [[1, "engineer"], [2, "referee"]] as const) {
        const p = await cli(["persona", "new", String(n), "--name", name, "--json"]);
        if (p.code !== 0) throw new Error(`persona ${n} failed (${p.code})\n${p.stdout.slice(-400)}\n${p.stderr.slice(-800)}`);
      }
    } });
    if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
    door = await import(TEST_DOOR) as typeof door;
  }, 300_000);

  afterAll(async () => {
    await lar?.stop();
    if (priorHome === undefined) delete process.env["HOME"]; else process.env["HOME"] = priorHome;
  });

  test("CONTROL: the steward stands the wiki; before any share the referee reaches no such wiki", async () => {
    await wear(0);
    const init = await lar.cli(["wiki", "init", SLUG, "--no-json"]);
    say("h0 wiki init", init);
    expect(init.code, said(init)).toBe(0);
    await wear(2);
    const status = await lar.cli(["wiki", "status", "--recipe", SLUG, "--no-json"]);
    say("h2 wiki status before the share", status);
    expect(status.code).not.toBe(0);
    expect(said(status)).toMatch(/wiki-unreached/);
  }, 240_000);

  test("RED: the steward shares the house canon wiki with write to the referee; the referee, worn, reaches it and its write lands in the wiki's working layer", async () => {
    await wear(0);
    const share = await lar.cli(["wiki", "share", SLUG, "--read", "h0 h2", "--write", "h2", "--no-json"]);
    say("h0 wiki share", share);
    expect(share.code, said(share)).toBe(0);
    expect(said(share), "the house canon wiki's hand-over counts as a landed grant that carries to the referee's next wear").toMatch(/landed: 1 grant\(s\); 1 of them reach the grantee's catalog/);
    await wear(2);
    const status = await lar.cli(["wiki", "status", "--recipe", SLUG, "--no-json"]);
    say("h2 wiki status after the share", status);
    expect(status.code, said(status)).toBe(0);
    expect(said(status)).toMatch(new RegExp(`read-only\\s+lar:///ha\\.ka\\.ba/bags/${SLUG}`));
    expect(said(status)).toMatch(new RegExp(`read \\+ write lar:///ha\\.ka\\.ba/wikis/${SLUG}/working\\s+<- a write lands here`));
    const put = await lar.cli(["tiddler", "put", "Referee smoke", "--recipe", SLUG, "--create", "--text=the referee writes here", "--no-json"]);
    say("h2 tiddler put", put);
    expect(put.code, said(put)).toBe(0);
    expect(said(put)).toMatch(new RegExp(`in lar:///ha\\.ka\\.ba/wikis/${SLUG}/working`));
  }, 240_000);

  test("RED: a wear onto the face already worn replays the landing and moves nothing more; the referee still reaches the wiki", async () => {
    await wear(2);
    const again = await lar.cli(["wear", "2", "--no-json"]);
    say("h2 lares wear 2 (worn already)", again);
    expect(again.code, said(again)).toBe(0);
    expect(said(again)).toMatch(/stands worn already/);
    expect(said(again), "a replay over a landed share names no move").not.toMatch(/shares: /);
    const get = await lar.cli(["tiddler", "get", "Referee smoke", "--recipe", SLUG, "--no-json"]);
    say("h2 tiddler get", get);
    expect(get.code, said(get)).toBe(0);
    expect(said(get)).toMatch(/the referee writes here/);
  }, 240_000);
});
