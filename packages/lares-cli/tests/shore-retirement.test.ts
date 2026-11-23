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
import { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test as plain, vi } from "vitest";
import { fc, test } from "@fast-check/vitest";
import "./laws/fixed-seed.js";
import { otakiageLine, pendingReceipts, retirementFor, retirementLine, retirementsFor, withRetiredBy } from "../src/shore-retirement.js";
import { removeReceiptLines, retiredByCarrier, shorePendingLines } from "../src/commands/shore.js";
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

/** Stand `rel` on main, delete it on a feature branch under `message`, and merge that branch to main as the house does. */
function retireThroughPr(c: ReturnType<typeof checkout>, rel: string, message: string, pr: number): string {
  const parts = rel.split("/");
  mkdirSync(c.at(...parts.slice(0, -1)), { recursive: true });
  writeFileSync(c.at(...parts), "v\n");
  c.git("add", "--", rel); c.git("commit", "-qm", `stand ${rel}`);
  c.git("checkout", "-qb", `pr-${pr}`);
  c.git("rm", "-q", "--", rel); c.git("commit", "-qm", message);
  const sha = c.git("rev-parse", "--short", "HEAD");
  c.git("checkout", "-q", "main");
  c.git("merge", "-q", "--no-ff", "-m", `Merge pull request #${pr} from house/pr-${pr}`, `pr-${pr}`);
  return sha;
}

/** Every root the scratch checkouts stand under: the house names these, and nothing else reads trusted. */
const roots = (c: { dir: string }) => ({ roots: [c.dir] });

