/**
 * reality-tunnel/engine — an operator's machine converges on declared reality tunnel, one radius per invocation.
 *
 * Law: lar:///ha.ka.ba/lares/cli/reality-tunnel. An ITEM declares what one target holds; the target's
 * desired bytes follow from its current bytes alone, every item on one file composing in
 * order. `read` answers two diffs per item, live against the tunnel (what `tend` would do) and live
 * against the bytes the house last wrote (someone touched it). `tend` writes only on difference,
 * refuses bytes it does not own unless forced, and records a GENERATION: each target's prior bytes
 * and the hash of what it wrote. `undo` restores a generation's prior bytes and records that too.
 *
 * Exit contract, every door: 0 aligned · 1 drift · 2 usage · 3 foreign bytes refused · 4 a host
 * the item needs stands unreachable.
 */
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, symlinkSync, unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type Radius = "repo" | "home";

/** What one item declares about one target. */
export interface Item {
  /** Stable name: `<host>.<what>`; a home's path rides `path`, never the id. */
  readonly id: string;
  readonly radius: Radius;
  readonly host: string;
  readonly path: string;
  /** One line a person reads: what this item keeps true. */
  readonly what: string;
  /** A file item: the desired bytes given the current ones (null = absent on both sides). */
  readonly transform?: (current: string | null) => string | null;
  /** A link item: the target the link names. */
  readonly link?: string;
  /** Why the current bytes stand outside this item's ownership, or null when they are its to change. */
  readonly foreign?: (current: string | null) => string | null;
  /** A host-owned store the house changes through the host's own tool, never by hand. */
  readonly external?: External;
  /** The host stands absent on this machine: nothing to keep, and the exit stays untouched. */
  readonly absent?: string | null;
  /** The host stands but a piece the item needs does not: the item cannot act, and the exit reads 4. */
  readonly unreachable?: string | null;
}

export interface External {
  observe(): { aligned: boolean; detail: string };
  apply(): { ok: boolean; detail: string };
  /** The host store's state before a change, as the ledger keeps it. */
  snapshot(): string;
  /** Put a snapshot back; `undo` calls it. */
  restore(snapshot: string): { ok: boolean; detail: string };
}

export type State = "aligned" | "drift" | "foreign" | "unreachable" | "absent";

export interface Row {
  readonly id: string;
  readonly host: string;
  readonly path: string;
  readonly what: string;
  readonly state: State;
  /** The live bytes differ from what the house last wrote here. */
  readonly touched: boolean;
  readonly detail: string;
}

/** A target's live form: file bytes, a link's target, or absent. */
type Live = { kind: "absent" } | { kind: "file"; bytes: string; mode?: number } | { kind: "link"; target: string };

export interface Reader {
  live(path: string): Live;
}

export const diskReader: Reader = {
  live(path) {
    let st;
    try { st = lstatSync(path); } catch { return { kind: "absent" }; }
    if (st.isSymbolicLink()) return { kind: "link", target: readlinkSync(path) };
    return { kind: "file", bytes: readFileSync(path, "utf8"), mode: st.mode & 0o7777 };
  },
};

export const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const liveHash = (l: Live): string | null =>
  l.kind === "absent" ? null : l.kind === "file" ? sha(l.bytes) : sha(`link:${l.target}`);

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  readonly path: string;
  /** An external item's id, and its host store's snapshot before the change. */
  readonly external?: string;
  readonly snapshot?: string;
  /** The bytes before the write, a link's prior target, or absent. */
  readonly prior: Live;
  /** The hash of what the write left (null = the write left the target absent). */
  readonly wrote: string | null;
}

export interface Generation {
  readonly gen: number;
  readonly act: "tend" | "undo";
  readonly undoes?: number;
  readonly entries: readonly LedgerEntry[];
}

/** Generations under one directory, numbered by a counter: a wall clock decides nothing here. */
export class Ledger {
  constructor(readonly dir: string) {}

  generations(): Generation[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => /^\d+\.json$/.test(f))
      .map((f) => JSON.parse(readFileSync(join(this.dir, f), "utf8")) as Generation)
      .sort((a, b) => a.gen - b.gen);
  }

  /** The hash the house last wrote at `path`, or undefined when it never wrote there. */
  lastWrote(path: string): string | null | undefined {
    const gens = this.generations();
    for (let i = gens.length - 1; i >= 0; i--) {
      const e = gens[i]!.entries.find((x) => x.path === path);
      if (e) return e.wrote;
    }
    return undefined;
  }

  record(act: Generation["act"], entries: readonly LedgerEntry[], undoes?: number): Generation {
    mkdirSync(this.dir, { recursive: true });
    const gens = this.generations();
    const gen = (gens.at(-1)?.gen ?? 0) + 1;
    const g: Generation = undoes === undefined ? { gen, act, entries } : { gen, act, undoes, entries };
    const file = join(this.dir, `${gen}.json`);
    writeFileSync(`${file}.tmp`, `${JSON.stringify(g, null, 2)}\n`, "utf8");
    renameSync(`${file}.tmp`, file);
    return g;
  }
}

