/**
 * The shore names what it lets go: a pending removal whose file a commit took from the checkout carries that commit
 * as a receipt (short sha, subject, PR, where git keeps the bytes, where the substance went), wherever the shore names
 * the removal to a person: `lares shore list`, the `shore remove` answer, the lay's closing lines. A receipt, never a
 * gate: with no checkout, no git, or past the bound, every line reads as it did.
 *
 * Each vector stands a scratch git repository (a carrier committed, then deleted) and reads the receipt by behaviour:
 * the ashes it names answer `git show` with the carrier's own bytes.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test as plain, vi } from "vitest";
import { fc, test } from "@fast-check/vitest";
import "./laws/fixed-seed.js";
import { otakiageLine, pendingReceipts, retirementFor, retirementLine, retirementsFor, withRetiredBy } from "../src/shore-retirement.js";
import { removeReceiptLines, shorePendingLines } from "../src/commands/shore.js";
import { pendingRemovalLines } from "../src/commands/lay.js";

const dirs: string[] = [];
afterEach(() => { vi.unstubAllEnvs(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const BAG = "lar:///ha.ka.ba/bags/lares";

/** A scratch checkout: `git` runs in it, `at` names a path under it. */
function checkout(): { dir: string; git: (...args: string[]) => string; at: (...parts: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "shore-retire-")); dirs.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main"); git("config", "user.name", "Witness"); git("config", "user.email", "witness@example.test");
  git("config", "commit.gpgsign", "false");
  return { dir, git, at: (...parts) => join(dir, ...parts) };
}

/** Commit `rel` holding `body`, then commit its deletion under `message`; answers the deleting short sha. */
function standThenRetire(c: ReturnType<typeof checkout>, rel: string, body: string, message: string): string {
  const parts = rel.split("/");
  mkdirSync(c.at(...parts.slice(0, -1)), { recursive: true });
  writeFileSync(c.at(...parts), body);
  c.git("add", "--", rel); c.git("commit", "-qm", `stand ${rel}`);
  c.git("rm", "-q", "--", rel); c.git("commit", "-qm", message);
  return c.git("rev-parse", "--short", "HEAD");
}

