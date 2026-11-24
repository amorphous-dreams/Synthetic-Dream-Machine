/**
 * THE ENGINE METER READS WHERE THE MEMORY GOES.
 *
 * On 2026-11-23 a lay of 98 carriers left the vessel at 3.0 GB resident (3.5 GB peak) with the wasm32 engine's ceiling at
 * 4 GiB, and nothing in the house could say how much of that the Automerge engine's linear memory held and how much the V8
 * heap did. The meter reads both per isolate (the engine's own `WebAssembly.Memory`, and `process.memoryUsage`), reads every
 * wasm memory the whole process holds off `/proc/self/smaps` (the daemon island's engine included), and logs one line when
 * the engine crosses a named fraction of its ceiling.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";
import {
  createEngineMeter, findEngineMemories, processWasmOf, readProcessWasm, ENGINE_METER_MARKS, ENGINE_WASM_CEILING_BYTES, WASM_PAGE_BYTES,
} from "../src/engine-meter.js";

const ENGINE = pathToFileURL(createRequire(import.meta.url).resolve("@automerge/automerge")).href;
const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** A stand-in engine memory whose size the test moves: the meter reads `buffer.byteLength` and nothing else. */
const memoryOf = (bytes: { n: number }) => ({ get buffer() { return { byteLength: bytes.n } as ArrayBuffer; } }) as WebAssembly.Memory;
const usage = (): NodeJS.MemoryUsage => ({ rss: 900 * MiB, heapTotal: 300 * MiB, heapUsed: 200 * MiB, external: 500 * MiB, arrayBuffers: 4 * MiB });

describe("findEngineMemories — this isolate's Automerge engine memory", () => {
  test("finds the loaded engine's linear memory, and the meter reads it in bytes and pages beside node's heap", async () => {
    const A = await import(ENGINE) as typeof import("@automerge/automerge");
    let doc = A.from<{ t: Record<string, string> }>({ t: {} });
    doc = A.change(doc, (d) => { d.t["k"] = "v"; });
    expect(A.save(doc).byteLength).toBeGreaterThan(0);
    const memories = findEngineMemories();
    expect(memories.length).toBeGreaterThan(0);
    const bytes = memories.reduce((s, m) => s + m.buffer.byteLength, 0);
    const reading = createEngineMeter({ isolate: "main", memories: () => memories }).read();
    expect(reading.isolate).toBe("main");
    expect(reading.wasm?.bytes).toBe(bytes);
    expect(reading.wasm?.pages).toBe(bytes / WASM_PAGE_BYTES);
    expect(reading.wasm?.ceilingBytes).toBe(ENGINE_WASM_CEILING_BYTES);
    // The ceiling binds each memory alone: a suite that loaded the engine twice holds two, and the largest sets the share.
    expect(reading.wasm?.fraction).toBeCloseTo(Math.max(...memories.map((m) => m.buffer.byteLength)) / ENGINE_WASM_CEILING_BYTES, 9);
    for (const key of ["heapUsed", "heapTotal", "external", "arrayBuffers", "rss", "maxRss"] as const) {
      expect(typeof reading.node[key]).toBe("number");
      expect(reading.node[key]).toBeGreaterThan(0);
    }
  });

  test("a find that answers none retries after a doubling wait of reads, and keeps the first memories it finds", () => {
    let finds = 0;
    const size = { n: 64 * MiB };
    let loaded = false;
    const meter = createEngineMeter({ isolate: "main", usage, maxRssBytes: () => 0, find: () => { finds++; return loaded ? [memoryOf(size)] : []; } });
    const reads = (n: number) => { for (let i = 0; i < n; i++) meter.read(); };
    reads(1); expect(finds).toBe(1);            // miss: wait 1
    reads(2); expect(finds).toBe(2);            // skip 1, then miss: wait 2
    reads(3); expect(finds).toBe(3);            // skip 2, then miss: wait 4
    loaded = true;
    reads(4); expect(finds).toBe(3);            // still waiting
    expect(meter.read().wasm?.bytes).toBe(64 * MiB);
    expect(finds).toBe(4);
    reads(10); expect(finds).toBe(4);           // found: kept, never walked again
  });

  test("an isolate that finds no engine memory reads wasm null and still reads node's heap", () => {
    const reading = createEngineMeter({ isolate: "main", memories: () => [], usage, maxRssBytes: () => 1_000 * MiB }).read();
    expect(reading.wasm).toBeNull();
    expect(reading.node).toEqual({ rss: 900 * MiB, heapTotal: 300 * MiB, heapUsed: 200 * MiB, external: 500 * MiB, arrayBuffers: 4 * MiB, maxRss: 1_000 * MiB });
  });
});

