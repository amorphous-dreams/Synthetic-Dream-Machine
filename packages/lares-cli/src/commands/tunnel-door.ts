/**
 * `lares repo` · `lares home` — one door per radius over one reality-tunnel engine.
 *
 * `repo` keeps the checkout it runs in; `home` keeps every operator home the device carries. Each
 * answers the same four verbs, so the two read alike: `read` (both diffs, writes nothing), `tend`
 * (converges; writes only on difference), `verify` (what the hosts report loading), `undo [gen]`
 * (restores a generation). The radius never widens: neither door writes the other's ground.
 *
 * Meme: lar:///ha.ka.ba/lares/cli/reality-tunnel
 */
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { repoRoot } from "@lararium/mesh/node";
import { ownPeerKind } from "@lararium/node";
import { EXIT, Ledger, exitOf, read, tend, undoLocked, type Item, type Reader, type Row, type TendResult } from "../reality-tunnel/engine.js";
import { homeLedgerDir, repoLedgerDir } from "../reality-tunnel/places.js";
import { declared, homeItems, repoItems } from "../reality-tunnel/catalog.js";
import { resolveHomes } from "../reality-tunnel/homes.js";
import { hostLocker, radiusLock } from "../reality-tunnel/lock.js";
import { verifyLoads, type VerifyResult } from "../reality-tunnel/verify.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

type Door = "repo" | "home";
export const TUNNEL_VERBS = ["read", "tend", "verify", "undo"] as const;

/** The index as a reader: what a commit carries, a link's target from its staged blob. */
export const indexReader = (repo: string): Reader => ({
  live(path) {
    const rel = path.startsWith(repo) ? path.slice(repo.length + 1) : path;
    const entry = execFileSync("git", ["-C", repo, "ls-files", "--stage", "--", rel], { encoding: "utf8" }).trim();
    if (!entry) return { kind: "absent" };
    const blob = execFileSync("git", ["-C", repo, "show", `:${rel}`], { encoding: "utf8" });
    return entry.startsWith("120000 ") ? { kind: "link", target: blob } : { kind: "file", bytes: blob };
  },
});

const GLYPH: Record<Row["state"], string> = { aligned: "✓", drift: "~", foreign: "✗", unreachable: "!", absent: "·" };

/**
 * THE WAKE'S ONE LINE. Off the tunnel counts what the reading names off: drift, a foreign value, an unreachable home. Two kinds
 * of row a hand changed since the house last wrote them (`touched`, a whole-file compare) read APART, each in its own clause,
 * never as drift and never dropped: one that still reads `aligned` holds what the tunnel asks (a harness rewrites its own
 * settings files at will), and one whose host now stands `absent` on this machine leaves the tunnel nothing to keep there, yet
 * the house once wrote it, so the line names it.
 */
export function briefLine(rows: readonly Row[], door: Door = "home"): string {
  const off = rows.filter((r) => r.state === "drift" || r.state === "foreign" || r.state === "unreachable");
  const ids = (some: readonly Row[]): string => some.map((r) => r.id).join(", ");
  const rewritten = rows.filter((r) => r.touched && r.state === "aligned");
  const gone = rows.filter((r) => r.touched && r.state === "absent");
  const apart = [
    ...(rewritten.length === 0 ? [] : [`${rewritten.length} aligned item(s) rewritten by another hand since the house wrote them: ${ids(rewritten)}`]),
    ...(gone.length === 0 ? [] : [`${gone.length} item(s) the house once wrote, changed since, on a host now absent here: ${ids(gone)}`]),
  ].join("; ");
  if (off.length === 0) return `reality tunnel: every item holds${apart ? ` (${apart})` : ""}`;
  // A house hook script no row declares needs no reading to cure: the line names the act that lifts it.
  const stray = off.filter((r) => r.lifts !== undefined && r.state === "drift").sort((a, b) => a.id.localeCompare(b.id));
  const lift = stray.length === 0 ? "" : `; ${stray.length} item(s) name a house hook script no row declares: ${ids(stray)} (lares home tend lifts each)`;
  return `reality tunnel: ${off.length} item(s) off the tunnel — ${ids(off)} (lares ${door} read)${apart ? `; ${apart}` : ""}${lift}`;
}

/** What a tend lifted, one line per target: the house hook scripts a row named before the tend and no row names after it. */
export function liftedLines(before: readonly Row[], after: readonly Row[]): string[] {
  const key = (r: Row): string => `${r.id}\n${r.path}`;
  const held = new Set(after.filter((r) => r.state === "aligned").map(key));
  return before.filter((r) => r.lifts !== undefined && held.has(key(r))).map((r) => `  lifted ${r.lifts!.join(", ")} from ${r.path} (${r.id})`);
}

