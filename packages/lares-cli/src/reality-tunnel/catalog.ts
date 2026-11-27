/**
 * reality-tunnel/catalog — the declared reality tunnel, read from canon and resolved against one checkout and one
 * set of homes. The instances stand in lar:///ha.ka.ba/lares/cli/reality-tunnel (its `toml reality-tunnel` fence);
 * the kinds they name stand in ./kinds.ts. Home items aim every script and link at the MAIN clone,
 * never at a worktree a command happens to run from, so a lane's removal strands no hook.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { External, Item, Radius } from "./engine.js";
import {
  claudeHook, claudeStatusLine, claudeStatusLineTaking, copilotHook, headLine, jsonFloor, jsonForeign, jsonHooksOwned, jsonIncludes, jsonIncludesTaking, jsonListForeign, jsonSet, owned, seedless, statusLineForeign, strays,
  tomlHook, tomlHookForeign, tomlHooksOwned, tomlMcpServer, tomlShapeForeign, tomlTableForeign, tomlTableKey, tomlTableUnset, tomlTopFloor,
} from "./kinds.js";
import { homesOf, type Homes } from "./homes.js";
import { resolveLaresMcp, seatAbsentCause, type LaresMcpCommand } from "../mcp-resolve.js";

export const CARRIER = "bags/lares/ha.ka.ba/lares/cli/reality-tunnel.mem";
export const RULE_MARKER = "<!-- written by lares";
export const SCOUT_MARKER = "# projected by";

type Spec = Record<string, unknown> & { id: string; host: string; kind: string; file: string; what: string };
/**
 * `home` rows name what every operator home holds. `hooks` names the house's hooks folder: every script a home row
 * names stands under it, and a `*-hooks-owned` row keeps its hook file free of any script there that no row declares.
 */
export interface Declared { readonly seed: string; readonly hooks: string; readonly repo: Spec[]; readonly home: Spec[] }

/** Reads one repo-relative file, or null when it stands absent: the working tree, or the index for `--staged`. */
export type TextOf = (rel: string) => string | null;
const treeText = (repo: string): TextOf => (rel) => (existsSync(join(repo, rel)) ? readFileSync(join(repo, rel), "utf8") : null);

/** The carrier's `toml reality-tunnel` fence, parsed whole. */
export function declared(repo: string, textOf: TextOf = treeText(repo)): Declared {
  const text = textOf(CARRIER);
  if (text === null) throw new Error(`${CARRIER} stands absent`);
  const m = /^```toml reality-tunnel\n([\s\S]*?)^```/m.exec(text);
  if (!m) throw new Error(`${CARRIER} carries no \`toml reality-tunnel\` fence`);
  const d = parseToml(m[1]!) as { seed?: string; hooks?: string; repo?: Spec[]; home?: Spec[] };
  if (typeof d.seed !== "string") throw new Error(`${CARRIER}: the tunnel names no seed`);
  if (typeof d.hooks !== "string" || d.hooks === "") throw new Error(`${CARRIER}: the tunnel names no hooks folder`);
  const home = d.home ?? [];
  const outside = home.find((s) => typeof s["script"] === "string" && !s["script"].startsWith(`${d.hooks}/`));
  if (outside) throw new Error(`${CARRIER}: home item ${outside.id} names a script outside the house's hooks folder ${d.hooks}`);
  return { seed: d.seed, hooks: d.hooks, repo: d.repo ?? [], home };
}

/** The main clone a tree belongs to: the parent of git's common dir, or the tree itself. */
export function mainCloneOf(root: string): string {
  try {
    // A leaked git env (a hook's GIT_DIR and its kin) would answer for another repository; the tree handed in decides.
    const env = { ...process.env };
    for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
    const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], env,
    }).trim();
    return realpathSync(dirname(common));
  } catch {
    return realpathSync(root);
  }
}

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const str = (s: Spec, k: string): string => String(s[k] ?? "");

