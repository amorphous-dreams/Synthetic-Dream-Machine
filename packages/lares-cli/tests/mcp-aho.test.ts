/**
 * mcp-aho — the Node host's binding of the aho (road L45a): `lares mcp aho -- <child argv…>`.
 *
 * The binding owns the client's stdio, spawns the surface as a child, frames JSON-RPC by the line and paces each respawn on
 * its own timer. A FAKE child stands in for the surface here (`fixtures/aho/fake-mcp-child.mjs`): the test kills it,
 * lets it die mid-call, and holds it down, and the client's stream reads on through every one. No container runs.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { ahoHost, type AhoHost } from "../src/mcp-aho.js";

const CHILD = join(import.meta.dirname, "fixtures", "aho", "fake-mcp-child.mjs");
const BIN = join(import.meta.dirname, "..", "bin", "lares.mjs");
const MARK = "s3cr3t-payload-marker";
const INIT = { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fixture-client", version: "1" } };

type Frame = Record<string, unknown>;

/** The client's side of a stream pair: frames out by the line, and a wait for the next frame a predicate names. */
function wire(write: (line: string) => void, read: NodeJS.ReadableStream) {
  const frames: Frame[] = [];
  const waiters: { want: (f: Frame) => boolean; done: (f: Frame) => void }[] = [];
  let buffer = "";
  read.setEncoding("utf8");
  read.on("data", (chunk: string) => {
    buffer += chunk;
    for (let at = buffer.indexOf("\n"); at !== -1; at = buffer.indexOf("\n")) {
      const frame = JSON.parse(buffer.slice(0, at)) as Frame; buffer = buffer.slice(at + 1);
      frames.push(frame);
      const i = waiters.findIndex((w) => w.want(frame));
      if (i !== -1) waiters.splice(i, 1)[0]!.done(frame);
    }
  });
  const next = (want: (f: Frame) => boolean): Promise<Frame> => new Promise((done) => {
    const had = frames.find(want);
    if (had) done(had); else waiters.push({ want, done });
  });
  const send = (frame: Frame): void => write(`${JSON.stringify(frame)}\n`);
  return { frames, next, send, ask: (frame: Frame): Promise<Frame> => { send(frame); return next((f) => f["id"] === frame["id"] && f["method"] === undefined); } };
}

/** Text off a stream, and a wait for a line a pattern names (the seat's own log speaks the one signal a respawn gives). */
function ear(read: NodeJS.ReadableStream) {
  let text = "";
  const waiters: { want: RegExp; done: () => void }[] = [];
  read.setEncoding("utf8");
  read.on("data", (chunk: string) => {
    text += chunk;
    for (const w of waiters.filter((x) => x.want.test(text))) { waiters.splice(waiters.indexOf(w), 1); w.done(); }
  });
  return { text: () => text, heard: (want: RegExp): Promise<void> => new Promise((done) => { if (want.test(text)) done(); else waiters.push({ want, done }); }) };
}

const textOf = (frame: Frame): string => String((frame["result"] as { content?: { text?: string }[] } | undefined)?.content?.[0]?.text);
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
const until = async (holds: () => boolean): Promise<void> => { while (!holds()) await new Promise((r) => setTimeout(r, 5)); };

let dir: string;
let host: AhoHost | null;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mcp-aho-"));
  writeFileSync(join(dir, "tools.json"), JSON.stringify(["echo", "hang", "die"]));
  host = null;
});
afterEach(async () => {
  host?.close();
  await host?.done;
  rmSync(dir, { recursive: true, force: true });
});

