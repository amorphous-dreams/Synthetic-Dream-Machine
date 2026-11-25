#!/usr/bin/env node
/**
 * pulama-closure-moves — whether a change moves the pūlama's code closure (course pulama-unblur), so a pull request names
 * ahead of any kūkulu whether its first raise relights the pūlama by the hand's route.
 *
 *   node tools/pulama-closure-moves.mjs <base> <head>
 *
 * It archives each revision's closure inputs (`packages/`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `pnpm-lock.yaml`: the
 * files tools/pulama-closure.mjs reads) from this checkout's git, reads both closures with `--list`, and prints markdown:
 *   moves the pūlama closure: yes (sha256:<12> -> sha256:<12>)    then each member that moved, joined or left
 *   moves the pūlama closure: no (sha256:<12>)
 *   moves the pūlama closure: unread (<why>)                       a revision or a closure that read nowhere
 * The CI job summary carries the lines (.github/workflows/ci.yml, Quick gates): informational, never a gate, so every reading
 * exits 0; a missing argument exits 2.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [base, head] = process.argv.slice(2);
if (!base || !head) { process.stderr.write("usage: pulama-closure-moves.mjs <base> <head>\n"); process.exit(2); }
const HERE = dirname(fileURLToPath(import.meta.url));
const INPUTS = ["packages", "pnpm-workspace.yaml", "tsconfig.base.json", "pnpm-lock.yaml"];

/** The `<sha256>  <path>` lines and the digest of one revision's closure, or the reason it reads nowhere. */
function closureAt(rev) {
  const dir = mkdtempSync(join(tmpdir(), "pulama-closure-moves-"));
  try {
    const sha = execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{commit}`], { encoding: "utf8" }).trim();
    const present = INPUTS.filter((p) => { try { execFileSync("git", ["cat-file", "-e", `${sha}:${p}`], { stdio: "ignore" }); return true; } catch { return false; } });
    const tar = execFileSync("git", ["archive", "--format=tar", sha, "--", ...present], { maxBuffer: 1 << 30 });
    execFileSync("tar", ["-xf", "-", "-C", dir], { input: tar });
    const list = execFileSync(process.execPath, [join(HERE, "pulama-closure.mjs"), dir, "--list"], { encoding: "utf8", maxBuffer: 1 << 28 });
    const digest = execFileSync(process.execPath, [join(HERE, "pulama-closure.mjs"), dir], { encoding: "utf8" }).trim();
    return { sha, digest, members: new Map(list.split("\n").filter(Boolean).map((l) => { const at = l.indexOf("  "); return [l.slice(at + 2), l.slice(0, at)]; })) };
  } catch (err) {
    return { why: `${rev}: ${String(err?.stderr || err?.message || err).trim().split("\n")[0] || "no closure reads"}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const short = (d) => d.slice(0, 19);
const a = closureAt(base), b = closureAt(head);
if (a.why || b.why) {
  process.stdout.write(`moves the pūlama closure: unread (${a.why ?? b.why})\n`);
} else if (a.digest === b.digest) {
  process.stdout.write(`moves the pūlama closure: no (${short(b.digest)})\n`);
} else {
  const lines = [`moves the pūlama closure: yes (${short(a.digest)} -> ${short(b.digest)}); the first kūkulu after it relights the pūlama unless a successor names the new closure`, ""];
  for (const path of [...new Set([...a.members.keys(), ...b.members.keys()])].sort()) {
    const was = a.members.get(path), now = b.members.get(path);
    if (was === now) continue;
    lines.push(`- \`${path}\` ${was === undefined ? "joins" : now === undefined ? "leaves" : "moves"}`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}