/** A scout's agent file: frontmatter that restores read-only tools, the seed's bytes, the mask. */
export function projectScout(seedPath: string, seed: string, s: Spec): string {
  return [
    "---",
    `name: ${str(s, "name")}`,
    `description: ${JSON.stringify(str(s, "description"))}`,
    "disallowedTools: Agent, Edit, Write, NotebookEdit, ExitPlanMode, Artifact, ArtifactComments, ArtifactData",
    `model: ${str(s, "model")}`,
    `${SCOUT_MARKER} lares repo tend from ${seedPath} (sha256 ${sha(seed)}); the seed is the source`,
    "---",
    seed.endsWith("\n") ? seed : `${seed}\n`,
    `!! ${str(s, "name")} ~ the scout's mask`,
    "",
    str(s, "mask"),
    "",
  ].join("\n");
}

/**
 * A `json-includes` row, for either radius: `key` names the list by a dotted path (`permissions.allow`), and `values` names
 * every member it keeps. One row per list keeps the whole set; the operator's other members stand.
 */
function includes(s: Spec): Pick<Item, "transform" | "taking" | "foreign"> {
  const values = s["values"];
  if (!Array.isArray(values) || values.length === 0 || !values.every((v) => typeof v === "string" && v !== "")) {
    throw new Error(`${CARRIER}: item ${s.id} names no \`values\` list of strings`);
  }
  const path = str(s, "key").split(".");
  if (path.some((k) => k === "")) throw new Error(`${CARRIER}: item ${s.id} names a key path with an empty segment`);
  return { transform: jsonIncludes(path, values as string[]), taking: jsonIncludesTaking(path, values as string[]), foreign: jsonListForeign(path) };
}

/**
 * The tasked-spirit's agent file: the stance alone, no seed copy. A general-purpose spirit reads CLAUDE.md, whose
 * import seats the seed; only the scouts wake bare, and they carry the seed above. The tools stay whole (alpha trusts the spirit).
 */
export function projectStance(seedPath: string, s: Spec): string {
  return [
    "---",
    `name: ${str(s, "name")}`,
    `description: ${JSON.stringify(str(s, "description"))}`,
    `model: ${str(s, "model")}`,
    `${SCOUT_MARKER} lares repo tend from ${seedPath} (stance only; the seed seats through CLAUDE.md); the seed is the source`,
    "---",
    str(s, "stance"),
    "",
  ].join("\n");
}

const item = (radius: Radius, s: Spec, path: string, rest: Partial<Item>): Item =>
  ({ id: s.id, radius, host: s.host, path, what: s.what, ...rest });

/** git with the tree handed in deciding: a leaked hook env (GIT_DIR and its kin) would answer for another repository. */
function gitIn(root: string, args: readonly string[]): { status: number | null; out: string } {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE"]) delete env[k];
  // LIVENESS: git config answers at once or not at all.
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8", env, timeout: 10_000 });
  return { status: r.error ? null : r.status, out: String(r.stdout ?? "").replace(/\n$/, "") };
}