const pid = (): number => Number(readFileSync(join(dir, "pid"), "utf8"));
const seen = (): { pid: number; method: string | null; params: unknown }[] =>
  readFileSync(join(dir, "seen.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

/** A seat over the fake child, its client streams in hand, opened through `initialize` and the first tool list. */
async function opened(pacing: { firstMs: number; capMs: number; killMs?: number } = { firstMs: 5, capMs: 40 }) {
  const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
  host = ahoHost({ argv: [process.execPath, CHILD, dir], stdin, stdout, stderr, pacing });
  const client = wire((line) => stdin.write(line), stdout), log = ear(stderr);
  const init = await client.ask({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT });
  client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const listed = await client.ask({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  return { stdin, client, log, init, listed };
}

describe("the aho's Node binding, over a fake child", () => {
  it("seat-outlives-child: the child killed three times over leaves the seat open and the client's stream whole", async () => {
    const s = await opened();
    expect(s.init["result"]).toMatchObject({ serverInfo: { name: "fake-surface" }, capabilities: { tools: { listChanged: true } } });
    const pids = [pid()];
    for (let round = 2; round <= 4; round++) {
      process.kill(pids.at(-1)!, "SIGKILL");
      await s.log.heard(new RegExp(`child-standing generation=${round}\\b`));
      pids.push(pid());
      const said = JSON.parse(textOf(await s.client.ask({ jsonrpc: "2.0", id: `echo-${round}`, method: "tools/call", params: { name: "echo", arguments: { round } } })));
      expect(said).toEqual({ pid: pids.at(-1), arguments: { round } });
    }
    expect(new Set(pids).size).toBe(4);
    // The client read answers alone: no frame told it a child fell.
    expect(s.client.frames.filter((f) => f["method"] !== undefined)).toEqual([]);
    let ended = false;
    void host!.done.then(() => { ended = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(ended).toBe(false);
    s.stdin.end();
    expect(await host!.done).toBe(0);
    await until(() => !alive(pids.at(-1)!));
  });

  it("seat-resumes-without-reinit: each new child reads the client's own initialize from the seat, and the client sent it once", async () => {
    const s = await opened();
    const first = pid();
    process.kill(first, "SIGKILL");
    await s.log.heard(/child-standing generation=2\b/);
    const second = seen().filter((r) => r.pid !== first);
    expect(second.map((r) => r.method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
    expect(second[0]!.params).toEqual(INIT);
    expect(s.client.frames.filter((f) => (f["result"] as { serverInfo?: unknown } | undefined)?.serverInfo !== undefined)).toHaveLength(1);
  });

  it("seat-in-flight-unknown: a call in flight at the death answers `outcome-unknown` and no child reads it twice; a call with none standing answers `hearth-sleeps`", async () => {
    const s = await opened();
    const first = pid();
    const died = await s.client.ask({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "die", arguments: { text: MARK } } });
    expect(died["result"]).toMatchObject({ isError: true });
    expect(textOf(died)).toBe("outcome-unknown: re-read before re-trying");
    await s.log.heard(/child-standing generation=2\b/);
    expect(seen().filter((r) => r.method === "tools/call")).toEqual([{ pid: first, method: "tools/call", params: { name: "die", arguments: { text: MARK } } }]);
    // Hold the child down: it exits at each spawn, so none stands.
    writeFileSync(join(dir, "sleep"), "");
    process.kill(pid(), "SIGKILL");
    await s.log.heard(/child-down generation=2\b/);
    const asleep = await s.client.ask({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { text: MARK } } });
    expect(asleep["result"]).toMatchObject({ isError: true });
    expect(textOf(asleep)).toMatch(/^hearth-sleeps\b/);
    rmSync(join(dir, "sleep"));
    await s.log.heard(/child-standing generation=(?!1\b|2\b)\d+\b/);
    // The seat parked nothing: the child that woke read no call.
    expect(seen().filter((r) => r.method === "tools/call")).toHaveLength(1);
    expect(JSON.parse(textOf(await s.client.ask({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "echo", arguments: {} } })))).toMatchObject({ pid: pid() });
  });

  it("seat-lists-from-cache: with the child held down, the tool list and initialize answer as the child answered them", async () => {
    const s = await opened();
    writeFileSync(join(dir, "sleep"), "");
    process.kill(pid(), "SIGKILL");
    await s.log.heard(/child-down generation=1\b/);
    const cold = await s.client.ask({ jsonrpc: "2.0", id: 6, method: "tools/list" });
    expect(cold["result"]).toEqual(s.listed["result"]);
    expect((cold["result"] as { tools: { name: string }[] }).tools.map((t) => t.name)).toEqual(["echo", "hang", "die"]);
    expect((await s.client.ask({ jsonrpc: "2.0", id: 7, method: "initialize", params: INIT }))["result"]).toEqual(s.init["result"]);
  });

  it("seat-list-changed-on-new-tools: a child that wakes with another tool list draws one list_changed; a mere respawn draws none", async () => {
    const s = await opened();
    process.kill(pid(), "SIGKILL");
    await s.log.heard(/child-standing generation=2\b/);
    writeFileSync(join(dir, "tools.json"), JSON.stringify(["echo", "hang", "die", "fresh"]));
    process.kill(pid(), "SIGKILL");
    await s.client.next((f) => f["method"] === "notifications/tools/list_changed");
    const listed = await s.client.ask({ jsonrpc: "2.0", id: 8, method: "tools/list" });
    expect((listed["result"] as { tools: { name: string }[] }).tools.map((t) => t.name)).toEqual(["echo", "hang", "die", "fresh"]);
    process.kill(pid(), "SIGKILL");
    await s.log.heard(/child-standing generation=4\b/);
    expect(s.client.frames.filter((f) => f["method"] === "notifications/tools/list_changed")).toHaveLength(1);
  });

  it("seat-logs-no-payload: the seat's log names events and counts, and carries no byte of a call; CONTROL: the child read the marker", async () => {
    const s = await opened();
    expect(JSON.parse(textOf(await s.client.ask({ jsonrpc: "2.0", id: `${MARK}-id`, method: "tools/call", params: { name: "echo", arguments: { text: MARK } } })))).toMatchObject({ arguments: { text: MARK } });
    s.client.send({ jsonrpc: "2.0", id: `${MARK}-hang`, method: "tools/call", params: { name: "hang", arguments: { text: MARK } } });
    await until(() => seen().some((r) => r.method === "tools/call" && (r.params as { name?: string }).name === "hang"));
    process.kill(pid(), "SIGKILL");
    await s.client.next((f) => f["id"] === `${MARK}-hang`);
    s.stdin.write(`${MARK} not json\n`);
    await s.log.heard(/child-standing generation=2\b/);
    await s.log.heard(/frame-unparsed/);
    expect(s.log.text()).not.toContain(MARK);
    for (const line of s.log.text().trim().split("\n")) expect(line).toMatch(/^aho: [a-z-]+ generation=\d+ pending=\d+$/);
    expect(JSON.stringify(seen())).toContain(MARK);
  });
});

describe("the aho resolves its own child at each spawn", () => {
  it("harness-seat-records-the-lares-verb-alone: a resolver that names no child leaves the seat answering, and the child it names later stands; a resolver's new answer rides the next spawn", async () => {
    const other = mkdtempSync(join(tmpdir(), "mcp-aho-other-"));
    writeFileSync(join(other, "tools.json"), JSON.stringify(["echo"]));
    let child: { argv: string[] } | null = null;
    let asked = 0;
    const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
    host = ahoHost({ argv: () => { asked++; return child; }, stdin, stdout, stderr, pacing: { firstMs: 5, capMs: 40 } });
    const client = wire((line) => stdin.write(line), stdout), log = ear(stderr);
    try {
      // No child resolves: the seat answers the handshake itself and a call reads hearth-sleeps.
      const init = await client.ask({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT });
      expect(init["result"]).toMatchObject({ serverInfo: { name: "iris" } });
      client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      expect(textOf(await client.ask({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: {} } }))).toMatch(/^hearth-sleeps\b/);
      await log.heard(/child-unresolved/);
      child = { argv: [process.execPath, CHILD, dir] };
      await log.heard(/child-standing/);
      expect(JSON.parse(textOf(await client.ask({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: {} } })))).toMatchObject({ pid: pid() });
      // What stands beneath the verb changes; the next spawn reads the resolver again.
      child = { argv: [process.execPath, CHILD, other] };
      const before = asked;
      process.kill(pid(), "SIGKILL");
      await client.next((f) => f["method"] === "notifications/tools/list_changed");
      expect(asked).toBeGreaterThan(before);
      expect(Number(readFileSync(join(other, "pid"), "utf8"))).toBeGreaterThan(0);
    } finally {
      host.close(); await host.done; host = null;
      rmSync(other, { recursive: true, force: true });
    }
  });
});

describe("the binding bounds a child's death", () => {
  it("seat-child-death-bounded: a child that ignores the polite stop gets the hard kill inside the watchdog's wait, and a fresh child stands", async () => {
    writeFileSync(join(dir, "stubborn"), ""); writeFileSync(join(dir, "refuse"), "");
    const stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
    host = ahoHost({ argv: [process.execPath, CHILD, dir], stdin, stdout, stderr, pacing: { firstMs: 5, capMs: 40, killMs: 60 } });
    const client = wire((line) => stdin.write(line), stdout), log = ear(stderr);
    client.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT });
    // The stubborn child refuses the handshake; the seat stops it, and it ignores the stop.
    await log.heard(/handshake-refused/);
    const stubbornPid = pid();
    rmSync(join(dir, "stubborn")); rmSync(join(dir, "refuse"));
    await log.heard(/child-kill-escalated/);
    await until(() => !alive(stubbornPid));
    await log.heard(/child-standing/);
    expect(pid()).not.toBe(stubbornPid);
    expect(JSON.parse(textOf(await client.ask({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: {} } })))).toMatchObject({ pid: pid() });
  });

  it("seat-child-death-bounded: at the client's close a stubborn child still dies, by the hard kill", async () => {
    writeFileSync(join(dir, "stubborn"), "");
    const s = await opened({ firstMs: 5, capMs: 40, killMs: 60 });
    const stubbornPid = pid();
    expect(alive(stubbornPid)).toBe(true);
    s.stdin.end();
    expect(await host!.done).toBe(0);
    await until(() => !alive(stubbornPid));
  });
});

