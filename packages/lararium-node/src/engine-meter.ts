/**
 * engine-meter — how much memory this isolate's Automerge engine holds, beside what node's own heap holds.
 *
 * ONE ENGINE PER ISOLATE (`engine-watch`): the Node binding instantiates one wasm module when it loads, and every document in
 * that isolate lives in its one linear memory. wasm32 caps that memory at 4 GiB (65,536 pages of 64 KiB); past it an allocation
 * fails inside the engine and the engine falls (`rust_oom`, `engine-watch`). A linear memory only grows while its instance
 * lives, so its size reads as its own high water; the meter keeps the most it saw anyway, so a reading names that mark plainly.
 *
 * WHERE THE MEMORY STANDS. The binding keeps its instance private, so the meter finds it once, at arming, through the
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
 * isolate's meter never sees the other's memory. On Linux `/proc/self/smaps` does: V8 reserves 8 GiB of address space per
 * wasm32 memory (10 GiB on older builds), commits the linear size read-write and leaves the rest inaccessible, so each memory
 * reads as an anonymous `rw-p` mapping followed at once by a `---p` one, the pair one reservation long. The reading lists each
 * memory's linear and resident bytes; it cannot name which engine owns which (the meter's own isolate reading can, for its own).
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
/** V8's address-space reservation for one wasm32 memory with guard regions: 8 GiB now, 10 GiB on older builds. */
const WASM_RESERVATIONS: readonly bigint[] = [8n * 1024n ** 3n, 10n * 1024n ** 3n];

/** One isolate's engine memory, read off its `WebAssembly.Memory`. */
export interface EngineWasmReading {
  readonly bytes: number;
  readonly pages: number;
  /** The most this meter has seen; a linear memory never shrinks, so it reads the current size unless the engine was replaced. */
  readonly highWaterBytes: number;
  readonly ceilingBytes: number;
  /** The largest memory's share of the ceiling: the ceiling binds each memory alone (an isolate that loaded the engine twice
   *  holds two, and `bytes` sums them). */
  readonly fraction: number;
}

/** Every wasm memory the process holds, off `/proc/self/smaps`. */
export interface ProcessWasmReading {
  readonly memories: ReadonlyArray<{ readonly bytes: number; readonly residentBytes: number }>;
  /** The linear bytes of every memory together. */
  readonly bytes: number;
  /** How many of those bytes stand resident. */
  readonly residentBytes: number;
  /** Every mapping's resident bytes together: the process's rss as smaps sums it, for the split. */
  readonly processResidentBytes: number;
}

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
  /** The whole process's wasm memories; null where the meter reads none (off Linux, or no process reader given). */
  readonly process: ProcessWasmReading | null;
}

export interface EngineMeter {
  read(): EngineMeterReading;
  /** Read once, and log a line for each mark the engine has crossed since the last check. */
  check(): void;
  /** Check now and on every tick after; idempotent. */
  arm(): EngineMeter;
  /** Stop the tick. */
  dispose(): void;
}