/** The clone's shared git dir (every worktree of the clone reads its `config`), or null outside any repository. */
function gitCommonDir(root: string): string | null {
  const r = gitIn(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return r.status === 0 && r.out ? r.out : null;
}

/**
 * One key in the clone's shared git config, changed through git's own `git config --local`. In a worktree `--local`
 * writes the common config, so one tend seats every worktree of the clone.
 */
function gitConfig(root: string, key: string, value: string): External {
  const get = (): string | null => {
    const r = gitIn(root, ["config", "--local", "--get", key]);
    return r.status === 0 ? r.out : null;
  };
  const put = (v: string | null): { ok: boolean; detail: string } => {
    if (v === null && get() === null) return { ok: true, detail: "" };
    const r = gitIn(root, v === null ? ["config", "--local", "--unset-all", key] : ["config", "--local", "--replace-all", key, v]);
    return r.status === 0 ? { ok: true, detail: "" } : { ok: false, detail: `git config ${key} did not take` };
  };
  return {
    observe: () => {
      const cur = get();
      if (cur === value) return { aligned: true, detail: `${key} = ${value}` };
      return { aligned: false, detail: cur === null ? `${key} unset; tend sets it to ${value}` : `${key} reads ${cur}; tend sets it to ${value}` };
    },
    apply: () => put(value),
    snapshot: () => JSON.stringify(get()),
    restore: (snap) => put(JSON.parse(snap) as string | null),
  };
}

/**
 * The checkout's items. `staged` reads what a commit carries: a git config rides in no commit, so its items read
 * absent there and the commit gate never waits on a clone's own config.
 */
export function repoItems(repo: string, d: Declared = declared(repo), textOf: TextOf = treeText(repo), opts: { staged?: boolean } = {}): Item[] {
  const seedAbs = join(repo, d.seed);
  const common = d.repo.some((s) => s.kind === "git-config") && !opts.staged ? gitCommonDir(repo) : null;
  return d.repo.map((s) => {
    const path = join(repo, s.file);
    switch (s.kind) {
      case "git-config": {
        if (opts.staged) return item("repo", s, path, { absent: "a commit carries no git config; the clone's own tend seats it" });
        if (common === null) return item("repo", s, path, { absent: `${repo} stands outside any git repository` });
        return item("repo", s, join(common, "config"), { external: gitConfig(repo, str(s, "key"), str(s, "value")) });
      }
      case "seed-link": return item("repo", s, path, { link: relative(dirname(path), seedAbs) });
      case "head-import": return item("repo", s, path, { transform: headLine(str(s, "line"), str(s, "render")) });
      case "seedless": return item("repo", s, path, { transform: seedless(s["render"] as string | undefined, s["line"] as string | undefined) });
      case "toml-top-floor": return item("repo", s, path, { transform: tomlTopFloor(str(s, "key"), Number(s["floor"])), foreign: tomlShapeForeign(str(s, "key"), "number") });
      case "json-includes": return item("repo", s, path, includes(s));
      case "scout": {
        const seed = textOf(d.seed) ?? "";
        const o = owned(projectScout(d.seed, seed, s), SCOUT_MARKER);
        return item("repo", s, path, { ...o, ...(seed ? {} : { unreachable: `${d.seed} absent; the scout would carry nothing` }) });
      }
      case "stance": return item("repo", s, path, owned(projectStance(d.seed, s), SCOUT_MARKER));
      default: throw new Error(`${CARRIER}: repo item ${s.id} names an unknown kind ${s.kind}`);
    }
  });
}

/** Claude's lares seat, changed through the `claude` CLI and read from the store it writes. */
function claudeMcp(home: string, mcp: LaresMcpCommand): External {
  const store = join(home, ".claude.json");
  type Seat = { command?: string; args?: string[]; env?: Record<string, string>; [k: string]: unknown };
  const seat = (): Seat | undefined => {
    try { return ((JSON.parse(readFileSync(store, "utf8")) as { mcpServers?: Record<string, Seat> }).mcpServers ?? {})["lares"]; }
    catch { return undefined; }
  };
  const aligned = (): boolean => {
    const s = seat();
    // The env counts as much as the argv: a seat with the right command and no `LAR_ROOT` binds another vessel.
    return s !== undefined && s.command === mcp.command && JSON.stringify(s.args ?? []) === JSON.stringify(mcp.args)
      && JSON.stringify(sorted(s.env ?? {})) === JSON.stringify(sorted(mcp.env));
  };
  const run = (args: string[]): { ok: boolean; detail: string } => {
    // LIVENESS: the external Claude CLI may hang without returning.
    const r = spawnSync("claude", args, { encoding: "utf8", timeout: 15_000 });
    return r.status === 0 ? { ok: true, detail: "" } : { ok: false, detail: String(r.stderr ?? r.error ?? "").trim().slice(0, 120) };
  };
  // Every seat shape (stdio, SSE, HTTP, WebSocket) rides `claude mcp add-json`, so a restore puts back
  // exactly the seat it took away, whatever its shape.
  const put = (s: Seat | null): { ok: boolean; detail: string } => {
    if (seat()) {
      const rm = run(["mcp", "remove", "-s", "user", "lares"]);
      if (!rm.ok) return rm;
    }
    if (s === null) return { ok: true, detail: "" };
    return run(["mcp", "add-json", "--scope", "user", "lares", JSON.stringify(s)]);
  };
  const snapshot = (): string => JSON.stringify(seat() ?? null);
  return {
    observe: () => aligned()
      ? { aligned: true, detail: `aimed at ${mcp.args[0] ?? "lares_mcp.py"}` }
      : { aligned: false, detail: seat() ? "drifted from the resolved seat; tend re-aims it" : "absent; tend registers it" },
    snapshot,
    restore: (snap) => put(JSON.parse(snap) as Seat | null),
    apply: () => {
      if (!claudeCli()) return { ok: false, detail: "the `claude` CLI does not answer; the seat writes through it" };
      const before = snapshot();
      const r = put({ type: "stdio", command: mcp.command, args: mcp.args, env: mcp.env });
      if (r.ok) return { ok: true, detail: "registered" };
      // A failed re-aim puts the prior seat back rather than leaving the harness with none, and says
      // when even that fails.
      const back = put(JSON.parse(before) as Seat | null);
      return { ok: false, detail: back.ok ? r.detail : `${r.detail}; the prior seat's restore failed too: ${back.detail}` };
    },
  };
}

/** An env map in key order, so two maps compare by content alone. */
const sorted = (env: Record<string, string>): Array<[string, string]> => Object.entries(env).sort(([a], [b]) => a.localeCompare(b));

const hostDir: Record<string, string> = { claude: ".claude", codex: ".codex", copilot: ".copilot" };
// LIVENESS: the external Claude version probe may hang without returning.
const claudeCli = (): boolean => spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 10_000 }).error === undefined;

