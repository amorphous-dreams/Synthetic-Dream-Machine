/**
 * engine-meter — how much memory this isolate's Automerge engine holds, beside what node's own heap holds.
 *
 * ONE ENGINE PER ISOLATE (`engine-watch`): the Node binding instantiates one wasm module when it loads, and every document in
 * that isolate lives in its one linear memory. wasm32 caps that memory at 4 GiB (65,536 pages of 64 KiB); past it an allocation
 * fails inside the engine and the engine falls (`rust_oom`, `engine-watch`). A linear memory only grows while its instance
 * lives, so its size reads as its own high water; the meter keeps the most it saw anyway, so a reading names that mark plainly.
 *
 * WHERE THE MEMORY STANDS. The binding keeps its instance private, so the meter finds it at arming (and, while it finds none, again after a doubling wait) through the
 * isolate's own inspector session (`Runtime.queryObjects` over `WebAssembly.Instance.prototype`, picking the instance whose
 * exports carry the engine's `wasmReleaseInfo` and a memory). That walk visits the heap once, so the vessel arms the meter
 * early, while the heap stays small; every later read touches `buffer.byteLength` alone. An isolate where no engine loaded
 * (or a node built without the inspector) reads `wasm: null`, never a guess.
 *
 * WHAT NODE'S NUMBERS MEAN HERE. `process.memoryUsage()` reads per isolate for the heap and process-wide for `rss`. V8 counts
 * a wasm memory's committed bytes inside `external`, so `external` minus `arrayBuffers` sits close to the engine's linear
 * memory; `maxRss` reads the process's peak resident size (`process.resourceUsage().maxRSS`, the kernel's VmHWM).
 *
 * THE WHOLE PROCESS (`processWasmOf`). The daemon island runs as a worker with its own isolate and its own engine, so one
 * isolate's meter never sees the other's memory. On Linux `/proc/self/smaps` does: V8 reserves 8 GiB or 10 GiB of address space per
 * wasm32 memory, commits the linear size read-write and leaves the rest inaccessible, so each memory
 * reads as an anonymous `rw-p` mapping followed at once by a `---p` one, the pair one reservation long. The reading lists each
 * memory's linear and resident bytes; it cannot name which engine owns which (the meter's own isolate reading can, for its own).
 * Text where no pair matches reads as unread with its reason, never as zero memories. A read reuses one process reading for a
 * few seconds, and the ceiling check never reads smaps at all.
 *
 * THE CEILING LINES. Each isolate's meter checks on an unref'd tick and logs one line the first time its engine crosses each
 * named fraction of the ceiling (`ENGINE_METER_MARKS`), naming the size and the heap beside it. It decides nothing.
 */

import { readFileSync } from "node:fs";

/** wasm32's ceiling for one linear memory: 65,536 pages of 64 KiB. */
export const ENGINE_WASM_CEILING_BYTES = 4 * 1024 ** 3;
/** One wasm page. */
export const WASM_PAGE_BYTES = 65_536;
/** The fractions of the ceiling that each earn one log line, the first time the engine crosses them. */
export const ENGINE_METER_MARKS = [0.5, 0.75, 0.9] as const;
/** How often an armed meter checks the marks. */
export const ENGINE_METER_TICK_MS = 15_000;
/** V8's address-space reservation for one wasm32 memory with guard regions: 8 GiB or 10 GiB. */
const WASM_RESERVATIONS: readonly bigint[] = [8n * 1024n ** 3n, 10n * 1024n ** 3n];

/** One isolate's engine memory, read off its `WebAssembly.Memory`. */
export interface EngineWasmReading {
  readonly bytes: number;
  readonly pages: number;
  /** The most this meter has seen; a linear memory never shrinks, so it reads the current size. */
  readonly highWaterBytes: number;
  readonly ceilingBytes: number;
  /** The largest memory's share of the ceiling: the ceiling binds each memory alone (an isolate that loaded the engine twice
   *  holds two, and `bytes` sums them). */
  readonly fraction: number;
}

/** Every wasm memory the process holds, off `/proc/self/smaps`. A resident count reads null where smaps named no `Rss:` for a
 *  mapping it sums, never a zero standing in for an unread line. */
