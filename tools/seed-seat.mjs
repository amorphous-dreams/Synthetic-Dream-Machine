#!/usr/bin/env node
/**
 * seed-seat — every host stands the whole boot seed at turn 1, once, by reference, at content rank.
 *
 * The law, the ground measured against each host and the open research stand in one carrier:
 * lar:///ha.ka.ba/lares/docs/pono/seed-seat. This tool holds the three acts that keep it:
 *
 * ── PROJECT ──────────────────────────────────────────────────────────────────────────────────────
 * Explore and Plan read no CLAUDE.md, so `.claude/agents/{Explore,Plan}.md` carry the seed's bytes as a
 * pure function of the seed: frontmatter that restores read-only tools, the seed, the scout's mask.
 * A scout whose bytes already match stays unwritten; the root build runs this.
 *
 * ── CHECK ────────────────────────────────────────────────────────────────────────────────────────
 * Every link stays a relative link to the seed, CLAUDE.md imports the Claude link by a loadable name,
 * the settings exclude the operator's rule, the Codex cap holds the seed, the Copilot-read surfaces
 * stay seedless, each scout matches its projection, and no `@` token in the seed resolves to a file.
 * `--index` reads what a commit carries.
 *
 * ── INSTALL ──────────────────────────────────────────────────────────────────────────────────────
 * Writes `<home>/.claude/rules/lares-seed-seat.md` whole, importing the main clone's link, so a session
 * in any directory stands the house; the repo excludes that rule, so a session inside the clone or a
 * worktree seats its own tree's seed alone. A second run changes nothing, `--uninstall` lifts it, and
 * a same-named file it never wrote refuses the run. The main clone derives from git's common dir.
 *
 * Usage:  node tools/seed-seat.mjs project [--root <dir>]       write the scouts that differ from the seed
 *         node tools/seed-seat.mjs check [--root <dir>] [--index]  read the seat; exit 1 on a fault
 *         node tools/seed-seat.mjs install [--home <dir>] [--clone <dir>] [--uninstall]
 * Exit:   0 seated · 1 a fault (check) · 2 a refusal or a usage error
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SEED = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
export const LINK = ".claude/noosphere-boot";
export const IMPORT_LINE = `@${LINK}`;
/** Codex reads `AGENTS.override.md` in place of `AGENTS.md`; Copilot and Claude never read it. */
export const CODEX_LINK = "AGENTS.override.md";
export const SEED_LINKS = [LINK, CODEX_LINK];
/** Copilot reads these beside CLAUDE.md, whose import already seats the seed; a seed here seats it twice. */
export const SEEDLESS_SURFACES = ["AGENTS.md", ".github/copilot-instructions.md"];
const SURFACE_WHY = "Copilot reads it beside CLAUDE.md, whose import already seats the seed, and a pointer loads nothing";
export const RULE = ".claude/rules/lares-seed-seat.md";
export const RULE_EXCLUDE = `**/${RULE}`;
export const RULE_OWNER = "<!-- written by tools/seed-seat.mjs install; the seed is the source -->";

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

/** The faults one seed link carries: it stays a relative link that resolves to the seed. */
function linkFaults(root, link, index) {
  if (index) {
    const entry = execFileSync("git", ["-C", root, "ls-files", "--stage", "--", link], { encoding: "utf8" }).trim();
    if (!entry) return [`${link}: absent from the index; it links to ${SEED}`];
    return entry.startsWith("120000 ") ? [] : [`${link}: the index holds a regular file, not a link`];
  }
  const abs = join(root, link);
  let stat = null;
  try { stat = lstatSync(abs); } catch { /* absent */ }
  if (!stat) return [`${link}: absent; it links to ${SEED}`];
  if (!stat.isSymbolicLink()) return [`${link}: a regular file, not a link; a host reading it carries these bytes, not the seed`];
  const target = readlinkSync(abs);
  const faults = [];
  if (isAbsolute(target)) faults.push(`${link}: links by absolute path ${target}; the link stays relative so every clone resolves it`);
  let real = null;
  try { real = realpathSync(abs); } catch { faults.push(`${link}: dangles at ${target}`); }
  if (real && real !== realpathSync(join(root, SEED))) faults.push(`${link}: resolves to ${real}, not ${SEED}`);
  return faults;
}

/** Every fault the seat carries, each one line naming the file and the law it breaks. */
export function faultsOf(root, { index = false } = {}) {
  const read = reader(root, index);
  const faults = [];
  const seed = read(SEED);
  if (seed === null) return [`${SEED}: the seed is absent`];

  for (const link of SEED_LINKS) faults.push(...linkFaults(root, link, index));

  const claude = read("CLAUDE.md");
  if (claude === null) faults.push("CLAUDE.md: absent");
  else {
    const imports = importsOf(claude);
    if (!imports.includes(LINK)) faults.push(`CLAUDE.md: carries no ${IMPORT_LINE} import`);
    for (const target of imports) {
      if (!LOADABLE_EXTENSIONS.has(extname(target))) faults.push(`CLAUDE.md: @${target} names a ${extname(target)} file, which an import never loads`);
    }
  }

  const settings = read(".claude/settings.json");
  let excludes = [];
  try { excludes = JSON.parse(settings ?? "{}").claudeMdExcludes ?? []; } catch { faults.push(".claude/settings.json: does not parse"); }
  if (!excludes.includes(RULE_EXCLUDE)) faults.push(`.claude/settings.json: claudeMdExcludes carries no ${RULE_EXCLUDE}; a worktree session would seat the main clone's seed beside its own`);

  const codex = read(".codex/config.toml") ?? "";
  const cap = Number(/^\s*project_doc_max_bytes\s*=\s*(\d+)/m.exec(codex)?.[1] ?? 0);
  if (cap < Buffer.byteLength(seed)) faults.push(`.codex/config.toml: project_doc_max_bytes ${cap || "unset"} holds less than the seed's ${Buffer.byteLength(seed)} bytes; Codex cuts the tail without a word`);

  for (const surface of SEEDLESS_SURFACES) {
    const text = read(surface);
    if (text !== null && (text.includes(seed.slice(0, 200)) || text.includes(basename(SEED)))) faults.push(`${surface}: carries the seed or a pointer to it; ${SURFACE_WHY}`);
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

export const ruleFor = (clone) => `${RULE_OWNER}\n@${join(clone, LINK)}\n`;

/** Seats (or lifts) the operator's rule; refuses a same-named file it never wrote. */
export function install({ home = homedir(), clone = mainClone(REPO), uninstall = false } = {}) {
  const path = join(home, RULE);
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (before !== null && !before.startsWith(RULE_OWNER)) throw new Error(`${path} carries bytes this installer never wrote`);
  if (uninstall) {
    if (before === null) return { path, changed: false };
    unlinkSync(path);
    return { path, changed: true };
  }
  if (!existsSync(join(clone, LINK))) throw new Error(`${join(clone, LINK)} is absent; the clone carries no seat to import`);
  const want = ruleFor(clone);
  if (before === want) return { path, changed: false };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, want);
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
      console.log(`seed-seat: ${r.changed ? (args.includes("--uninstall") ? "lifted" : "seated") : "unchanged"} ${r.path}`);
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