export interface HomeContext {
  readonly repo: string;
  readonly homes: Homes;
  /** The resolved lares MCP spawn, or null when its pieces stand absent. */
  readonly mcp?: LaresMcpCommand | null;
  /** False keeps Claude's seat to a read of its store (tests, and reads that must stay offline). */
  readonly claudeCli?: boolean;
  /** The familiar's pet name a tend seats in the familiar's hooks (`lares home tend --familiar <pet>`); absent keeps the seated one. */
  readonly familiar?: string | null;
}

/** Every operator home's items. A host whose home directory stands absent reads absent. */
export function homeItems(ctx: HomeContext, d: Declared = declared(ctx.repo)): Item[] {
  const clone = mainCloneOf(ctx.repo);
  const mcp = ctx.mcp === undefined ? resolveLaresMcp(clone) : ctx.mcp;
  const out: Item[] = [];
  for (const s of d.home) {
    const homes = s["homes"] === "all" ? homesOf(ctx.homes) : homesOf(ctx.homes).slice(0, 1);
    for (const h of homes) {
      const id = h.name === "home" ? s.id : `${s.id}@${h.name}`;
      const roots = Array.isArray(s["roots"]) ? (s["roots"] as string[]) : [""];
      for (const root of roots) {
        const path = join(h.dir, root, s.file);
        const base = { ...s, id: roots.length > 1 ? `${id}:${root}` : id };
        const dir = hostDir[s.host];
        const absent = root
          ? (existsSync(join(h.dir, root)) ? null : `${join(h.dir, root)} absent; this variant stands unset here`)
          : dir && !existsSync(join(h.dir, dir)) ? `${join(h.dir, dir)} absent; ${s.host} stands unset in this home` : null;
        const script = join(clone, str(s, "script")).replace(/\\/g, "/");
        const tool = join(clone, str(s, "script") || str(s, "tool")).replace(/\\/g, "/");
        const needsScript = (s["script"] !== undefined || s["tool"] !== undefined) && !existsSync(tool) ? `${tool} absent in the main clone` : null;
        const needsMcp = /mcp/.test(s.kind) && mcp === null ? seatAbsentCause() : null;
        const common = { absent, unreachable: needsScript ?? needsMcp };
        out.push(homeItem(base, path, h.dir, clone, d, script, mcp, common, ctx));
      }
    }
  }
  return out;
}

