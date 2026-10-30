/**
 * seed-seat — every host stands the whole boot seed at turn 1, once, by reference, at content rank.
 *
 * The law, the ground measured against each host and its open research stand in one carrier,
 * lar:///ha.ka.ba/lares/docs/pono/seed-seat; `tools/seed-seat.mjs check` reads the repo's seat. This
 * module holds the WRITES `lares wire` makes: the repo's seat, and each harness home's share of it.
 *
 * A HOST LOADS BY NAME AND READS NO LINK IT IS HANDED. Claude's `@` import skips a `.mem` name, and
 * Codex and Copilot never follow a markdown link, so a pointer naming the carrier seats nothing and
 * says nothing. A symlink of a loadable name carries the carrier's own bytes instead: no copy, one
 * source, the memegraph's write to the carrier is the update.
 *
 * ONE SEED PER SESSION. Claude dedupes an import by real path, so the operator's home seat lives in a
 * rule this module owns whole, and the repo's settings exclude it: inside the clone or a worktree the
 * tree's own seed seats alone, everywhere else the rule seats the main clone's. Codex and Copilot load
 * a home file beside the project's with no exclude, so their homes carry no seed; inside the clone the
 * repo seats them.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, symlinkSync, unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { WireAction } from "./mcp-resolve.js";

/** The carrier, repo-relative. */
export const BOOT_CARRIER = "bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem";
/** Claude's link: an extensionless name an import loads. */
export const CLAUDE_LINK = ".claude/noosphere-boot";
/** Codex reads `AGENTS.override.md` in place of `AGENTS.md`; Copilot and Claude never read it. */
export const CODEX_LINK = "AGENTS.override.md";
/** The operator's home seat, owned whole by this module. */
export const SEAT_RULE = ".claude/rules/lares-seed-seat.md";
export const SEAT_RULE_EXCLUDE = `**/${SEAT_RULE}`;
export const SEAT_RULE_OWNER = "<!-- written by lares wire; the seed is the source -->";
/** Codex's project-doc budget, past the carrier's bytes (its default cuts the tail without a word). */
export const CODEX_DOC_CAP = 65536;

export interface SeedSeatStep {
  readonly item: string;
  readonly action: WireAction;
  readonly detail: string;
}

const ADAPTER = (name: string, prose: string) => `## ${name} Adapter Surface\n\n- Keep this file thin.\n${prose}`;

/** Files a host reads beside CLAUDE.md, whose import already seats the seed; each stays seedless. */
const SEEDLESS: ReadonlyArray<{ file: string; render: string }> = [
  { file: "AGENTS.md", render: ADAPTER("Agents", "- Copilot and VS Code read this file; Codex reads `AGENTS.override.md`, the boot seed, in its place. CLAUDE.md's import seats the seed for Copilot, so this file stays seedless.\n") },
  { file: "copilot-instructions.md", render: ADAPTER("Copilot", "- CLAUDE.md's import seats the boot seed for Copilot, so this file stays seedless.\n") },
  { file: ".github/copilot-instructions.md", render: ADAPTER("Copilot", "- CLAUDE.md's import seats the boot seed for Copilot, so this file stays seedless.\n") },
];

/** The files a host reads beside CLAUDE.md that stay seedless, as `tools/seed-seat.mjs` reads them. */
export const SEEDLESS_FILES = SEEDLESS.map((s) => s.file);

const CLAUDE_RENDER = `@${CLAUDE_LINK}\n\n${ADAPTER("Claude", "- Add only Claude-specific customizations here.\n")}`;

/**
 * A pointer line: one naming the carrier's file, or an import of a seed link. The one shape this
 * module owns inside a file it shares; prose that mentions the link stays the operator's.
 */
const namesSeed = (line: string): boolean =>
  line.includes("noosphere-boot.mem") || /^\s*@\S*noosphere-boot\S*\s*$/.test(line);

/**
 * Tend one relative link from `root/link` to the carrier. A regular file at that path keeps a
 * backup and yields to the link, since a host reading it carries those bytes and never the seed.
 */
export function tendLink(root: string, link: string): SeedSeatStep {
  const abs = join(root, link);
  const want = relative(dirname(abs), join(root, BOOT_CARRIER));
  let stat = null;
  try { stat = lstatSync(abs); } catch { /* absent */ }
  if (stat?.isSymbolicLink() && readlinkSync(abs) === want) {
    return { item: link, action: "present", detail: `${link} -> ${BOOT_CARRIER}` };
  }
  if (stat && !stat.isSymbolicLink()) copyFileSync(abs, `${abs}.bak`);
  if (stat) unlinkSync(abs);
  mkdirSync(dirname(abs), { recursive: true });
  symlinkSync(want, abs);
  return { item: link, action: "wired", detail: `${link} linked -> ${BOOT_CARRIER}` };
}

/**
 * Head `file` with `line`, replacing a line that names the seed, and keep every other line standing.
 * An absent file takes `render` whole.
 */
export function tendHeadLine(file: string, line: string, render: string, item: string): SeedSeatStep {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, render, "utf8");
    return { item, action: "wired", detail: `${file} seated` };
  }
  const standing = readFileSync(file, "utf8");
  const lines = standing.split("\n");
  if (lines[0] === line && !lines.slice(1).some(namesSeed)) return { item, action: "present", detail: `${file} imports the seed` };
  const kept = lines.filter((l) => !namesSeed(l));
  const body = kept.join("\n").replace(/^\n+/, "");
  copyFileSync(file, `${file}.bak`);
  writeFileSync(file, `${line}\n\n${body}`, "utf8");
  return { item, action: "wired", detail: `${file} headed with ${line}` };
}