describe("a shore receipt reads the checkout's retirement", () => {
  plain("names the deleting commit, the PR whose merge brought it, its destination, and where git keeps the carrier", async () => {
    const c = checkout();
    const sha = retireThroughPr(c, "bags/voice.mem", "retire voice into api/voices", 419);
    expect(await retirementFor(c.at("bags", "voice.mem"), roots(c))).toEqual({ sha, subject: "retire voice into api/voices", pr: 419, ashes: `${sha}^:bags/voice.mem`, destination: "api/voices" });
  });

  plain("a directory that left with its file still answers; a destination keeps its path's extension", async () => {
    const c = checkout();
    mkdirSync(c.at("bags", "docs", "voices"), { recursive: true });
    writeFileSync(c.at("bags", "docs", "voices", "masks.mem"), "masks\n");
    writeFileSync(c.at("bags", "keep.mem"), "stays\n");
    c.git("add", "."); c.git("commit", "-qm", "stand");
    c.git("rm", "-q", "-r", "bags/docs"); c.git("commit", "-qm", "docs/voices leave, their substance merged into the api specs they duplicated: bags/api/voices.mem. The rest burns.");
    const sha = c.git("rev-parse", "--short", "HEAD");
    expect(await retirementFor(c.at("bags", "docs", "voices", "masks.mem"), roots(c))).toMatchObject({ sha, ashes: `${sha}^:bags/docs/voices/masks.mem`, destination: "bags/api/voices.mem" });
  });

  plain("a direct push names no PR: not from a later unrelated PR merge, not from a `(#N)` its own subject carries", async () => {
    const c = checkout();
    const sha = standThenRetire(c, "bags/voice.mem", "v\n", "retire voice (#12)");
    c.git("checkout", "-qb", "other"); c.git("commit", "-q", "--allow-empty", "-m", "unrelated work");
    c.git("checkout", "-q", "main"); c.git("merge", "-q", "--no-ff", "-m", "Merge pull request #13 from house/other", "other");
    const r = await retirementFor(c.at("bags", "voice.mem"), roots(c));
    expect(r).toMatchObject({ sha, subject: "retire voice (#12)" });
    expect(r?.pr).toBeUndefined();
  });

  plain("many paths read in one pass: only a deleted carrier answers, a file never tracked and a standing one ride absent", () => {
    const c = checkout();
    const sha = standThenRetire(c, "bags/gone.mem", "gone\n", "the gone carrier leaves");
    mkdirSync(c.at("bags"), { recursive: true }); writeFileSync(c.at("bags", "standing.mem"), "here\n"); c.git("add", "."); c.git("commit", "-qm", "stand another");
    const read = retirementsFor([c.at("bags", "gone.mem"), c.at("bags", "never.mem"), c.at("bags", "standing.mem")], roots(c));
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
      const r = await retirementFor(c.at("bags", `${name}.mem`), roots(c));
      expect(r).toBeDefined();
      expect(execFileSync("git", ["show", r!.ashes], { cwd: c.dir, encoding: "utf8" })).toBe(body);
    },
  );

  plain("CONTROL: a path with no checkout above it contributes nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shore-no-git-")); dirs.push(dir);
    expect(await retirementFor(join(dir, "missing.mem"), { roots: [dir] })).toBeUndefined();
  });

  plain("CONTROL: no git binary answers nothing and throws nothing", async () => {
    const c = checkout();
    standThenRetire(c, "bags/voice.mem", "v\n", "retire voice");
    vi.stubEnv("PATH", c.at("no-bin-here"));
    expect(await retirementFor(c.at("bags", "voice.mem"), roots(c))).toBeUndefined();
  });

  plain("CONTROL: a spent bound answers nothing, at once", () => {
    const c = checkout();
    standThenRetire(c, "bags/voice.mem", "v\n", "retire voice");
    const started = performance.now();
    expect(retirementsFor([c.at("bags", "voice.mem")], { ...roots(c), boundMs: 0 }).size).toBe(0);
    expect(pendingReceipts([{ uri: "lar:///a.b.c/x", bagId: BAG, path: c.at("bags", "voice.mem") }], { ...roots(c), deadline: performance.now() }).size).toBe(0);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe("a hostile checkout runs nothing", () => {
  /** A checkout whose own config names a program at every exec-capable key, and whose deleting commit carries a signature. */
  function hostile(): { c: ReturnType<typeof checkout>; marker: string } {
    const c = checkout();
    const marker = c.at("ran");
    const script = c.at("planted.sh");
    writeFileSync(script, `#!/bin/sh\ntouch "${marker}"\nexit 1\n`); chmodSync(script, 0o755);
    mkdirSync(c.at("bags"), { recursive: true }); writeFileSync(c.at("bags", "voice.mem"), "v\n");
    c.git("add", "bags"); c.git("commit", "-qm", "stand voice");
    c.git("rm", "-q", "bags/voice.mem");
    const tree = c.git("write-tree");
    const parent = c.git("rev-parse", "HEAD");
    const signed = [`tree ${tree}`, `parent ${parent}`, "author W <w@example.test> 1700000000 +0000", "committer W <w@example.test> 1700000000 +0000",
      "gpgsig -----BEGIN PGP SIGNATURE-----", " ", " iQEzBAABCAAdFiEE", " -----END PGP SIGNATURE-----", "", "retire voice", ""].join("\n");
    const sha = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], { cwd: c.dir, input: signed, encoding: "utf8" }).trim();
    c.git("update-ref", "HEAD", sha);
    for (const [key, value] of [["log.showSignature", "true"], ["gpg.program", script], ["gpg.ssh.program", script], ["gpg.x509.program", script], ["core.fsmonitor", script], ["core.pager", script], ["core.hooksPath", c.at()], ["diff.external", script]])
      c.git("config", key!, value!);
    return { c, marker };
  }

  plain("a checkout under a root the house names reads its receipt, and its planted programs never run", async () => {
    const { c, marker } = hostile();
    expect(await retirementFor(c.at("bags", "voice.mem"), roots(c))).toMatchObject({ subject: "retire voice" });
    expect(existsSync(marker)).toBe(false);
  });

  plain("a checkout under no root the house names stays silent and runs nothing", async () => {
    const { c, marker } = hostile();
    const elsewhere = mkdtempSync(join(tmpdir(), "shore-elsewhere-")); dirs.push(elsewhere);
    expect(await retirementFor(c.at("bags", "voice.mem"), { roots: [elsewhere] })).toBeUndefined();
    expect(await retirementFor(c.at("bags", "voice.mem"), { roots: [c.at("bags")] })).toBeUndefined(); // the .git above the root reads untrusted
    expect(existsSync(marker)).toBe(false);
  });
});