export interface EngineMeterOptions {
  readonly isolate: string;
  /** This isolate's engine memories; default: found once through the inspector (`findEngineMemories`). */
  readonly memories?: () => readonly WebAssembly.Memory[];
  readonly usage?: () => NodeJS.MemoryUsage;
  /** The process's peak resident bytes; default `process.resourceUsage().maxRSS` (KiB) in bytes. */
  readonly maxRssBytes?: () => number;
  /** The whole process's wasm memories; absent, the reading carries `process: null`. */
  readonly processWasm?: () => ProcessWasmReading | null;
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

/** Every wasm memory a `/proc/<pid>/smaps` text names: each `rw-p` + `---p` anonymous pair one V8 reservation long. */
export function processWasmOf(smaps: string): ProcessWasmReading {
  interface Vma { start: bigint; end: bigint; perm: string; anon: boolean; rssKiB: number }
  const vmas: Vma[] = [];
  let at: Vma | null = null;
  for (const line of smaps.split("\n")) {
    // Most lines name a field (`Size:`, `Pss:`, ...); only a mapping's head and its `Rss:` line count here.
    const c = line.charCodeAt(0);
    if (c >= 65 && c <= 90) {
      if (at && line.startsWith("Rss:")) at.rssKiB = Number(/(\d+)/.exec(line)?.[1] ?? 0);
      continue;
    }
    const head = /^([0-9a-f]+)-([0-9a-f]+) (\S{4}) \S+ \S+ \S+\s*(.*)$/.exec(line);
    if (head) {
      at = { start: BigInt(`0x${head[1]}`), end: BigInt(`0x${head[2]}`), perm: head[3]!, anon: head[4]!.trim() === "", rssKiB: 0 };
      vmas.push(at);
    }
  }
  const memories: Array<{ bytes: number; residentBytes: number }> = [];
  for (let i = 0; i + 1 < vmas.length; i++) {
    const a = vmas[i]!, b = vmas[i + 1]!;
    if (a.perm === "rw-p" && b.perm === "---p" && a.anon && b.anon && b.start === a.end && WASM_RESERVATIONS.includes(b.end - a.start)) {
      memories.push({ bytes: Number(a.end - a.start), residentBytes: a.rssKiB * 1024 });
    }
  }
  return {
    memories,
    bytes: memories.reduce((s, m) => s + m.bytes, 0),
    residentBytes: memories.reduce((s, m) => s + m.residentBytes, 0),
    processResidentBytes: vmas.reduce((s, v) => s + v.rssKiB * 1024, 0),
  };
}

/** This process's wasm memories, off `/proc/self/smaps`; null where that file reads nowhere (off Linux). */
export function readProcessWasm(): ProcessWasmReading | null {
  try { return processWasmOf(readFileSync("/proc/self/smaps", "utf8")); } catch { return null; }
}

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const size = (bytes: number): string => (bytes >= GiB ? `${Number((bytes / GiB).toFixed(2))} GiB` : `${Math.round(bytes / MiB)} MiB`);

export function createEngineMeter(opts: EngineMeterOptions): EngineMeter {
  const ceiling = opts.ceilingBytes ?? ENGINE_WASM_CEILING_BYTES;
  const marks = [...(opts.marks ?? ENGINE_METER_MARKS)].sort((a, b) => a - b);
  let found: readonly WebAssembly.Memory[] | null = null;
  const memories = opts.memories ?? (() => (found ??= findEngineMemories()));
  const usage = opts.usage ?? (() => process.memoryUsage());
  const maxRssBytes = opts.maxRssBytes ?? (() => process.resourceUsage().maxRSS * 1024);
  const tick = opts.tick ?? ((fn) => { const t = setInterval(fn, ENGINE_METER_TICK_MS); t.unref(); return () => clearInterval(t); });
  let highWater = 0;
  let crossed = 0;
  let stop: (() => void) | null = null;

  const read = (): EngineMeterReading => {
    const held = memories();
    const sizes = held.map((m) => m.buffer.byteLength);
    const bytes = sizes.reduce((s, n) => s + n, 0);
    highWater = Math.max(highWater, bytes);
    const u = usage();
    return {
      isolate: opts.isolate,
      wasm: held.length === 0 ? null : { bytes, pages: bytes / WASM_PAGE_BYTES, highWaterBytes: highWater, ceilingBytes: ceiling, fraction: Math.max(...sizes) / ceiling },
      node: { heapUsed: u.heapUsed, heapTotal: u.heapTotal, external: u.external, arrayBuffers: u.arrayBuffers, rss: u.rss, maxRss: maxRssBytes() },
      process: opts.processWasm?.() ?? null,
    };
  };

  const check = (): void => {
    if (crossed >= marks.length) return;
    const r = read();
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