/**
 * Lift every line that names the seed from `file`. A file left holding nothing but frontmatter or
 * blank lines goes whole, since the seed line was all it carried. An absent file takes `render` when
 * one is given, and otherwise stays absent.
 */
export function liftSeedLines(file: string, item: string, render?: string): SeedSeatStep {
  if (!existsSync(file)) {
    if (render === undefined) return { item, action: "present", detail: `${file} absent; it carries no seed` };
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, render, "utf8");
    return { item, action: "wired", detail: `${file} seated seedless` };
  }
  const standing = readFileSync(file, "utf8");
  if (!standing.split("\n").some(namesSeed)) return { item, action: "present", detail: `${file} carries no seed` };
  copyFileSync(file, `${file}.bak`);
  const kept = standing.split("\n").filter((l) => !namesSeed(l)).join("\n");
  const residue = kept.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
  if (residue === "") {
    unlinkSync(file);
    return { item, action: "wired", detail: `${file} lifted whole; the seed line was all it carried` };
  }
  writeFileSync(file, kept.replace(/^\n+/, ""), "utf8");
  return { item, action: "wired", detail: `${file}: the seed line lifted` };
}

/** Codex's project-doc cap, set past the carrier's bytes; every other line of the config stands. */
export function tendCodexCap(root: string): SeedSeatStep {
  const file = join(root, ".codex", "config.toml");
  const standing = existsSync(file) ? readFileSync(file, "utf8") : "";
  const held = Number(/^\s*project_doc_max_bytes\s*=\s*(\d+)/m.exec(standing)?.[1] ?? 0);
  if (held >= CODEX_DOC_CAP) return { item: ".codex/config.toml", action: "present", detail: `project_doc_max_bytes ${held}` };
  const line = `project_doc_max_bytes = ${CODEX_DOC_CAP}`;
  const next = held
    ? standing.replace(/^\s*project_doc_max_bytes\s*=\s*\d+/m, line)
    : `${line}\n${standing.length ? `\n${standing}` : ""}`;
  mkdirSync(dirname(file), { recursive: true });
  if (standing) copyFileSync(file, `${file}.bak`);
  writeFileSync(file, next, "utf8");
  return { item: ".codex/config.toml", action: "wired", detail: `project_doc_max_bytes ${CODEX_DOC_CAP}` };
}

/** The repo's exclude of the operator's rule, so a worktree session seats its own tree's seed alone. */
export function tendRuleExclude(root: string): SeedSeatStep {
  const file = join(root, ".claude", "settings.json");
  const settings = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  const excludes = Array.isArray(settings.claudeMdExcludes) ? (settings.claudeMdExcludes as string[]) : [];
  if (excludes.includes(SEAT_RULE_EXCLUDE)) return { item: ".claude/settings.json", action: "present", detail: `excludes ${SEAT_RULE_EXCLUDE}` };
  const next = { claudeMdExcludes: [...excludes, SEAT_RULE_EXCLUDE], ...Object.fromEntries(Object.entries(settings).filter(([k]) => k !== "claudeMdExcludes")) };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { item: ".claude/settings.json", action: "wired", detail: `excludes ${SEAT_RULE_EXCLUDE}` };
}

/** Every write the repo's seat takes. A clone carrying no carrier seats nothing. */
export function tendRepoSeat(root: string): SeedSeatStep[] {
  if (!existsSync(join(root, BOOT_CARRIER))) {
    return [{ item: "repo seat", action: "missing-script", detail: `${BOOT_CARRIER} not found; the seat would carry nothing` }];
  }
  return [
    tendLink(root, CLAUDE_LINK),
    tendLink(root, CODEX_LINK),
    tendHeadLine(join(root, "CLAUDE.md"), `@${CLAUDE_LINK}`, CLAUDE_RENDER, "CLAUDE.md"),
    ...SEEDLESS.map((s) => liftSeedLines(join(root, s.file), s.file, s.render)),
    tendCodexCap(root),
    tendRuleExclude(root),
  ];
}

/** The main clone a tree belongs to: the parent of git's common dir, or the tree itself. */
export function mainCloneOf(root: string): string {
  try {
    const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return dirname(common);
  } catch {
    return root;
  }
}

/**
 * The operator's home seat: one rule this module owns whole, importing the main clone's Claude link.
 * A same-named file it never wrote stays as it stands, and the step names the refusal.
 */
export function tendSeatRule(home: string, clone: string): SeedSeatStep {
  const file = join(home, SEAT_RULE);
  const link = join(clone, CLAUDE_LINK);
  if (!existsSync(link)) return { item: SEAT_RULE, action: "missing-script", detail: `${link} not found; the rule would import nothing` };
  const want = `${SEAT_RULE_OWNER}\n@${realpathSync(clone)}/${CLAUDE_LINK}\n`;
  const standing = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (standing === want) return { item: SEAT_RULE, action: "present", detail: `${file} imports ${link}` };
  if (standing !== null && !standing.startsWith(SEAT_RULE_OWNER)) {
    return { item: SEAT_RULE, action: "missing-script", detail: `${file} carries bytes lares wire never wrote; it stays as it stands` };
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, want, "utf8");
  return { item: SEAT_RULE, action: "wired", detail: `${file} imports ${link}` };
}