export interface ProcessWasmReading {
  readonly memories: ReadonlyArray<{ readonly bytes: number; readonly residentBytes: number | null }>;
  /** The linear bytes of every memory together. */
  readonly bytes: number;
  /** How many of those bytes stand resident; null where any memory's `Rss:` read nowhere. */
  readonly residentBytes: number | null;
  /** Every mapping's resident bytes together: the process's rss as smaps sums it, for the split; null where any `Rss:` read nowhere. */
  readonly processResidentBytes: number | null;
}

/** NO SILENT ZERO: the process reading that did not land says why, never `bytes: 0`. */
export interface ProcessWasmUnread {
  readonly unread: "smaps-unreadable" | "no-wasm-reservation";
  readonly why: string;
}

/** How long one process reading answers every read after it: health's GET probes reuse it instead of parsing smaps each time. */
export const ENGINE_METER_PROCESS_CACHE_MS = 5_000;
/** The most reads an isolate that found no engine memory waits before it looks again (the wait doubles from one). */
const FIND_BACKOFF_CAP = 64;

export interface EngineMeterReading {
  /** Which isolate read: `main`, `daemon island`. */
  readonly isolate: string;
  /** Null where this isolate found no engine memory. */
  readonly wasm: EngineWasmReading | null;
  readonly node: {
    readonly heapUsed: number;
    readonly heapTotal: number;
    readonly external: number;
    readonly arrayBuffers: number;
    readonly rss: number;
    /** The process's peak resident bytes. */
    readonly maxRss: number;
  };
  /** The whole process's wasm memories, or why they read nowhere; null where no process reader was given. */
  readonly process: ProcessWasmReading | ProcessWasmUnread | null;
}

export interface EngineMeter {
  read(): EngineMeterReading;
  /** Read this isolate's engine alone (never smaps), and log a line for each mark the engine has crossed since the last check. */
  check(): void;
  /** Check now and on every tick after; idempotent. */
  arm(): EngineMeter;
  /** Stop the tick. */
  dispose(): void;
}

export interface EngineMeterOptions {
  readonly isolate: string;
  /** This isolate's engine memories, asked on every read; default: `find` until it finds some, then those. */
  readonly memories?: () => readonly WebAssembly.Memory[];
  /** The finder behind the default `memories`; default `findEngineMemories`. A find that answers none retries with a doubling
   *  wait of reads (capped at 64), since an engine may load after the meter arms; one that answers some is kept. */
  readonly find?: () => readonly WebAssembly.Memory[];
  readonly usage?: () => NodeJS.MemoryUsage;
  /** The process's peak resident bytes; default `process.resourceUsage().maxRSS` (KiB) in bytes. */
  readonly maxRssBytes?: () => number;
  /** The whole process's wasm memories, or why they read nowhere; absent, the reading carries `process: null`. Its answer is
   *  reused for `processCacheMs`. */
  readonly processWasm?: () => ProcessWasmReading | ProcessWasmUnread;
  readonly processCacheMs?: number;
  /** A monotonic clock for the process cache; default `performance.now`. */
  readonly now?: () => number;
  readonly log?: (line: string) => void;
  readonly marks?: readonly number[];
  readonly ceilingBytes?: number;
  /** Start a repeating tick; answers its stop. Default: an unref'd `setInterval` at `ENGINE_METER_TICK_MS`. */
  readonly tick?: (fn: () => void) => () => void;
}

/**
 * Find this isolate's Automerge engine memories through its own inspector session. Synchronous: an in-process session answers
 * each post inside the call. Answers none where the inspector stands absent or no instance exports the engine's marks.
 */
