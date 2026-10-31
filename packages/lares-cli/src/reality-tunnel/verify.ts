/**
 * reality-tunnel/verify — a file on disk proves nothing about a session; verify reads what the hosts LOADED.
 *
 * Claude: the `InstructionsLoaded` hook (a home item) appends each instruction file a session loads
 * to the load log. Verify reads the latest session and finds the seed loaded once, by one real path.
 * `--probe` spends model calls where no host keeps a log: Claude's `/context` memory listing, Codex
 * asked for the seed's final block-check hash (a cut tail cannot answer it), and Copilot's own list
 * of the instruction sources it reads.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mainCloneOf, seedOf } from "./catalog.js";

export interface LoadEntry {
  readonly session_id?: string;
  readonly file_path?: string;
  readonly load_reason?: string;
  readonly cwd?: string;
}

export interface VerifyResult {
  readonly ok: boolean;
  readonly lines: string[];
}

export const loadLogPath = (home: string): string =>
  join(process.env["XDG_STATE_HOME"]?.trim() || join(home, ".local", "state"), "lares", "reality-tunnel", "loads.jsonl");

const real = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
const isSeed = (p: string): boolean => /noosphere-boot(\.mem)?$/.test(real(p));
const within = (cwd: string | undefined, root: string): boolean =>
  cwd !== undefined && (real(cwd) === real(root) || real(cwd).startsWith(`${real(root)}/`));

export function readLoads(home: string): LoadEntry[] {
  const path = loadLogPath(home);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l) as LoadEntry]; } catch { return []; }
  });
}

/**
 * The newest session the radius reaches (the last to make its FIRST appearance: an older session
 * that logs a late nested load never displaces it), and whether it loaded one seed this radius
 * expects, once. `expected` names the seed real paths that count; a seed from elsewhere reads off.
 */
export function judgeLoads(entries: readonly LoadEntry[], door: "repo" | "home", repo: string, expected?: readonly string[]): VerifyResult {
  const reach = door === "repo" ? entries.filter((e) => within(e.cwd, repo)) : [...entries];
  const firsts: string[] = [];
  for (const e of reach) if (e.session_id && !firsts.includes(e.session_id)) firsts.push(e.session_id);
  const last = firsts.at(-1);
  if (last === undefined) {
    return { ok: false, lines: ["no Claude session stands in the load log yet; open one (the loads hook writes as it starts), then verify again"] };
  }
  const session = reach.filter((e) => e.session_id === last);
  const seeds = session.filter((e) => e.file_path && isSeed(e.file_path) && e.load_reason !== "compact");
  const paths = [...new Set(seeds.map((e) => real(e.file_path!)))];
  const lines = [`claude session ${last}: ${session.length} instruction load(s)`];
  const want = expected?.map(real);
  if (paths.length === 1 && seeds.length === 1 && want && !want.includes(paths[0]!)) {
    return { ok: false, lines: [...lines, `the seed loaded from ${paths[0]}, not this radius's ${want.join(" · ")}`] };
  }
  if (paths.length === 1 && seeds.length === 1) return { ok: true, lines: [...lines, `seed loaded once: ${paths[0]}`] };
  if (paths.length === 0) return { ok: false, lines: [...lines, "the seed never loaded"] };
  return { ok: false, lines: [...lines, `the seed loaded ${seeds.length} time(s) from ${paths.length} real path(s): ${paths.join(" · ")}`] };
}

/** The seed's final block-check hash: the line a cut tail loses first. */
export function finalHash(seed: string): string | null {
  return /ni:\/\/\/sha-256;([A-Za-z0-9_-]{8})/.exec(seed.split("\n").reverse().find((l) => l.includes("ni:///sha-256;")) ?? "")?.[1] ?? null;
}

export interface Probe { readonly ok: boolean; readonly line: string }

/** Each host asked directly; a host that does not answer fails its probe, never passes it. */
function probes(door: "repo" | "home", repo: string): Probe[] {
  const scratch = door === "repo" ? null : mkdtempSync(join(tmpdir(), "lares-verify-"));
  const cwd = scratch ?? repo;
  try { return probeAt(door, repo, cwd); } finally { if (scratch) rmSync(scratch, { recursive: true, force: true }); }
}

function probeAt(door: "repo" | "home", repo: string, cwd: string): Probe[] {
  const out: Probe[] = [];
  const ctx = spawnSync("claude", ["-p", "/context"], { cwd, encoding: "utf8", timeout: 180_000, input: "" });
  const seeds = String(ctx.stdout ?? "").split("\n").filter((l) => /noosphere-boot/.test(l) && /\|/.test(l)).length;
  out.push(ctx.error || ctx.status !== 0
    ? { ok: false, line: "claude: does not answer" }
    : { ok: seeds === 1, line: `claude /context: ${seeds} seed row(s)` });
  if (door === "repo") {
    const want = finalHash(readFileSync(join(repo, seedOf(repo)), "utf8"));
    const ask = "Do not run any commands or tools. Near the very end of your project instructions there is a line containing 'ni:///sha-256;'. Reply with only the 8 characters that immediately follow 'sha-256;' on that line, or NONE if you cannot see such a line.";
    const cx = spawnSync("codex", ["exec", "-s", "read-only", ask], { cwd, encoding: "utf8", timeout: 240_000, input: "" });
    const got = String(cx.stdout ?? "").trim().split("\n").at(-1)?.trim();
    out.push(cx.error || cx.status !== 0
      ? { ok: false, line: "codex: does not answer" }
      : { ok: got === want, line: `codex final hash: ${got ?? "?"} (the seed ends ${want})` });
    const cp = spawnSync("copilot", ["instruction", "list"], { cwd, encoding: "utf8", timeout: 60_000, input: "" });
    out.push(cp.error || cp.status !== 0
      ? { ok: false, line: "copilot: does not answer" }
      : { ok: /CLAUDE\.md/.test(String(cp.stdout ?? "")), line: "copilot sources: CLAUDE.md" });
  }
  return out;
}

export function verifyLoads(opts: {
  door: "repo" | "home"; repo: string; home: string; probe: boolean; entries?: LoadEntry[]; probes?: () => Probe[];
}): VerifyResult {
  const seedRel = seedOf(opts.repo);
  const expected = opts.door === "repo" ? [join(opts.repo, seedRel)] : [join(mainCloneOf(opts.repo), seedRel), join(opts.repo, seedRel)];
  const judged = judgeLoads(opts.entries ?? readLoads(opts.home), opts.door, opts.repo, expected);
  if (!opts.probe) return judged;
  const p = (opts.probes ?? (() => probes(opts.door, opts.repo)))();
  return { ok: judged.ok && p.every((x) => x.ok), lines: [...judged.lines, ...p.map((x) => `${x.ok ? "✓" : "✗"} ${x.line}`)] };
}