describe("createEngineMeter — the high-water mark and the ceiling lines", () => {
  test("the high water holds the most the meter has seen", () => {
    const size = { n: 64 * MiB };
    const meter = createEngineMeter({ isolate: "main", memories: () => [memoryOf(size)], usage, maxRssBytes: () => 0 });
    expect(meter.read().wasm?.highWaterBytes).toBe(64 * MiB);
    size.n = 128 * MiB;
    expect(meter.read().wasm?.highWaterBytes).toBe(128 * MiB);
    size.n = 96 * MiB; // a fresh engine after a restart reads smaller; the mark this meter saw stands
    expect(meter.read().wasm).toMatchObject({ bytes: 96 * MiB, highWaterBytes: 128 * MiB });
  });

  test("logs one line per named fraction of the 4 GiB ceiling, each once, naming the isolate, the size and the heap", () => {
    expect(ENGINE_METER_MARKS).toEqual([0.5, 0.75, 0.9]);
    const size = { n: 1 * GiB };
    const lines: string[] = [];
    const meter = createEngineMeter({ isolate: "daemon island", memories: () => [memoryOf(size)], usage, maxRssBytes: () => 0, log: (l) => lines.push(l) });
    meter.check();
    expect(lines).toEqual([]);
    size.n = 2 * GiB + 64 * MiB;
    meter.check();
    meter.check();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^engine meter \(daemon island\): the Automerge engine's wasm memory crossed 50% of its 4 GiB ceiling/);
    expect(lines[0]).toContain("2.06 GiB");
    expect(lines[0]).toContain(`${((2 * GiB + 64 * MiB) / WASM_PAGE_BYTES).toLocaleString("en-US")} pages`);
    expect(lines[0]).toContain("heap 200 MiB used of 300 MiB");
    expect(lines[0]).toContain("rss 900 MiB");
    size.n = Math.ceil(0.95 * 4 * GiB);
    meter.check();
    expect(lines.slice(1).map((l) => /crossed (\d+)%/.exec(l)?.[1])).toEqual(["75", "90"]);
    meter.check();
    expect(lines).toHaveLength(3);
  });

  test("arming starts one unref'd tick and dispose stops it", () => {
    const size = { n: 3 * GiB + 512 * MiB };
    const lines: string[] = [];
    const ticks: Array<{ fn: () => void; unref: boolean; cleared: boolean }> = [];
    const meter = createEngineMeter({
      isolate: "main", memories: () => [memoryOf(size)], usage, maxRssBytes: () => 0, log: (l) => lines.push(l),
      tick: (fn) => { const t = { fn, unref: true, cleared: false }; ticks.push(t); return () => { t.cleared = true; }; },
    });
    meter.arm();
    meter.arm();
    expect(ticks).toHaveLength(1);
    expect(lines).toHaveLength(2); // arming checks at once: 50% and 75% already crossed
    ticks[0]!.fn();
    expect(lines).toHaveLength(2);
    meter.dispose();
    expect(ticks[0]!.cleared).toBe(true);
  });
});