// ── Read ────────────────────────────────────────────────────────────────────────────────────────

function desiredOf(items: readonly Item[], live: Live, take = false): string | null {
  let cur: string | null = live.kind === "file" && !take ? live.bytes : null;
  for (const it of items) if (it.transform) cur = it.transform(cur);
  return cur;
}

/** Group items by target path, keeping declaration order. */
function byPath(items: readonly Item[]): Map<string, Item[]> {
  const m = new Map<string, Item[]>();
  for (const it of items) (m.get(it.path) ?? m.set(it.path, []).get(it.path)!).push(it);
  return m;
}

export function read(items: readonly Item[], ledger: Ledger, reader: Reader = diskReader): Row[] {
  const rows: Row[] = [];
  for (const [path, group] of byPath(items)) {
    const live = reader.live(path);
    const touchedAt = (() => {
      const last = ledger.lastWrote(path);
      return last !== undefined && last !== liveHash(live);
    })();
    for (const it of group) rows.push(rowOf(it, live, touchedAt));
  }
  return rows;
}

function rowOf(it: Item, live: Live, touched: boolean): Row {
  const base = { id: it.id, host: it.host, path: it.path, what: it.what, touched };
  if (it.absent) return { ...base, state: "absent", detail: it.absent };
  if (it.unreachable) return { ...base, state: "unreachable", detail: it.unreachable };
  if (it.external) {
    const o = it.external.observe();
    return { ...base, state: o.aligned ? "aligned" : "drift", detail: o.detail };
  }
  if (it.link !== undefined) {
    if (live.kind === "link") {
      return live.target === it.link
        ? { ...base, state: "aligned", detail: `-> ${it.link}` }
        : { ...base, state: "drift", detail: `links to ${live.target}; the tunnel names ${it.link}` };
    }
    if (live.kind === "file") return { ...base, state: "foreign", detail: "a regular file stands where the link belongs (a checkout without symlinks writes this shape)" };
    return { ...base, state: "drift", detail: `absent; the tunnel links it to ${it.link}` };
  }
  const cur = live.kind === "file" ? live.bytes : null;
  if (live.kind === "link") return { ...base, state: "foreign", detail: `a link to ${live.target} stands where a file belongs` };
  const why = it.foreign?.(cur) ?? null;
  if (why) return { ...base, state: "foreign", detail: why };
  const want = it.transform ? it.transform(cur) : cur;
  if (want === cur) return { ...base, state: "aligned", detail: cur === null ? "absent, as intended" : "holds" };
  return { ...base, state: "drift", detail: cur === null ? "absent; tend writes it" : want === null ? "present; tend lifts it" : "differs; tend rewrites it" };
}

