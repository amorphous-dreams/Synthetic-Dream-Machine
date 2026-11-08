/**
 * e2e/kahua-founding-stage — a face never stands without its kahua stage pinned: the founding signs the stage's `plane`
 * act under the operator's founding hand, and the first boot adopts it, with no `lares kahua mint` in between.
 *
 * LEAD RUNS: found, boot, unlock, seed, and restart a staged vessel.
 * SECURITY CLASS (signed founding acts). The walk, through the test door (scratch marker, test custody, `vessel found
 * --hearth --skip-build`, boot, unlock):
 *   RED      the unlocked hearth reads its stage: `lares kahua list` answers an empty stage (an unpinned face refuses
 *            `kahua-unpinned`), and the boot names the stage it adopted at the face's derived address.
 *            A mint on the founding device answers the pin already standing (`minted: false`); the boot adopts, never pins.
 *   CONTROL  a mint stands the face's derived url, and after a restart of the same hearth a mint answers that pin and the
 *            boot adopts the same pin and signs nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { basename, join } from "node:path";
import { daemonWikiDir, openStaged, stageDir, stagedTarget, type CliResult, type LarInstance } from "../harness/instance.js";
import { expectEntry } from "../harness/journal-expect.js";
import { kahuaStageDocUrl } from "../../packages/lararium-mesh/src/kahua-stage.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const built = existsSync(join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js")) && existsSync(join(REPO_ROOT, "packages/lararium-node/dist/src/main.js"));

let hearth: LarInstance | null = null;
let group = "";
let priorHome: string | undefined;
const said = (r: CliResult): string => `rc ${r.code}; stdout: ${r.stdout.slice(-600)}; stderr: ${r.stderr.slice(-600)}`;
const answer = (r: CliResult): Record<string, unknown> => JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}") as Record<string, unknown>;
const adoptedLine = (log: string): string | null => /\[kahua\] the face's stage stands adopted: (automerge:\S+)/.exec(log)?.[1] ?? null;

describe.skipIf(!stagedTarget || !built)("the founding pins the face's kahua stage and the first boot adopts it", () => {
  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-kahua-found-"));
    priorHome = process.env["HOME"];
    process.env["HOME"] = join(root, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    hearth = await openStaged({
      root,
      tag: "kahua-found",
      found: async (cli, root) => {
        const found = await cli(["vessel", "found", "--hearth", "--name", "kahua-found", "--root", root, "--skip-build", "--json"]);
        if (found.code !== 0) throw new Error(`founding failed (${found.code}):\n${said(found)}`);
        group = String(((found.json?.["data"] ?? {}) as { personaGroupId?: string }).personaGroupId ?? "");
        if (!group) throw new Error(`the founding named no PersonaGroup:\n${said(found)}`);
      },
    });
    // The runbook's rite continues after the unlock: seed the tracked corpus through the public verb.
    const seeded = await hearth.cli(["vessel", "seed", "--apply", "--yes", "--json"]);
    if (seeded.code !== 0) throw new Error(`vessel seed --apply --yes failed (${seeded.code}):\n${said(seeded)}`);
  }, 600_000);
  afterAll(async () => {
    await hearth?.stop();
    if (priorHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = priorHome;
  });

  test("RED: the unlocked founding device reads an empty stage, names the stage it adopted at the face's derived address, and a mint finds the pin standing", async () => {
    const listed = await hearth!.cli(["kahua", "list"]);
    expect(listed.code, said(listed)).toBe(0);
    expect(answer(listed)).toEqual({ items: [] });
    expect(adoptedLine(hearth!.bootLog()), hearth!.bootLog().slice(-3000)).toBe(kahuaStageDocUrl(group));
    const mint = await hearth!.cli(["kahua", "mint"]);
    expect(mint.code, said(mint)).toBe(0);
    expect(answer(mint)).toEqual({ url: kahuaStageDocUrl(group), minted: false });
  }, 120_000);

  test("CONTROL: a mint stands the derived stage, and after a restart a mint answers that pin and the boot pins nothing", async () => {
    const mint = await hearth!.cli(["kahua", "mint"]);
    expect(mint.code, said(mint)).toBe(0);
    expect(answer(mint)["url"]).toBe(kahuaStageDocUrl(group));
    await hearth!.stopDaemonOnly();
    hearth = await openStaged({ root: hearth!.root, port: hearth!.port, found: async () => {} });
    expect(hearth.bootLog()).not.toMatch(/\[kahua\] .*pins the face's stage/);
    expect(adoptedLine(hearth.bootLog()), hearth.bootLog().slice(-3000)).toBe(kahuaStageDocUrl(group));
    const again = await hearth.cli(["kahua", "mint"]);
    expect(answer(again)).toEqual({ url: kahuaStageDocUrl(group), minted: false });
  }, 600_000);

  test("the runbook seed projects the daemon wiki and face bag under their kahua names", async () => {
    const faceFolder = basename(daemonWikiDir(hearth!.root));
    // LIVENESS: both event waits fail on a stalled projector; the journal names the completed mirror roots.
    await expectEntry(hearth!, { kind: "bag-projected", match: (event) => {
      const data = event.data as Record<string, unknown>;
      return data["bagId"] === "lar:///ha.ka.ba/wikis/daemon/working" && data["path"] === daemonWikiDir(hearth!.root);
    } }, { budgetMs: 60_000 });
    await expectEntry(hearth!, { kind: "bag-projected", match: (event) => {
      const data = event.data as Record<string, unknown>;
      return data["bagId"] === `lar:///ha.ka.ba/bags/${faceFolder}` && data["path"] === join(hearth!.root, "bags", faceFolder);
    } }, { budgetMs: 60_000 });
    expect(existsSync(daemonWikiDir(hearth!.root)), `daemon wiki projection missing under ${daemonWikiDir(hearth!.root)}`).toBe(true);
    expect(existsSync(join(hearth!.root, "bags", faceFolder)), `kahua bag projection missing under bags/${faceFolder}`).toBe(true);
    // CONTROL: the daemon's private identity bag never becomes a filesystem projection.
    expect(existsSync(join(hearth!.root, "bags", "daemon"))).toBe(false);
  });
});