export function findEngineMemories(): WebAssembly.Memory[] {
  const key = Symbol.for("lararium.engine-meter.found");
  const global = globalThis as unknown as Record<symbol, unknown>;
  let session: import("node:inspector").Session | null = null;
  try {
    // A node built without the inspector throws here; the meter then reads no engine memory.
    const { Session } = process.getBuiltinModule("node:inspector") as typeof import("node:inspector");
    session = new Session();
    session.connect();
    const post = <T>(method: string, params: Record<string, unknown>): T => {
      let answer: T | undefined; let fault: Error | null = null;
      session!.post(method, params, (err: Error | null, res: unknown) => { fault = err; answer = res as T; });
      if (fault) throw fault;
      if (answer === undefined) throw new Error(`engine meter: ${method} answered after the call`);
      return answer;
    };
    const group = "lararium-engine-meter";
    const proto = post<{ result: { objectId?: string } }>("Runtime.evaluate", { expression: "WebAssembly.Instance.prototype", objectGroup: group });
    if (!proto.result.objectId) return [];
    const found = post<{ objects: { objectId?: string } }>("Runtime.queryObjects", { prototypeObjectId: proto.result.objectId, objectGroup: group });
    if (found.objects.objectId) {
      post("Runtime.callFunctionOn", {
        objectId: found.objects.objectId, objectGroup: group, returnByValue: true,
        functionDeclaration: `function () {
          globalThis[Symbol.for("lararium.engine-meter.found")] = this
            .filter((i) => typeof i.exports.wasmReleaseInfo === "function")
            .map((i) => Object.values(i.exports).find((x) => x instanceof WebAssembly.Memory))
            .filter(Boolean);
        }`,
      });
    }
    post("Runtime.releaseObjectGroup", { objectGroup: group });
    const memories = global[key];
    return Array.isArray(memories) ? memories as WebAssembly.Memory[] : [];
  } catch {
    return [];
  } finally {
    delete global[key];
    try { session?.disconnect(); } catch { /* a session that never connected holds nothing */ }
  }
}

/** Every wasm memory a `/proc/<pid>/smaps` text names: each `rw-p` + `---p` anonymous pair one V8 reservation long. Null where
 *  no pair matches: the text holds no wasm memory this rule recognises, which a zero would misreport as an empty one. */
export function processWasmOf(smaps: string): ProcessWasmReading | null {
  interface Vma { start: bigint; end: bigint; perm: string; anon: boolean; rssKiB: number | null }
  const vmas: Vma[] = [];
  let at: Vma | null = null;
  for (const line of smaps.split("\n")) {
    // Most lines name a field (`Size:`, `Pss:`, ...); only a mapping's head and its `Rss:` line count here.
    const c = line.charCodeAt(0);
    if (c >= 65 && c <= 90) {
      if (at && line.startsWith("Rss:")) { const kib = /^Rss:\s+(\d+) kB/.exec(line)?.[1]; at.rssKiB = kib === undefined ? null : Number(kib); }
      continue;
    }
    const head = /^([0-9a-f]+)-([0-9a-f]+) (\S{4}) \S+ \S+ \S+\s*(.*)$/.exec(line);
    if (head) {
      at = { start: BigInt(`0x${head[1]}`), end: BigInt(`0x${head[2]}`), perm: head[3]!, anon: head[4]!.trim() === "", rssKiB: null };
      vmas.push(at);
    }
  }
  const memories: Array<{ bytes: number; residentBytes: number | null }> = [];
  for (let i = 0; i + 1 < vmas.length; i++) {
    const a = vmas[i]!, b = vmas[i + 1]!;
    if (a.perm === "rw-p" && b.perm === "---p" && a.anon && b.anon && b.start === a.end && WASM_RESERVATIONS.includes(b.end - a.start)) {
      memories.push({ bytes: Number(a.end - a.start), residentBytes: a.rssKiB === null ? null : a.rssKiB * 1024 });
    }
  }
  if (memories.length === 0) return null;
  const sum = (xs: ReadonlyArray<number | null>): number | null => (xs.some((x) => x === null) ? null : xs.reduce<number>((s, x) => s + x!, 0));
  return {
    memories,
    bytes: memories.reduce((s, m) => s + m.bytes, 0),
    residentBytes: sum(memories.map((m) => m.residentBytes)),
    processResidentBytes: sum(vmas.map((v) => (v.rssKiB === null ? null : v.rssKiB * 1024))),
  };
}

/** This process's wasm memories off `/proc/self/smaps`, or why they read nowhere: the file unreadable (off Linux), or no
 *  reservation in it this rule recognises. */
