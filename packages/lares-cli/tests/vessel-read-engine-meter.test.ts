/**
 * `lares vessel read` names the engine meter: where a vessel answers health on its port, the read carries health's `engine`
 * reading (the Automerge engine's wasm memory, node's heap, every process wasm memory) and prints one line of it; where none
 * answers, it reads null and prints nothing of it.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatch } from "../src/bin/lares.js";
import { engineMeterLine } from "../src/commands/read.js";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const READING = {
  isolate: "main",
  wasm: { bytes: 679 * MiB, pages: (679 * MiB) / 65_536, highWaterBytes: 679 * MiB, ceilingBytes: 4 * GiB, fraction: 679 / 4096 },
  node: { heapUsed: 400 * MiB, heapTotal: 520 * MiB, external: 700 * MiB, arrayBuffers: 9 * MiB, rss: 2_910 * MiB, maxRss: 3_457 * MiB },
  process: { memories: [{ bytes: 679 * MiB, residentBytes: 621 * MiB }, { bytes: 511 * MiB, residentBytes: 437 * MiB }], bytes: 1_190 * MiB, residentBytes: 1_058 * MiB, processResidentBytes: 2_910 * MiB },
};

const roots: string[] = [];
const servers: Server[] = [];
const saved = { root: process.env["LAR_ROOT"], port: process.env["LAR_PORT"] };
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const [key, env] of [["root", "LAR_ROOT"], ["port", "LAR_PORT"]] as const) {
    if (saved[key] === undefined) delete process.env[env]; else process.env[env] = saved[key];
  }
});

async function readJson(root: string): Promise<{ data: Record<string, unknown> }> {
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env["LAR_ROOT"] = root;
  let output = "";
  const stdoutWrite = process.stdout.write;
  process.stdout.write = ((chunk: unknown) => { output += String(chunk); return true; }) as typeof process.stdout.write;
  try {
    expect(await dispatch(["vessel", "read", `root=${root}`, "--json", "--skip-build"])).toBe(0);
  } finally {
    process.stdout.write = stdoutWrite;
  }
  return JSON.parse(output);
}

function house(): string {
  const root = mkdtempSync(join(tmpdir(), "lares-engine-meter-"));
  roots.push(root);
  mkdirSync(join(root, "hearth", "vessel"), { recursive: true });
  return root;
}

async function health(body: unknown): Promise<number> {
  const server = createServer((req, res) => {
    if (req.url?.startsWith("/api/health")) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(body)); return; }
    res.writeHead(404); res.end();
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("health stand-in did not bind");
  return address.port;
}

describe("vessel read names the engine meter", () => {
  test("a vessel answering health hands its engine reading to the read", async () => {
    const root = house();
    process.env["LAR_PORT"] = String(await health({ status: "ready", engine: READING }));
    expect((await readJson(root)).data["engine"]).toEqual(READING);
  });

  test("CONTROL: a health answer with no engine reading reads null, never a guess", async () => {
    const root = house();
    process.env["LAR_PORT"] = String(await health({ status: "ready" }));
    expect((await readJson(root)).data["engine"]).toBeNull();
  });

  test("the line names the engine's size against its ceiling, the heap and the process's wasm share of rss", () => {
    expect(engineMeterLine(READING)).toBe(
      "main engine 679 MiB of 4 GiB (17%, 10,864 pages) · heap 400 MiB of 520 MiB · external 700 MiB · rss 2.84 GiB (peak 3.38 GiB) · process wasm 1.16 GiB in 2 memories, 1.03 GiB resident",
    );
    expect(engineMeterLine({ ...READING, process: { unread: "no-wasm-reservation", why: "no pair" } })).toContain(" · process wasm unread (no-wasm-reservation)");
    expect(engineMeterLine({ ...READING, process: { ...READING.process, residentBytes: null } })).toContain("process wasm 1.16 GiB in 2 memories, resident unread");
    expect(engineMeterLine({ ...READING, wasm: null, process: null })).toBe(
      "main engine unread · heap 400 MiB of 520 MiB · external 700 MiB · rss 2.84 GiB (peak 3.38 GiB)",
    );
  });
});