describe("`lares mcp aho` as a process", () => {
  it("the committed bin runs the seat: it answers through the fake child, outlives it, and exits 0 when the client closes", async () => {
    const proc = spawn(process.execPath, [BIN, "mcp", "aho", "--", process.execPath, CHILD, dir], { stdio: ["pipe", "pipe", "pipe"] });
    const client = wire((line) => proc.stdin.write(line), proc.stdout), log = ear(proc.stderr);
    const exit = new Promise<number | null>((done) => proc.on("exit", (code) => done(code)));
    try {
      const init = await client.ask({ jsonrpc: "2.0", id: 1, method: "initialize", params: INIT });
      expect(init["result"]).toMatchObject({ serverInfo: { name: "fake-surface" } });
      client.send({ jsonrpc: "2.0", method: "notifications/initialized" });
      await client.ask({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const first = pid();
      process.kill(first, "SIGKILL");
      await log.heard(/child-standing generation=2\b/);
      expect(JSON.parse(textOf(await client.ask({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", arguments: {} } }))).pid).not.toBe(first);
      expect(proc.exitCode).toBeNull();
      const last = pid();
      proc.stdin.end();
      expect(await exit).toBe(0);
      await until(() => !alive(last));
    } finally {
      if (proc.exitCode === null) proc.kill("SIGKILL");
      if (existsSync(join(dir, "pid")) && alive(pid())) process.kill(pid(), "SIGKILL");
    }
  });

  it("a seat named no child refuses by usage and exits 2", async () => {
    const proc = spawn(process.execPath, [BIN, "mcp", "aho", "--"], { stdio: ["ignore", "ignore", "pipe"] });
    const log = ear(proc.stderr);
    expect(await new Promise<number | null>((done) => proc.on("exit", (code) => done(code)))).toBe(2);
    expect(log.text()).toMatch(/lares mcp aho \[-- <child argv/);
  });
});