/** A pet name a familiar's hook carries. */
const PET_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The familiar a home's hooks carry: the tend's `--familiar`, else the pet name a house hook under the hooks folder already
 * carries in this hook file (a tend that names none keeps the one seated), else none.
 */
function familiarFor(ctx: HomeContext, path: string, folder: string): string | null {
  if (typeof ctx.familiar === "string" && ctx.familiar !== "") return ctx.familiar;
  let held: unknown;
  try { held = JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
  const events = (held as { hooks?: unknown } | null)?.hooks;
  if (events === null || typeof events !== "object") return null;
  for (const groups of Object.values(events as Record<string, unknown>)) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const c of Array.isArray((g as { hooks?: unknown }).hooks) ? (g as { hooks: unknown[] }).hooks : []) {
        const args = (c as { args?: unknown }).args;
        if (Array.isArray(args) && typeof args[0] === "string" && args[0].includes(`${folder}/`) && typeof args[1] === "string" && PET_NAME.test(args[1])) return args[1];
      }
    }
  }
  return null;
}

/** The scripts under the house's hooks folder that a value names and no home row declares for this row's host and file. */
const straysOf = (s: Spec, d: Declared) =>
  strays(d.hooks, d.home.filter((h) => h.host === s.host && h.file === s.file && typeof h["script"] === "string").map((h) => String(h["script"]).split("/").at(-1)!));