export function readProcessWasm(): ProcessWasmReading | ProcessWasmUnread {
  let text: string;
  try { text = readFileSync("/proc/self/smaps", "utf8"); } catch (e) {
    return { unread: "smaps-unreadable", why: `/proc/self/smaps reads nowhere: ${e instanceof Error ? e.message : String(e)}` };
  }
  return processWasmOf(text) ?? { unread: "no-wasm-reservation", why: "no rw-p + ---p pair in /proc/self/smaps spans one V8 wasm reservation (8 or 10 GiB)" };
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const size = (bytes: number): string => (bytes >= GiB ? `${Number((bytes / GiB).toFixed(2))} GiB` : `${Math.round(bytes / MiB)} MiB`);

export function createEngineMeter(opts: EngineMeterOptions): EngineMeter {
  const ceiling = opts.ceilingBytes ?? ENGINE_WASM_CEILING_BYTES;
  const marks = [...(opts.marks ?? ENGINE_METER_MARKS)].sort((a, b) => a - b);
  // THE FIND RETRIES UNTIL IT FINDS: a meter armed before the engine loads (or a walk that failed) asks again after a doubling
  // wait of reads, so a later read still finds the engine while an isolate holding none pays one heap walk per 64 reads at most.
  const find = opts.find ?? findEngineMemories;
  let found: readonly WebAssembly.Memory[] = [];
  let wait = 0;
  let backoff = 1;
  const memories = opts.memories ?? ((): readonly WebAssembly.Memory[] => {
    if (found.length > 0) return found;
    if (wait > 0) { wait--; return found; }
    found = find();
    if (found.length === 0) { wait = backoff; backoff = Math.min(backoff * 2, FIND_BACKOFF_CAP); }
    return found;
  });
  const now = opts.now ?? (() => performance.now());
  const cacheMs = opts.processCacheMs ?? ENGINE_METER_PROCESS_CACHE_MS;
  let cached: { at: number; reading: ProcessWasmReading | ProcessWasmUnread } | null = null;
  const processReading = (): ProcessWasmReading | ProcessWasmUnread | null => {
    if (!opts.processWasm) return null;
    const t = now();
    if (cached === null || t - cached.at >= cacheMs) cached = { at: t, reading: opts.processWasm() };
    return cached.reading;
  };
  const usage = opts.usage ?? (() => process.memoryUsage());
  const maxRssBytes = opts.maxRssBytes ?? (() => process.resourceUsage().maxRSS * 1024);
  const tick = opts.tick ?? ((fn) => { const t = setInterval(fn, ENGINE_METER_TICK_MS); t.unref(); return () => clearInterval(t); });
  let highWater = 0;
  let crossed = 0;
  let stop: (() => void) | null = null;

  /** This isolate's engine and node's heap: cheap, every check reads it. */
  const isolateReading = (): Omit<EngineMeterReading, "process"> => {
    const held = memories();
    const sizes = held.map((m) => m.buffer.byteLength);
    const bytes = sizes.reduce((s, n) => s + n, 0);
    highWater = Math.max(highWater, bytes);
    const u = usage();
    return {
      isolate: opts.isolate,
      wasm: held.length === 0 ? null : { bytes, pages: bytes / WASM_PAGE_BYTES, highWaterBytes: highWater, ceilingBytes: ceiling, fraction: Math.max(...sizes) / ceiling },
      node: { heapUsed: u.heapUsed, heapTotal: u.heapTotal, external: u.external, arrayBuffers: u.arrayBuffers, rss: u.rss, maxRss: maxRssBytes() },
    };
  };
  const read = (): EngineMeterReading => ({ ...isolateReading(), process: processReading() });

  const check = (): void => {
    if (crossed >= marks.length) return;
    const r = isolateReading();
    if (r.wasm === null) return;
    while (crossed < marks.length && r.wasm.fraction >= marks[crossed]!) {
      const mark = marks[crossed++]!;
      opts.log?.(`engine meter (${r.isolate}): the Automerge engine's wasm memory crossed ${Math.round(mark * 100)}% of its ${size(ceiling)} ceiling — `
        + `${size(r.wasm.bytes)} in ${r.wasm.pages.toLocaleString("en-US")} pages; heap ${size(r.node.heapUsed)} used of ${size(r.node.heapTotal)}, `
        + `external ${size(r.node.external)}, rss ${size(r.node.rss)} (peak ${size(r.node.maxRss)})`);
    }
  };

  const meter: EngineMeter = {
    read,
    check,
    arm: () => {
      if (stop === null) {
        check();
        stop = tick(() => { try { check(); } catch { /* a meter's fault never reaches the vessel */ } });
      }
      return meter;
    },
    dispose: () => { stop?.(); stop = null; },
  };
  return meter;
}
