#!/usr/bin/env node
/**
 * seed-seat — every Claude door seats the boot seed whole at turn 1, by reference, at content rank.
 *
 * ── THE SEAT ─────────────────────────────────────────────────────────────────────────────────────
 * Claude Code's `@` import loads a file by its NAME: `.md`, `.txt`, `.json` and extensionless names
 * expand, and a `.mem` stays silent. It follows a symlink to the bytes it names. So one relative link,
 * `.claude/noosphere-boot`, carries the memegraph's own bytes to the project CLAUDE.md, the operator's
 * global CLAUDE.md, every fork and every spirit that loads CLAUDE.md. Nothing copies; the memegraph's
 * write to the `.mem` is the update. One file imported from two scopes seats once.
 *
 * ── THE SCOUTS ───────────────────────────────────────────────────────────────────────────────────
 * Explore and Plan start without CLAUDE.md. A same-named agent under `.claude/agents/` overrides each
 * built-in, and its body becomes the scout's system prompt, so the scouts carry the seed's bytes in a
 * PROJECTION: a pure function of the seed, written only when its bytes differ, read back whole by the
 * witness. The override drops the built-in's tool limits, so each projection names its own
 * `disallowedTools`; a scout reads and never writes.
 *
 * ── THE OPERATOR'S BLOCK ─────────────────────────────────────────────────────────────────────────
 * `install` writes one marked region into `<home>/.claude/CLAUDE.md` that imports the main clone's
 * link by absolute path, so a session in any directory stands the house. A second run changes nothing,
 * `--uninstall` lifts the region, and bytes outside the markers stay as the operator left them. The
 * clone derives from git's common dir, so a run from any worktree seats the main clone.
 *
 * Usage:  node tools/seed-seat.mjs project [--root <dir>]       write the scouts that differ from the seed
 *         node tools/seed-seat.mjs check [--root <dir>] [--index]  read the seat; exit 1 on a fault
 *         node tools/seed-seat.mjs install [--home <dir>] [--clone <dir>] [--uninstall]
 * Exit:   0 seated · 1 a fault (check) · 2 a refusal or a usage error
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
export const LINK = ".claude/noosphere-boot";
export const IMPORT_LINE = `@${LINK}`;
export const BLOCK_OPEN = "<!-- >>> lares seed-seat >>> -->";
export const BLOCK_CLOSE = "<!-- <<< lares seed-seat <<< -->";

/** The names an `@` import expands (measured against the host); any other name loads nothing. */
export const LOADABLE_EXTENSIONS = new Set(["", ".md", ".txt", ".json"]);

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The scouts that start without CLAUDE.md, each wearing the house under its own mask. */
export const SCOUTS = [
  {
    name: "Explore",
    model: "sonnet",
    description:
      "Read-only search agent for broad fan-out searches — when answering means sweeping many files, directories, or naming conventions and you only need the conclusion, not the file dumps. It reads excerpts rather than whole files, so it locates code; it doesn't review or audit it. Specify search breadth: \"medium\" for moderate exploration, \"very thorough\" for multiple locations and naming conventions.",
    mask:
      "You wake as `Explore: Lares (Tasked Spirit)`, the house above standing whole. The mask carries one move: locate. Sweep the files, directories and naming conventions the brief names, read excerpts rather than whole files, and hand back the conclusion with `path:line` grounds and the breadth you covered. You read and report; you never write, edit or spawn.",
  },
  {
    name: "Plan",
    model: "inherit",
    description:
      "Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.",
    mask:
      "You wake as `Plan: Lares (Tasked Spirit)`, the house above standing whole. The mask carries one move: design the path. Read the ground the brief names, then hand back a step-by-step plan that names the critical files, the trade-offs weighed and the reds each step owes first. You read and design; you never write, edit or spawn.",
  },
];

const SCOUT_DISALLOWED = "Agent, Edit, Write, NotebookEdit, ExitPlanMode, Artifact, ArtifactComments, ArtifactData";

