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
import { EXIT, Ledger, exitOf, read, tend, undoLocked, type Item, type Reader, type Row } from "../reality-tunnel/engine.js";
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

function show(rows: readonly Row[], brief: boolean): void {
  if (brief) {
    const off = rows.filter((r) => r.state === "drift" || r.state === "foreign" || r.state === "unreachable" || r.touched);
    console.log(off.length === 0 ? "reality tunnel: every item holds" : `reality tunnel: ${off.length} item(s) off the tunnel — ${off.map((r) => r.id).join(", ")} (lares home read)`);
    return;
  }
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

/** The index as text: what a commit carries, a file the index lacks reading as absent. */
export const indexText = (repo: string) => (rel: string): string | null => {
  try { return execFileSync("git", ["-C", repo, "show", `:${rel}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return null; }
};

export function itemsFor(door: Door, staged = false, persist = false): { items: Item[]; ledger: Ledger; root: string } {
  if (door === "repo") {
    // `--staged` reads the carrier and the seed the commit carries, never the working tree's.
    const items = staged ? repoItems(repoRoot, declared(repoRoot, indexText(repoRoot)), indexText(repoRoot)) : repoItems(repoRoot);
    return { items, ledger: new Ledger(repoLedgerDir(repoRoot)), root: repoRoot };
  }
  return { items: homeItems({ repo: repoRoot, homes: resolveHomes({ persist }) }), ledger: new Ledger(homeLedgerDir()), root: homedir() };
}

export async function cmdTunnelDoor(door: Door, args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (args.flags["help"] === true || verb === undefined || !(TUNNEL_VERBS as readonly string[]).includes(verb)) {
    return refuseUsage(args, door, helpLines(door));
  }
  if (args.flags["staged"] === true && !(door === "repo" && verb === "read")) {
    console.error(`lares ${door} ${verb}: --staged reads the index, and only \`lares repo read\` reads it`);
    return EXIT.usage;
  }
  const { items, ledger } = itemsFor(door, args.flags["staged"] === true, verb === "tend" || verb === "undo");

  if (verb === "read") {
    const reader = args.flags["staged"] === true ? indexReader(repoRoot) : undefined;
    const rows = read(items, ledger, reader);
    const code = exitOf(rows);
    // `--brief` is the one line a hook reads, terminal or none: the wake hook calls it with no TTY.
    if (args.flags["brief"] === true) { show(rows, true); return code; }
    emit(args, { ok: code === 0, data: { radius: door, rows, exit: code }, human: () => show(rows, false) });
    return code;
  }

  if (verb === "tend") {
    const before = read(items, ledger);
    const writes = before.filter((r) => r.state === "drift" || (r.state === "foreign" && args.flags["force"] === true));
    if (door === "home" && writes.length > 0 && !(await consent(writes, args))) return EXIT.usage;
    const r = await tend(items, ledger, { force: args.flags["force"] === true, lock: hostLocker, radiusLock });
    const code = r.refused.length > 0 ? EXIT.foreign : r.failed.length > 0 ? EXIT.unreachable : exitOf(r.rows);
    emit(args, {
      ok: code === 0,
      data: { radius: door, wrote: r.wrote, refused: r.refused, generation: r.generation?.gen ?? null, rows: r.rows, exit: code },
      human: () => {
        console.log(r.wrote.length ? `tended ${r.wrote.length} target(s)${r.generation ? ` · generation ${r.generation.gen}` : ""}` : "every item already holds; nothing written");
        for (const w of r.wrote) console.log(`  wrote ${w}`);
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