describe("processWasmOf — every wasm memory the process holds, off /proc/self/smaps", () => {
  // Shaped on the live vessel's own smaps (2026-11-23): V8 reserves 8 GiB per wasm32 memory, commits the linear size read-write
  // and keeps the rest inaccessible, so each memory reads as a rw-p mapping followed at once by a ---p one, the pair 8 GiB.
  const vma = (start: bigint, sizeKiB: bigint, perm: string, rssKiB: number, name = ""): string => {
    const end = start + sizeKiB * 1024n;
    return `${start.toString(16)}-${end.toString(16)} ${perm} 00000000 00:00 0 ${name}\nSize: ${sizeKiB} kB\nRss: ${rssKiB} kB\nPss: ${rssKiB} kB\n`;
  };
  const base = 0x7e3d00000000n;
  const linear = 695_168n; // KiB: 678.9 MiB
  const smaps = [
    vma(0x3f9b3000n, 109_952n, "rw-p", 109_875, "[heap]"),
    vma(base, linear, "rw-p", 636_416),
    vma(base + linear * 1024n, 8n * 1024n * 1024n - linear, "---p", 0),
    // an anonymous rw-p whose neighbour leaves the pair short of a reservation: not a wasm memory
    vma(0x7e4000000000n, 65_536n, "rw-p", 65_536),
    vma(0x7e4000000000n + 65_536n * 1024n, 1_024n, "---p", 0),
    vma(0x7e5000000000n, 18_432n, "rw-p", 17_203),
    vma(0x7e5000000000n + 18_432n * 1024n, 8n * 1024n * 1024n - 18_432n, "---p", 0),
    vma(0x74a000n, 41_984n, "r-xp", 30_617, "/usr/local/bin/node"),
  ].join("");

  test("reads each reservation's linear and resident bytes, and their sums", () => {
    const read = processWasmOf(smaps);
    if (read === null) throw new Error("the fixture's two reservations read as none");
    expect(read.memories).toEqual([
      { bytes: Number(linear) * 1024, residentBytes: 636_416 * 1024 },
      { bytes: 18_432 * 1024, residentBytes: 17_203 * 1024 },
    ]);
    expect(read.bytes).toBe(Number(linear) * 1024 + 18_432 * 1024);
    expect(read.residentBytes).toBe((636_416 + 17_203) * 1024);
    expect(read.processResidentBytes).toBe((109_875 + 636_416 + 65_536 + 17_203 + 30_617) * 1024);
  });

  test("NO SILENT ZERO: text with no reservation reads null, never zero memories", () => {
    expect(processWasmOf("")).toBeNull();
    // mappings stand, but no pair spans a reservation: the rule recognises nothing, so it says nothing
    expect(processWasmOf(vma(0x7e4000000000n, 65_536n, "rw-p", 65_536) + vma(0x7e4000000000n + 65_536n * 1024n, 1_024n, "---p", 0))).toBeNull();
  });

  test("NO SILENT ZERO: a reservation whose Rss line reads nowhere reads its resident bytes null, and so do the sums", () => {
    const noRss = `${base.toString(16)}-${(base + linear * 1024n).toString(16)} rw-p 00000000 00:00 0 \nSize: ${linear} kB\n`
      + vma(base + linear * 1024n, 8n * 1024n * 1024n - linear, "---p", 0);
    expect(processWasmOf(noRss)).toEqual({ memories: [{ bytes: Number(linear) * 1024, residentBytes: null }], bytes: Number(linear) * 1024, residentBytes: null, processResidentBytes: null });
  });

  test("readProcessWasm answers a reading or names why it reads none, never a zero", () => {
    const read = readProcessWasm();
    if ("unread" in read) expect(["smaps-unreadable", "no-wasm-reservation"]).toContain(read.unread);
    else expect(read.memories.length).toBeGreaterThan(0);
  });

  test("the meter carries the process reading where one stands, reused within its cache and read afresh after", () => {
    let parses = 0;
    let t = 0;
    const meter = createEngineMeter({ isolate: "main", memories: () => [], usage, maxRssBytes: () => 0, now: () => t, processCacheMs: 5_000,
      processWasm: () => { parses++; return processWasmOf(smaps)!; } });
    const reading = meter.read();
    expect(reading.process && "memories" in reading.process ? reading.process.memories : []).toHaveLength(2);
    t = 4_999; meter.read(); meter.read();
    expect(parses).toBe(1);
    t = 5_000; meter.read();
    expect(parses).toBe(2);
  });

  test("the ceiling check reads the isolate alone, never smaps", () => {
    let parses = 0;
    const size = { n: 3 * GiB };
    const meter = createEngineMeter({ isolate: "main", memories: () => [memoryOf(size)], usage, maxRssBytes: () => 0, log: () => {},
      processWasm: () => { parses++; return processWasmOf(smaps)!; } });
    meter.check(); meter.check();
    expect(parses).toBe(0);
  });

  test("a large map parses inside a few tens of milliseconds", () => {
    const parts: string[] = [];
    for (let i = 0n; i < 20_000n; i++) parts.push(vma(0x10000000n + i * 0x200000n, 1_024n, i % 2n === 0n ? "rw-p" : "r--p", 512));
    parts.push(smaps);
    const text = parts.join("");
    const t0 = performance.now();
    const read = processWasmOf(text);
    const ms = performance.now() - t0;
    expect(read?.memories).toHaveLength(2);
    expect(ms).toBeLessThan(500); // measured ~25 ms on the desk for 20,000 mappings; the bound catches a pathology, not jitter
  });
});
