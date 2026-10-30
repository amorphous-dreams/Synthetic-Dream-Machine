/**
 * reality-tunnel/engine — an operator's machine converges on declared reality tunnel, one radius per invocation.
 *
 * Law: lar:///ha.ka.ba/lares/cli/reality-tunnel. An ITEM declares what one target holds; the target's
 * desired bytes are a pure function of its current bytes, every item on one file composing in
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
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, symlinkSync, unlinkSync,
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
type Live = { kind: "absent" } | { kind: "file"; bytes: string } | { kind: "link"; target: string };

export interface Reader {
  live(path: string): Live;
}

export const diskReader: Reader = {
  live(path) {
    let st;
    try { st = lstatSync(path); } catch { return { kind: "absent" }; }
    if (st.isSymbolicLink()) return { kind: "link", target: readlinkSync(path) };
    return { kind: "file", bytes: readFileSync(path, "utf8") };
  },
};

export const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const liveHash = (l: Live): string | null =>
  l.kind === "absent" ? null : l.kind === "file" ? sha(l.bytes) : sha(`link:${l.target}`);

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────

export interface LedgerEntry {
  readonly path: string;
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

function desiredOf(items: readonly Item[], live: Live): string | null {
  let cur: string | null = live.kind === "file" ? live.bytes : null;
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

// ── Tend ────────────────────────────────────────────────────────────────────────────────────────

export interface TendResult {
  readonly rows: Row[];
  readonly wrote: string[];
  readonly refused: Row[];
  readonly generation: Generation | null;
}

/** Locks a target's write when its host shares the file with live writers. */
export type Locker = (path: string) => Promise<{ release(): Promise<void> }>;

export async function tend(
  items: readonly Item[], ledger: Ledger, opts: { force?: boolean; lock?: Locker; reader?: Reader } = {},
): Promise<TendResult> {
  const reader = opts.reader ?? diskReader;
  const before = read(items, ledger, reader);
  const refused = before.filter((r) => r.state === "foreign" && !opts.force);
  const refusedPaths = new Set(refused.map((r) => r.path));
  const entries: LedgerEntry[] = [];
  const wrote: string[] = [];

  for (const [path, group] of byPath(items)) {
    if (refusedPaths.has(path)) continue;
    const acting = group.filter((it) => !it.unreachable && !it.absent);
    if (acting.length === 0) continue;
    for (const it of acting.filter((x) => x.external)) {
      if (!it.external!.observe().aligned) {
        const r = it.external!.apply();
        if (r.ok) wrote.push(`${path} (${it.id})`);
      }
    }
    const fileItems = acting.filter((x) => !x.external);
    if (fileItems.length === 0) continue;
    const live = reader.live(path);
    const linkItem = fileItems.find((x) => x.link !== undefined);
    const held = opts.lock ? await opts.lock(path) : null;
    try {
      if (linkItem) {
        if (live.kind === "link" && live.target === linkItem.link) continue;
        mkdirSync(dirname(path), { recursive: true });
        if (live.kind !== "absent") unlinkSync(path);
        symlinkSync(linkItem.link!, path);
        entries.push({ path, prior: live, wrote: sha(`link:${linkItem.link}`) });
        wrote.push(path);
        continue;
      }
      if (live.kind === "link") continue;
      const want = desiredOf(fileItems, live);
      const cur = live.kind === "file" ? live.bytes : null;
      if (want === cur) continue;
      if (want === null) unlinkSync(path);
      else {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(`${path}.lares-tmp`, want, "utf8");
        renameSync(`${path}.lares-tmp`, path);
      }
      entries.push({ path, prior: live, wrote: want === null ? null : sha(want) });
      wrote.push(path);
    } finally {
      await held?.release();
    }
  }
  const generation = entries.length ? ledger.record("tend", entries) : null;
  return { rows: read(items, ledger, reader), wrote, refused, generation };
}

// ── Undo ────────────────────────────────────────────────────────────────────────────────────────

/** Restore the prior bytes a generation recorded, and record the restore as its own generation. */
export function undo(ledger: Ledger, gen?: number): Generation {
  const gens = ledger.generations();
  const target = gen === undefined ? gens.filter((g) => g.act === "tend").at(-1) : gens.find((g) => g.gen === gen);
  if (!target) throw new Error(gen === undefined ? "no tend generation stands to undo" : `no generation ${gen} stands`);
  const entries: LedgerEntry[] = [];
  for (const e of target.entries) {
    const live = diskReader.live(e.path);
    if (live.kind !== "absent") unlinkSync(e.path);
    if (e.prior.kind === "file") {
      mkdirSync(dirname(e.path), { recursive: true });
      writeFileSync(e.path, e.prior.bytes, "utf8");
    } else if (e.prior.kind === "link") {
      mkdirSync(dirname(e.path), { recursive: true });
      symlinkSync(e.prior.target, e.path);
    }
    entries.push({ path: e.path, prior: live, wrote: liveHash(e.prior) });
  }
  return ledger.record("undo", entries, target.gen);
}

// ── The exit contract ───────────────────────────────────────────────────────────────────────────

export const EXIT = { aligned: 0, drift: 1, usage: 2, foreign: 3, unreachable: 4 } as const;

export function exitOf(rows: readonly Row[]): number {
  if (rows.some((r) => r.state === "foreign")) return EXIT.foreign;
  if (rows.some((r) => r.state === "drift")) return EXIT.drift;
  if (rows.some((r) => r.state === "unreachable")) return EXIT.unreachable;
  return EXIT.aligned;
}