export const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** A scout's agent file: frontmatter, the seed's bytes, then the mask. A pure function of the seed. */
export function projectScout(seed, scout) {
  return [
    "---",
    `name: ${scout.name}`,
    `description: ${JSON.stringify(scout.description)}`,
    `disallowedTools: ${SCOUT_DISALLOWED}`,
    `model: ${scout.model}`,
    `# projected by tools/seed-seat.mjs from ${SEED} (sha256 ${sha256(seed)}); the seed is the source`,
    "---",
    seed.endsWith("\n") ? seed : `${seed}\n`,
    `<<~ ahu #/the-mask>>`,
    "",
    `!! ${scout.name} ~ the scout's mask`,
    "",
    scout.mask,
    "",
    "<<~/ahu>>",
    "",
  ].join("\n");
}

export const scoutPath = (scout) => `.claude/agents/${scout.name}.md`;

/** Import lines outside fences, as the host reads them: a line whose first token starts with `@`. */
export function importsOf(text) {
  const out = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^\s*@(\S+)\s*$/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Bare `@word` tokens inside the seed that an import would try to follow. */
export function seedAtTokens(seed) {
  const out = new Set();
  for (const m of seed.matchAll(/(?:^|\s)@([^\s`"'<>()[\]{}]+)/g)) out.add(m[1]);
  return [...out];
}

function reader(root, index) {
  if (!index) return (rel) => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : null);
  return (rel) => {
    try { return execFileSync("git", ["-C", root, "show", `:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
    catch { return null; }
  };
}

/** Every fault the seat carries, each one line naming the file and the law it breaks. */
export function faultsOf(root, { index = false } = {}) {
  const read = reader(root, index);
  const faults = [];
  const seed = read(SEED);
  if (seed === null) return [`${SEED}: the seed is absent`];

  if (index) {
    const entry = execFileSync("git", ["-C", root, "ls-files", "--stage", "--", LINK], { encoding: "utf8" }).trim();
    if (!entry) faults.push(`${LINK}: absent from the index; it links to ${SEED}`);
    else if (!entry.startsWith("120000 ")) faults.push(`${LINK}: the index holds a regular file, not a link`);
  } else {
    const linkAbs = join(root, LINK);
    let stat = null;
    try { stat = lstatSync(linkAbs); } catch { /* absent */ }
    if (!stat) faults.push(`${LINK}: absent; it links to ${SEED}`);
    else if (!stat.isSymbolicLink()) faults.push(`${LINK}: a regular file, not a link; an import of it carries these bytes, not the seed`);
    else {
      const target = readlinkSync(linkAbs);
      if (isAbsolute(target)) faults.push(`${LINK}: links by absolute path ${target}; the link stays relative so every clone resolves it`);
      let real = null;
      try { real = realpathSync(linkAbs); } catch { faults.push(`${LINK}: dangles at ${target}`); }
      if (real && real !== realpathSync(join(root, SEED))) faults.push(`${LINK}: resolves to ${real}, not ${SEED}`);
    }
  }

  const claude = read("CLAUDE.md");
  if (claude === null) faults.push("CLAUDE.md: absent");
  else {
    const imports = importsOf(claude);
    if (!imports.includes(LINK)) faults.push(`CLAUDE.md: carries no ${IMPORT_LINE} import`);
    for (const target of imports) {
      if (!LOADABLE_EXTENSIONS.has(extname(target))) faults.push(`CLAUDE.md: @${target} names a ${extname(target)} file, which an import never loads`);
    }
  }

  for (const scout of SCOUTS) {
    const onDisk = read(scoutPath(scout));
    if (onDisk === null) faults.push(`${scoutPath(scout)}: absent; node tools/seed-seat.mjs project writes it`);
    else if (onDisk !== projectScout(seed, scout)) faults.push(`${scoutPath(scout)}: parts from the seed's projection; node tools/seed-seat.mjs project rewrites it`);
  }

  for (const token of seedAtTokens(seed)) {
    for (const base of [dirname(join(root, LINK)), dirname(join(root, SEED)), root]) {
      if (existsSync(resolve(base, token))) { faults.push(`${SEED}: @${token} resolves to a file, which an import would inline inside the seed`); break; }
    }
  }
  return faults;
}

/** Writes each scout whose bytes differ from the seed's projection; answers the paths it wrote. */
export function project(root) {
  const seed = readFileSync(join(root, SEED), "utf8");
  const wrote = [];
  for (const scout of SCOUTS) {
    const path = join(root, scoutPath(scout));
    const want = projectScout(seed, scout);
    if (existsSync(path) && readFileSync(path, "utf8") === want) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, want);
    wrote.push(scoutPath(scout));
  }
  return wrote;
}

/** The main clone a worktree belongs to: the parent of git's common dir. */
export function mainClone(from) {
  const common = execFileSync("git", ["-C", from, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return dirname(common);
}

export const blockFor = (clone) => [BLOCK_OPEN, `@${join(clone, LINK)}`, BLOCK_CLOSE].join("\n");

/**
 * The operator's CLAUDE.md with the region set (or lifted). Throws on a region it cannot bound.
 * The region leads the file, so the seed opens the operator's own instructions.
 */
export function withBlock(text, block) {
  const open = text.split(BLOCK_OPEN).length - 1;
  const close = text.split(BLOCK_CLOSE).length - 1;
  if (open !== close || open > 1) throw new Error(`the file carries ${open} opening and ${close} closing seed-seat markers; it bounds one region or none`);
  if (open === 1) {
    const start = text.indexOf(BLOCK_OPEN);
    const end = text.indexOf(BLOCK_CLOSE) + BLOCK_CLOSE.length;
    if (end < start) throw new Error("the closing seed-seat marker stands before the opening one");
    const after = text.slice(end).replace(/^\n{1,2}/, "");
    const before = text.slice(0, start);
    if (block === null) return before + after;
    return `${before}${block}\n\n${after}`;
  }
  if (block === null) return text;
  return text.length ? `${block}\n\n${text}` : `${block}\n`;
}

export function install({ home = homedir(), clone = mainClone(REPO), uninstall = false } = {}) {
  const path = join(home, ".claude", "CLAUDE.md");
  const before = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (!uninstall && !existsSync(join(clone, LINK))) throw new Error(`${join(clone, LINK)} is absent; the clone carries no seat to import`);
  const after = withBlock(before, uninstall ? null : blockFor(clone));
  if (after === before) return { path, changed: false };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, after);
  return { path, changed: true };
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function main(argv) {
  const [verb, ...args] = argv;
  const root = resolve(flag(args, "--root") ?? REPO);
  if (verb === "project") {
    const wrote = project(root);
    console.log(wrote.length ? `seed-seat: projected ${wrote.join(", ")}` : "seed-seat: every scout already carries the seed");
    return 0;
  }
  if (verb === "check") {
    const faults = faultsOf(root, { index: args.includes("--index") });
    for (const f of faults) console.log(`seed-seat: ${f}`);
    if (faults.length) return 1;
    console.log("seed-seat: the seat stands");
    return 0;
  }
  if (verb === "install") {
    try {
      const home = flag(args, "--home");
      const clone = flag(args, "--clone");
      const r = install({ ...(home && { home: resolve(home) }), ...(clone && { clone: resolve(clone) }), uninstall: args.includes("--uninstall") });
      console.log(`seed-seat: ${r.changed ? (args.includes("--uninstall") ? "lifted the region from" : "seated") : "unchanged"} ${r.path}`);
      return 0;
    } catch (e) {
      console.error(`seed-seat: REFUSED — ${e.message}`);
      return 2;
    }
  }
  console.error("usage: seed-seat.mjs project [--root <dir>] | check [--root <dir>] [--index] | install [--home <dir>] [--clone <dir>] [--uninstall]");
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