describe("a shore receipt reads the checkout's retirement", () => {
  plain("names the deleting commit, its PR, its destination, and where git keeps the carrier", async () => {
    const c = checkout();
    const sha = standThenRetire(c, "bags/voice.mem", "the carrier\n", "retire voice into api/voices (#419)");
    expect(await retirementFor(c.at("bags", "voice.mem"))).toEqual({ sha, subject: "retire voice into api/voices (#419)", pr: 419, ashes: `${sha}^:bags/voice.mem`, destination: "api/voices" });
  });

  plain("a PR merge names the PR where the deleting commit's own subject names none; a directory that left with its file still answers", async () => {
    const c = checkout();
    mkdirSync(c.at("bags", "docs", "voices"), { recursive: true });
    writeFileSync(c.at("bags", "docs", "voices", "masks.mem"), "masks\n");
    writeFileSync(c.at("bags", "keep.mem"), "stays\n");
    c.git("add", "."); c.git("commit", "-qm", "stand");
    c.git("checkout", "-qb", "feature");
    c.git("rm", "-q", "-r", "bags/docs"); c.git("commit", "-qm", "docs/voices leave, their substance merged into the api specs they duplicated: api/voices gains #/mask-layer");
    const sha = c.git("rev-parse", "--short", "HEAD");
    c.git("checkout", "-q", "main");
    c.git("merge", "-q", "--no-ff", "-m", "Merge pull request #7 from house/feature", "feature");
    expect(await retirementFor(c.at("bags", "docs", "voices", "masks.mem"))).toMatchObject({ sha, pr: 7, ashes: `${sha}^:bags/docs/voices/masks.mem`, destination: "api/voices" });
  });

  plain("many paths read in one pass: only a deleted carrier answers, a file never tracked and a standing one ride absent", () => {
    const c = checkout();
    const sha = standThenRetire(c, "bags/gone.mem", "gone\n", "the gone carrier leaves");
    writeFileSync(c.at("bags", "standing.mem"), "here\n"); c.git("add", "."); c.git("commit", "-qm", "stand another");
    const read = retirementsFor([c.at("bags", "gone.mem"), c.at("bags", "never.mem"), c.at("bags", "standing.mem")]);
    expect([...read.keys()]).toEqual([c.at("bags", "gone.mem")]);
    expect(read.get(c.at("bags", "gone.mem"))).toMatchObject({ sha, subject: "the gone carrier leaves" });
    expect(read.get(c.at("bags", "gone.mem"))?.pr).toBeUndefined();
    expect(read.get(c.at("bags", "gone.mem"))?.destination).toBeUndefined();
  });

  test.prop([fc.stringMatching(/^[a-z0-9][a-z0-9 ._-]{0,24}$/).filter((n) => n.trim() === n && !n.endsWith(".")), fc.string({ minLength: 1, maxLength: 40 })], { numRuns: 6 })(
    "LAW: the ashes a receipt names answer `git show` with the carrier's own bytes",
    async (name, body) => {
      const c = checkout();
      const rel = `bags/${name}.mem`;
      standThenRetire(c, rel, body, `retire ${name}`);
      const r = await retirementFor(c.at("bags", `${name}.mem`));
      expect(r).toBeDefined();
      expect(execFileSync("git", ["show", r!.ashes], { cwd: c.dir, encoding: "utf8" })).toBe(body);
    },
  );

  plain("CONTROL: a path with no checkout above it contributes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shore-no-git-")); dirs.push(dir);
    expect(await retirementFor(join(dir, "missing.mem"))).toBeUndefined();
  });

  plain("CONTROL: no git binary answers nothing and throws nothing", async () => {
    const c = checkout();
    standThenRetire(c, "bags/voice.mem", "v\n", "retire voice");
    vi.stubEnv("PATH", c.at("no-bin-here"));
    expect(await retirementFor(c.at("bags", "voice.mem"))).toBeUndefined();
  });

  plain("CONTROL: a spent bound answers nothing, at once", () => {
    const c = checkout();
    standThenRetire(c, "bags/voice.mem", "v\n", "retire voice");
    const started = Date.now();
    expect(retirementsFor([c.at("bags", "voice.mem")], { boundMs: 0 }).size).toBe(0);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("the shore names the receipt wherever it names a pending removal", () => {
  /** A scratch retirement and the pending row the island would name for it. */
  function retiredRow(message = "retire voice into api/voices (#419)") {
    const c = checkout();
    const sha = standThenRetire(c, "bags/voice.mem", "v\n", message);
    const row = { uri: "lar:///ha.ka.ba/lares/docs/voice", bagId: BAG, path: c.at("bags", "voice.mem") };
    return { sha, row, receipts: pendingReceipts([row]) };
  }

  plain("shore list names the sha, the subject, the PR and the ashes beneath the row", () => {
    const { sha, row, receipts } = retiredRow();
    const lines = shorePendingLines([row], receipts);
    expect(lines.join("\n")).toContain(`retired by ${sha} "retire voice into api/voices (#419)" (PR #419); ashes at ${sha}^:bags/voice.mem`);
    expect(lines.indexOf(`  ${row.uri}  bag ${BAG}  ${row.path}`)).toBeLessThan(lines.findIndex((l) => l.includes("retired by")));
  });

  plain("the remove answer names the receipt and an otakiage note per carrier it reached", () => {
    const { sha, row, receipts } = retiredRow();
    expect(removeReceiptLines([row.uri], [row], receipts)).toEqual([
      `  ${row.uri}`,
      `      ${retirementLine(receipts.get(row.path)!)}`,
      `      otakiage: its substance went to api/voices, as ${sha} names`,
    ]);
    const bare = retiredRow("retire voice");
    expect(removeReceiptLines([bare.row.uri], [bare.row], bare.receipts)[2]).toBe("      otakiage: the retiring commit names no destination");
    expect(otakiageLine(bare.receipts.get(bare.row.path)!)).toBe("otakiage: the retiring commit names no destination");
  });

  plain("the lay's closing lines name each retired carrier beneath its bag's count", () => {
    const { sha, row, receipts } = retiredRow();
    const lines = pendingRemovalLines([row], [BAG], receipts);
    expect(lines[0]).toBe(pendingRemovalLines([row], [BAG])[0]);
    expect(lines.slice(1).join("\n")).toContain(`${row.uri}: retired by ${sha}`);
    expect(lines.slice(1).join("\n")).toContain(`ashes at ${sha}^:bags/voice.mem`);
  });

  plain("JSON carries the same fields under `retiredBy`", () => {
    const { sha, row, receipts } = retiredRow();
    expect(withRetiredBy([row], receipts)).toEqual([{ ...row, retiredBy: { sha, subject: "retire voice into api/voices (#419)", pr: 419, ashes: `${sha}^:bags/voice.mem`, destination: "api/voices" } }]);
  });

  plain("CONTROL: with no receipt every line and row reads as it did", () => {
    const row = { uri: "lar:///ha.ka.ba/lares/docs/voice", bagId: BAG, path: "/nowhere/bags/voice.mem" };
    const none = pendingReceipts([row]);
    expect(none.size).toBe(0);
    expect(shorePendingLines([row], none)).toEqual([
      "1 pending removal(s): the file vanished where a base stands; nothing writes back and nothing tombstones",
      `  ${row.uri}  bag ${BAG}  ${row.path}`,
      "  answer: `lares shore restore <uri>` · `lares shore remove <uri>` · over all: `--all --count <n>` with the count one bag holds (and --bag where more than one bag stands pending)",
    ]);
    expect(removeReceiptLines([row.uri], [row], none)).toEqual([`  ${row.uri}`]);
    expect(pendingRemovalLines([row], [BAG], none)).toEqual(pendingRemovalLines([row], [BAG]));
    expect(withRetiredBy([row], none)).toEqual([row]);
  });
});
