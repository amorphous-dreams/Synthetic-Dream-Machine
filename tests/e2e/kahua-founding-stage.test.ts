/**
 * e2e/kahua-founding-stage — a face never stands without its kahua stage pinned: the founding signs the stage's `plane`
 * act under the operator's founding hand, and the first boot adopts it, with no `lares kahua mint` in between.
 *
 * LEAD RUNS: found, boot, unlock, restart, and write both kahua layers of a staged vessel.
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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import { daemonWikiDir, kahuaStageDir, openStaged, stageDir, stagedTarget, type CliResult, type LarInstance } from "../harness/instance.js";
import { expectEntry } from "../harness/journal-expect.js";
import { kahuaStageDocUrl } from "../../packages/lararium-mesh/src/kahua-stage.js";
import { KAHUA_BAG } from "../../packages/lararium-mesh/src/wiki-recipe.js";
import { isDaemonCanonWithheld } from "../../packages/lararium-mesh/src/lar-uris.js";

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
  }, 600_000);
  afterAll(async () => {
    await hearth?.stop();
    if (priorHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = priorHome;
  });

  test("RED: the unlocked founding device reads an empty stage, names the stage it adopted at the face's derived address, and a mint finds the pin standing", async () => {
    const listed = await hearth!.cli(["kahua", "list"]);
    expect(listed.code, said(listed)).toBe(0);
    // The list names the face's relation beside its items: the folder name its private projections carry.
    expect(answer(listed)["items"]).toEqual([]);
    expect(Object.hasOwn(answer(listed), "relation")).toBe(true);
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

  test("a daemon-wiki write and a kahua lift each project under the face's kahua name, and the daemon bag projects no control or house title", async () => {
    // Trued from the seed form: `vessel seed` reads the canon source, which a scratch LAR_ROOT holds empty, and the
    // fleet bag projects under its own bag id (`bags/kahua`), never `bags/kahua-<F>`. A write to each layer drives
    // its projection; the face rides the folder name alone.
    const source = join(hearth!.root, "stage-row.mem");
    const uri = "lar:///ha.ka.ba/kahua/memory/kahua-founding-stage-row";
    writeFileSync(source, `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\nrow-key = "kahua-founding-stage-row"\n\`\`\`\n\n! A stage row\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`);
    const put = await hearth!.cli(["meme", "put", uri, "--recipe", "default", "--file", source, "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    // LIVENESS: both event waits fail on a stalled projector; the journal names the completed mirror roots.
    await expectEntry(hearth!, { kind: "bag-projected", match: (event) => {
      const data = event.data as Record<string, unknown>;
      return data["bagId"] === "lar:///ha.ka.ba/wikis/daemon/working" && data["path"] === daemonWikiDir(hearth!.root);
    } }, { budgetMs: 60_000 });
    const lift = await hearth!.cli(["kahua", "lift", "rites/founding-stage-row", "--text", "the stage stands", "--taint", "none", "--sources", JSON.stringify([{ title: uri, revision: "r1" }])]);
    expect(lift.code, said(lift)).toBe(0);
    await expectEntry(hearth!, { kind: "bag-projected", match: (event) => {
      const data = event.data as Record<string, unknown>;
      return data["bagId"] === KAHUA_BAG && data["path"] === kahuaStageDir(hearth!.root);
    } }, { budgetMs: 60_000 });
    expect(existsSync(join(daemonWikiDir(hearth!.root), "ha.ka.ba/kahua/memory/kahua-founding-stage-row.mem"))).toBe(true);
    expect(existsSync(kahuaStageDir(hearth!.root))).toBe(true);
    // CONTROL: the daemon bag never projects into the tracked-shape bags/ beside the root, and its canon mirror under
    // <projections>/bags/daemon carries authored records alone: no control or house title (`isDaemonCanonWithheld`).
    expect(existsSync(join(hearth!.root, "bags", "daemon"))).toBe(false);
    const canon = join(hearth!.root, "projections", "bags", "daemon");
    const files = existsSync(canon) ? (readdirSync(canon, { recursive: true }) as string[]).filter((p) => statSync(join(canon, p)).isFile()) : [];
    const titles = files.filter((p) => !p.endsWith(".meta")).map((p) => `lar:///${p.split(sep).join("/").replace(/\.[^/.]+$/, "")}`);
    expect(titles.filter((t) => isDaemonCanonWithheld(t)), "a withheld title stands under bags/daemon").toEqual([]);
  });
});