function homeItem(
  s: Spec, path: string, home: string, clone: string, d: Declared, script: string, mcp: LaresMcpCommand | null,
  common: Partial<Item>, ctx: HomeContext,
): Item {
  const base = (rest: Partial<Item>): Item => item("home", s, path, { ...common, ...rest });
  const timeout = Number(s["timeout"] ?? 60);
  switch (s.kind) {
    case "json-floor": return base({ transform: jsonFloor(str(s, "key"), Number(s["floor"])), foreign: jsonForeign });
    case "json-set": return base({ transform: jsonSet([str(s, "key")], s["value"]), foreign: jsonForeign });
    case "json-includes": return base(includes(s));
    case "claude-statusline": {
      // The tool aims at the main clone; its log stands in the home that holds the line (`log` reads relative to it).
      const tool = join(clone, str(s, "tool")).replace(/\\/g, "/");
      // Claude runs the command through a shell: every path rides double-quoted, with the four characters the shell reads escaped.
      const quote = (p: string): string => `"${p.replace(/[\\"$`]/g, "\\$&")}"`;
      const command = `node ${quote(tool)} ${quote(join(home, str(s, "log")))}`;
      return base({ transform: claudeStatusLine(str(s, "tool"), command), taking: claudeStatusLineTaking(command), foreign: statusLineForeign(str(s, "tool")) });
    }
    case "claude-hook": {
      // A familiar's hook carries the pet name as its argument (no env var): the tend's `--familiar`, else the one a tend seated.
      const wants = s["familiar"] === "required" || s["familiar"] === "optional";
      const pet = wants ? familiarFor(ctx, path, d.hooks) : null;
      if (pet !== null && !PET_NAME.test(pet)) return base({ unreachable: `the familiar "${pet}" reads as no pet name (lower-case letters, digits and hyphens); run \`lares home tend --familiar <pet-name> --yes\`` });
      if (s["familiar"] === "required" && pet === null) return base({ absent: "no familiar named in this home; `lares home tend --familiar <pet-name> --yes` seats its hooks" });
      const tail = pet === null ? [] : [pet];
      // `async` lets an event run on without waiting (the hook bounds itself); `status` names the wait the harness shows.
      const extra = { ...(s["async"] === true ? { async: true } : {}), ...(typeof s["status"] === "string" ? { statusMessage: s["status"] } : {}) };
      const command = str(s, "runner") === "node"
        ? { type: "command", command: "node", args: [script, ...tail], timeout, ...extra }
        : { type: "command", command: [`bash "${script}"`, ...tail.map((t) => `"${t}"`)].join(" "), timeout, ...extra };
      const placing = { ...(typeof s["matcher"] === "string" ? { matcher: s["matcher"] } : {}), ...(s["first"] === true ? { first: true } : {}) };
      return base({ transform: claudeHook(str(s, "event"), script.slice(script.lastIndexOf("/") + 1), command, placing), foreign: jsonForeign });
    }
    case "copilot-hook":
      return base({ transform: copilotHook(str(s, "event"), script.slice(script.lastIndexOf("/") + 1), { type: "command", bash: script, timeoutSec: timeout }), foreign: jsonForeign });
    case "claude-mcp":
      return base(mcp && ctx.claudeCli !== false ? { external: claudeMcp(home, mcp) } : {});
    case "json-mcp": {
      const shape = str(s, "shape");
      const seat = mcp && (shape === "copilot"
        ? { type: "local", command: mcp.command, args: mcp.args, env: mcp.env, tools: ["*"] }
        : { type: "stdio", command: mcp.command, args: mcp.args, env: mcp.env });
      return base(seat ? { transform: jsonSet(s["path"] as string[], seat), foreign: jsonForeign } : {});
    }
    case "toml-mcp": return base(mcp ? { transform: tomlMcpServer("lares", mcp), foreign: tomlShapeForeign("mcp_servers", "table") } : {});
    case "toml-hook": {
      const name = script.slice(script.lastIndexOf("/") + 1);
      const shared = tomlHookForeign(str(s, "event"), name);
      return base({ transform: tomlHook(str(s, "event"), name, script, timeout), foreign: (cur) => tomlShapeForeign("hooks", "table")(cur) ?? shared(cur) });
    }
    case "json-hooks-owned": return base({ ...jsonHooksOwned(straysOf(s, d)), foreign: jsonForeign });
    case "toml-hooks-owned": return base(tomlHooksOwned(straysOf(s, d)));
    case "toml-table-key": return base({ transform: tomlTableKey(str(s, "table"), str(s, "key"), s["value"] as string), foreign: tomlTableForeign(str(s, "table")) });
    case "toml-table-unset": return base({ transform: tomlTableUnset(str(s, "table"), str(s, "key")), foreign: tomlTableForeign(str(s, "table")) });
    case "seedless": return base({ transform: seedless(undefined, s["line"] as string | undefined) });
    case "seed-rule": {
      const link = join(clone, ".claude", "noosphere-boot");
      return base({
        ...owned(`${RULE_MARKER} home tend; the seed is the source -->\n@${link}\n`, RULE_MARKER),
        ...(existsSync(link) ? {} : { unreachable: `${link} absent; the main clone carries no seed link yet` }),
      });
    }
    case "bin-link": {
      const target = join(clone, str(s, "target"));
      return base(process.platform === "win32"
        ? { absent: "native Windows reaches `lares` through its own shims; this item links a POSIX path" }
        : { link: target, ...(existsSync(target) ? {} : { unreachable: `${target} absent in the main clone` }) });
    }
    default: throw new Error(`${CARRIER}: home item ${s.id} names an unknown kind ${s.kind}`);
  }
}

export const seedOf = (repo: string): string => declared(repo).seed;