describe("the shore names the receipt wherever it names a pending removal", () => {
  /** A scratch retirement through a PR merge and the pending row the island would name for it. */
  function retiredRow(message = "retire voice into api/voices", bagId = BAG) {
    const c = checkout();
    const sha = retireThroughPr(c, "bags/voice.mem", message, 419);
    const row = { uri: "lar:///ha.ka.ba/lares/docs/voice", bagId, path: c.at("bags", "voice.mem") };
    return { sha, row, receipts: pendingReceipts([row], roots(c)) };
  }

  plain("shore list names the sha, the subject, the PR and the ashes beneath the row", () => {
    const { sha, row, receipts } = retiredRow();
    const lines = shorePendingLines([row], receipts);
    expect(lines.join("\n")).toContain(`retired by ${sha} "retire voice into api/voices" (PR #419); ashes at ${sha}^:bags/voice.mem`);
    expect(lines.indexOf(`  ${row.uri}  bag ${BAG}  ${row.path}`)).toBeLessThan(lines.findIndex((l) => l.includes("retired by")));
  });

  plain("the remove answer names the receipt and an otakiage note per carrier it reached", () => {
    const { sha, row, receipts } = retiredRow();
    expect(removeReceiptLines([row.uri], BAG, [row], receipts)).toEqual([
      `  ${row.uri}`,
      `      ${retirementLine(receipts.get(row.path)!)}`,
      `      otakiage: its substance went to api/voices, as ${sha} names`,
    ]);
    const bare = retiredRow("retire voice");
    expect(removeReceiptLines([bare.row.uri], BAG, [bare.row], bare.receipts)[2]).toBe("      otakiage: the retiring commit names no destination");
    expect(otakiageLine(bare.receipts.get(bare.row.path)!)).toBe("otakiage: the retiring commit names no destination");
  });

  plain("a carrier two bags name reads the receipt of the bag the answer reached, keyed by bag and carrier", () => {
    const other = "lar:///ha.ka.ba/bags/lararium";
    const a = retiredRow("retire voice into api/voices", BAG);
    const b = retiredRow("retire voice into api/masks", other);
    const rows = [a.row, b.row];
    const receipts = new Map([...a.receipts, ...b.receipts]);
    expect(removeReceiptLines([b.row.uri], other, rows, receipts)).toEqual([
      `  ${b.row.uri}`,
      `      ${retirementLine(b.receipts.get(b.row.path)!)}`,
      `      otakiage: its substance went to api/masks, as ${b.sha} names`,
    ]);
    expect(retiredByCarrier([b.row.uri], other, rows, receipts)).toEqual({ [other]: { [b.row.uri]: b.receipts.get(b.row.path) } });
    expect(retiredByCarrier([a.row.uri], undefined, rows, receipts)).toEqual({ [BAG]: { [a.row.uri]: a.receipts.get(a.row.path) }, [other]: { [b.row.uri]: b.receipts.get(b.row.path) } });
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
    expect(withRetiredBy([row], receipts)).toEqual([{ ...row, retiredBy: { sha, subject: "retire voice into api/voices", pr: 419, ashes: `${sha}^:bags/voice.mem`, destination: "api/voices" } }]);
  });

  plain("CONTROL: with no receipt every line and row reads as it did", () => {
    const row = { uri: "lar:///ha.ka.ba/lares/docs/voice", bagId: BAG, path: "/nowhere/bags/voice.mem" };
    const none = pendingReceipts([row], { roots: ["/nowhere"] });
    expect(none.size).toBe(0);
    expect(shorePendingLines([row], none)).toEqual([
      "1 pending removal(s): the file vanished where a base stands; nothing writes back and nothing tombstones",
      `  ${row.uri}  bag ${BAG}  ${row.path}`,
      "  answer: `lares shore restore <uri>` · `lares shore remove <uri>` · over all: `--all --count <n>` with the count one bag holds (and --bag where more than one bag stands pending)",
    ]);
    expect(removeReceiptLines([row.uri], BAG, [row], none)).toEqual([`  ${row.uri}`]);
    expect(pendingRemovalLines([row], [BAG], none)).toEqual(pendingRemovalLines([row], [BAG]));
    expect(withRetiredBy([row], none)).toEqual([row]);
  });
});