/**
 * What a tend did to each host-owned store (a git config key, a harness's own seat), one line per item: `set` when this
 * tend changed it, `already set` when it held before the tend. A store a tend could not reach names itself apart.
 */
export function externalLines(items: readonly Item[], r: Pick<TendResult, "rows" | "set">): string[] {
  const ext = new Set(items.filter((i) => i.external).map((i) => i.id));
  return r.rows.filter((row) => ext.has(row.id) && row.state === "aligned")
    .map((row) => `  ${r.set.includes(row.id) ? "set" : "already set"} ${row.detail} (${row.id})`);
}

function show(rows: readonly Row[], brief: boolean, door: Door = "home"): void {
  if (brief) { console.log(briefLine(rows, door)); return; }
  for (const r of rows) {
    console.log(`  ${GLYPH[r.state]} ${r.state.padEnd(11)} ${r.id.padEnd(30)} ${r.detail}${r.touched ? " · touched since the house last wrote it" : ""}`);
    console.log(`    ${" ".repeat(11)} ${r.path}`);
  }
}

async function consent(writes: readonly Row[], args: ParsedArgs): Promise<boolean> {
  if (args.flags["yes"] === true) return true;
  if (!process.stdin.isTTY) {
    console.error("lares home tend: writes the operator's homes; pass --yes to proceed without a terminal");
    return false;
  }
  console.log("lares home tend will write:");
  for (const r of writes) console.log(`  ${r.path}  (${r.id})`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("proceed? [y/N] ")).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

/**
 * THE HOME UNDO'S CONSENT. An undo puts back the bytes a tend replaced in the operator's homes, a settings file that lacks the
 * doors' deny list among them, so it takes `tend`'s consent and one gate more: an AI seat refuses by name before any home or
 * ledger is read, a terminal asks, and no terminal needs `--yes`.
 */
async function undoConsent(args: ParsedArgs, seat: () => boolean): Promise<boolean> {
  if (seat()) {
    console.error("lares home undo: refused hand-act-only: an undo puts back the bytes a tend replaced in the operator's homes, a settings file that lacks the doors' deny list among them, so an AI seat never runs it");
    console.error("  the cure: the operator runs `lares home undo [gen]` at their own terminal");
    return false;
  }
  if (args.flags["yes"] === true) return true;
  if (!process.stdin.isTTY) {
    console.error("lares home undo: restores the operator's homes; pass --yes to proceed without a terminal");
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`lares home undo will restore ${args.positional[1] === undefined ? "the last generation" : `generation ${args.positional[1]}`} across the operator's homes; proceed? [y/N] `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

/** The index as text: what a commit carries, a file the index lacks reading as absent. */
export const indexText = (repo: string) => (rel: string): string | null => {
  try { return execFileSync("git", ["-C", repo, "show", `:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return null; }
};

export function itemsFor(door: Door, staged = false, persist = false, familiar: string | null = null): { items: Item[]; ledger: Ledger; root: string } {
  if (door === "repo") {
    // `--staged` reads the carrier and the seed the commit carries, never the working tree's.
    const items = staged ? repoItems(repoRoot, declared(repoRoot, indexText(repoRoot)), indexText(repoRoot), { staged: true }) : repoItems(repoRoot);
    return { items, ledger: new Ledger(repoLedgerDir(repoRoot)), root: repoRoot };
  }
  return { items: homeItems({ repo: repoRoot, homes: resolveHomes({ persist }), familiar }), ledger: new Ledger(homeLedgerDir()), root: homedir() };
}

/**
 * Whether an AI seat runs this command: a harness mark in its environment, a harness on its parent chain, or a chain that
 * cannot be read (an unread chain never reads as a person).
 */
const harnessSeat = (): boolean => ownPeerKind(process.env) !== "hand";

export async function cmdTunnelDoor(door: Door, args: ParsedArgs, seat: () => boolean = harnessSeat): Promise<number> {
  const verb = args.positional[0];
  if (args.flags["help"] === true || verb === undefined || !(TUNNEL_VERBS as readonly string[]).includes(verb)) {
    return refuseUsage(args, door, helpLines(door), args.flags["help"] === true ? undefined : verb === undefined ? "name a sub-verb" : `unknown sub-verb "${verb}"`);
  }
  if (args.flags["staged"] === true && !(door === "repo" && verb === "read")) {
    console.error(`lares ${door} ${verb}: --staged reads the index, and only \`lares repo read\` reads it`);
    return EXIT.usage;
  }
  // `--familiar <pet>` names the familiar whose hooks a home tend seats; absent, the one already seated stands.
  const familiar = typeof args.options["familiar"] === "string" && args.options["familiar"].trim() !== "" ? args.options["familiar"].trim() : null;
  if (familiar !== null && door !== "home") {
    console.error(`lares ${door} ${verb}: --familiar names a home's familiar; run \`lares home ${verb} --familiar ${familiar}\``);
    return EXIT.usage;
  }
  if (door === "home" && verb === "undo" && !(await undoConsent(args, seat))) return EXIT.usage;
  const { items, ledger } = itemsFor(door, args.flags["staged"] === true, verb === "tend" || verb === "undo", familiar);

  if (verb === "read") {
    const reader = args.flags["staged"] === true ? indexReader(repoRoot) : undefined;
    const rows = read(items, ledger, reader);
    const code = exitOf(rows);
    // `--brief` prints the one line a hook reads, terminal or none: the wake hook calls it with no TTY.
    if (args.flags["brief"] === true) { show(rows, true, door); return code; }
    emit(args, { ok: code === 0, data: { radius: door, rows, exit: code }, human: () => show(rows, false) });
    return code;
  }

  if (verb === "tend") {
    const before = read(items, ledger);
    const writes = before.filter((r) => r.state === "drift" || (r.state === "foreign" && args.flags["force"] === true));
    if (door === "home" && writes.length > 0 && !(await consent(writes, args))) return EXIT.usage;
    const r = await tend(items, ledger, { force: args.flags["force"] === true, lock: hostLocker, radiusLock });
    const code = r.refused.length > 0 ? EXIT.foreign : r.failed.length > 0 ? EXIT.unreachable : exitOf(r.rows);
    const lifted = liftedLines(before, r.rows);
    const stores = externalLines(items, r);
    emit(args, {
      ok: code === 0,
      data: { radius: door, wrote: r.wrote, set: r.set, stores: stores.map((x) => x.trim()), lifted: lifted.map((x) => x.trim()), refused: r.refused, generation: r.generation?.gen ?? null, rows: r.rows, exit: code },
      human: () => {
        console.log(r.wrote.length ? `tended ${r.wrote.length} target(s)${r.generation ? ` · generation ${r.generation.gen}` : ""}` : "every item already holds; nothing written");
        const setIds = new Set(r.set);
        for (const w of r.wrote) if (![...setIds].some((id) => w.endsWith(` (${id})`))) console.log(`  wrote ${w}`);
        for (const x of stores) console.log(x);
        for (const x of lifted) console.log(x);
        for (const f of r.refused) console.log(`  refused ${f.path}: ${f.detail} (--force takes it; the ledger keeps its bytes)`);
        for (const f of r.failed) console.log(`  unreachable ${f.id}: ${f.detail}`);
        const off = r.rows.filter((x) => x.state !== "aligned" && x.state !== "absent");
        if (off.length) show(off, false);
      },
    });
    return code;
  }

  if (verb === "undo") {
    const n = args.positional[1] === undefined ? undefined : Number(args.positional[1]);
    if (n !== undefined && !Number.isInteger(n)) { console.error(`lares ${door} undo: a generation is a whole number`); return EXIT.usage; }
    let r;
    const externals = new Map(items.filter((i) => i.external).map((i) => [i.id, i.external!] as const));
    try { r = await undoLocked(ledger, n, { force: args.flags["force"] === true, externals, radiusLock }); }
    catch (e) { console.error(`lares ${door} undo: ${(e as Error).message}`); return EXIT.usage; }
    const g = r.generation;
    emit(args, { ok: r.refused.length === 0, data: { radius: door, generation: g?.gen ?? null, undoes: g?.undoes ?? n ?? null, restored: g?.entries.map((e) => e.path) ?? [], refused: r.refused }, human: () => {
      if (g) console.log(`restored generation ${g.undoes} · recorded as generation ${g.gen}`);
      for (const e of g?.entries ?? []) console.log(`  restored ${e.path}`);
      for (const p of r.refused) console.log(`  refused ${p}: a hand changed it after that generation wrote it (--force restores it anyway)`);
    } });
    if (r.refused.length > 0) return EXIT.foreign;
    return EXIT.aligned;
  }

  const v: VerifyResult = verifyLoads({ door, repo: repoRoot, home: homedir(), probe: args.flags["probe"] === true });
  emit(args, { ok: v.ok, data: { radius: door, ...v }, human: () => {
    console.log(v.ok ? "verify: every host loads the seed once" : "verify: a host's loads read off the tunnel");
    for (const line of v.lines) console.log(`  ${line}`);
  } });
  return v.ok ? EXIT.aligned : EXIT.drift;
}

export const cmdRepo = (args: ParsedArgs): Promise<number> => cmdTunnelDoor("repo", args);
export const cmdHome = (args: ParsedArgs): Promise<number> => cmdTunnelDoor("home", args);