/** Write `bytes` at `path` through a temp beside it, keeping the target's mode (0644 for a new file). */
function writeKeepingMode(path: string, bytes: string, mode: number | undefined): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.lares-tmp-${process.pid}`;
  writeFileSync(tmp, bytes, { encoding: "utf8", mode: 0o600 });
  chmodSync(tmp, mode ?? 0o644);
  renameSync(tmp, path);
}

// ── Tend ────────────────────────────────────────────────────────────────────────────────────────

export interface TendResult {
  readonly rows: Row[];
  readonly wrote: string[];
  readonly refused: Row[];
  /** External items whose host refused or failed the change: the exit reads 4. */
  readonly failed: Array<{ id: string; detail: string }>;
  readonly generation: Generation | null;
}

/** Locks a target's write when its host shares the file with live writers. */
export type Locker = (path: string) => Promise<{ release(): Promise<void> }>;

export async function tend(
  items: readonly Item[], ledger: Ledger,
  opts: { force?: boolean; lock?: Locker; radiusLock?: Locker; reader?: Reader } = {},
): Promise<TendResult> {
  const reader = opts.reader ?? diskReader;
  const entries: LedgerEntry[] = [];
  const wrote: string[] = [];
  const failed: Array<{ id: string; detail: string }> = [];
  const refusedPaths = new Set<string>();
  let generation: Generation | null = null;
  // ONE TEND PER RADIUS AT A TIME: two tends read, write and number their generations in turn.
  const radius = opts.radiusLock ? await opts.radiusLock(ledger.dir) : null;

  try {
    for (const [path, group] of byPath(items)) {
      const acting = group.filter((it) => !it.unreachable && !it.absent);
      if (acting.length === 0) continue;
      for (const it of acting.filter((x) => x.external)) {
        if (it.external!.observe().aligned) continue;
        const snapshot = it.external!.snapshot();
        const r = it.external!.apply();
        if (r.ok) {
          entries.push({ path, external: it.id, snapshot, prior: { kind: "absent" }, wrote: sha(it.external!.snapshot()) });
          wrote.push(`${path} (${it.id})`);
        } else failed.push({ id: it.id, detail: r.detail });
      }
      const fileItems = acting.filter((x) => !x.external);
      if (fileItems.length === 0) continue;
      // THE LOCK COMES BEFORE THE READ: a writer that finished while this one waited keeps its bytes.
      const held = opts.lock ? await opts.lock(path) : null;
      try {
        const live = reader.live(path);
        const linkItem = fileItems.find((x) => x.link !== undefined);
        if (linkItem) {
          if (live.kind === "link" && live.target === linkItem.link) continue;
          if (live.kind === "file" && !opts.force) { refusedPaths.add(path); continue; }
          mkdirSync(dirname(path), { recursive: true });
          if (live.kind !== "absent") unlinkSync(path);
          symlinkSync(linkItem.link!, path);
          entries.push({ path, prior: live, wrote: sha(`link:${linkItem.link}`) });
          wrote.push(path);
          continue;
        }
        if (live.kind === "link") { refusedPaths.add(path); continue; }
        const cur = live.kind === "file" ? live.bytes : null;
        const foreign = fileItems.some((it) => it.foreign?.(cur));
        if (foreign && !opts.force) { refusedPaths.add(path); continue; }
        const want = desiredOf(fileItems, live, foreign);
        if (want === cur) continue;
        if (want === null) unlinkSync(path);
        else writeKeepingMode(path, want, live.kind === "file" ? live.mode : undefined);
        entries.push({ path, prior: live, wrote: want === null ? null : sha(want) });
        wrote.push(path);
      } finally {
        await held?.release();
      }
    }
  } finally {
    // A tend that throws midway still records what it wrote, so `undo` reaches every changed target.
    try { if (entries.length) generation = ledger.record("tend", entries); }
    finally { await radius?.release(); }
  }
  const rows = read(items, ledger, reader);
  return { rows, wrote, refused: rows.filter((r) => refusedPaths.has(r.path) && r.state === "foreign"), failed, generation };
}

// ── Undo ────────────────────────────────────────────────────────────────────────────────────────

export interface UndoResult {
  readonly generation: Generation | null;
  /** Targets a hand touched after the generation wrote them: undo leaves them as they stand. */
  readonly refused: string[];
}

/**
 * Restore the prior bytes a generation recorded, and record the restore as its own generation. A
 * target whose live bytes differ from what that generation wrote holds a hand's later edit, so undo
 * refuses it unless forced; an external item restores through its host's own tool.
 */
export function undo(
  ledger: Ledger, gen?: number, opts: { force?: boolean; externals?: ReadonlyMap<string, External> } = {},
): UndoResult {
  return undoUnder(ledger, gen, opts);
}

/** `undo` under the radius lock, so it never interleaves with a tend in the same radius. */
export async function undoLocked(
  ledger: Ledger, gen: number | undefined, opts: { force?: boolean; externals?: ReadonlyMap<string, External>; radiusLock?: Locker } = {},
): Promise<UndoResult> {
  const held = opts.radiusLock ? await opts.radiusLock(ledger.dir) : null;
  try { return undoUnder(ledger, gen, opts); } finally { await held?.release(); }
}

function undoUnder(
  ledger: Ledger, gen: number | undefined, opts: { force?: boolean; externals?: ReadonlyMap<string, External> },
): UndoResult {
  const gens = ledger.generations();
  const target = gen === undefined ? gens.filter((g) => g.act === "tend").at(-1) : gens.find((g) => g.gen === gen);
  if (!target) throw new Error(gen === undefined ? "no tend generation stands to undo" : `no generation ${gen} stands`);
  const entries: LedgerEntry[] = [];
  const refused: string[] = [];
  for (const e of target.entries) {
    if (e.external) {
      const ext = opts.externals?.get(e.external);
      if (!ext) { refused.push(e.path); continue; }
      const snapshot = ext.snapshot();
      if (e.wrote !== null && sha(snapshot) !== e.wrote && !opts.force) { refused.push(e.path); continue; }
      if (ext.restore(e.snapshot ?? "null").ok) entries.push({ path: e.path, external: e.external, snapshot, prior: { kind: "absent" }, wrote: sha(ext.snapshot()) });
      else refused.push(e.path);
      continue;
    }
    const live = diskReader.live(e.path);
    if (liveHash(live) !== e.wrote && !opts.force) { refused.push(e.path); continue; }
    if (live.kind !== "absent") unlinkSync(e.path);
    if (e.prior.kind === "file") writeKeepingMode(e.path, e.prior.bytes, e.prior.mode);
    else if (e.prior.kind === "link") {
      mkdirSync(dirname(e.path), { recursive: true });
      symlinkSync(e.prior.target, e.path);
    }
    entries.push({ path: e.path, prior: live, wrote: liveHash(e.prior) });
  }
  return { generation: entries.length ? ledger.record("undo", entries, target.gen) : null, refused };
}

// ── The exit contract ───────────────────────────────────────────────────────────────────────────

export const EXIT = { aligned: 0, drift: 1, usage: 2, foreign: 3, unreachable: 4 } as const;

export function exitOf(rows: readonly Row[]): number {
  if (rows.some((r) => r.state === "foreign")) return EXIT.foreign;
  if (rows.some((r) => r.state === "unreachable")) return EXIT.unreachable;
  if (rows.some((r) => r.state === "drift")) return EXIT.drift;
  return EXIT.aligned;
}
