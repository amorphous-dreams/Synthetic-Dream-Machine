/**
 * receipt-patience.test.ts — M13: `queryReceipt`/`cancelRequest` carry their OWN monotonic patience.
 *
 * Before this, a frozen or wedged vessel that accepted the connection but never answered a
 * `{op:"receipt"}`/`{op:"cancel"}` line hung the caller FOREVER — `act.ts`'s own `READBACK_MS = 2_000`
 * comment claimed "a 2000ms read found no receipt yet" while nothing in `queryReceipt` enforced any
 * such bound. This suite stands a bare listener that accepts the connection and never writes a byte
 * back (the exact frozen-peer shape M13 names), and proves the read gives up on its OWN schedule —
 * `performance.now()`-timed, never `Date.now()` — destroying the socket and answering
 * `{state:"unanswered"}` rather than hanging.
 *
 * CONTROL: a listener that answers promptly, WITHIN the patience window, still reads its real answer
 * — the patience only bites a peer that never answers at all.
 */
import { describe, test, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendezvousPath } from "@lararium/mesh/rendezvous-path";
import { queryReceipt, cancelRequest } from "../src/local-connector.js";

let dir: string;
let server: Server | undefined;
let liveSockets: Set<{ destroy: () => void }> = new Set();

afterEach(async () => {
  for (const s of liveSockets) { try { s.destroy(); } catch { /* already gone */ } }
  liveSockets = new Set();
  if (server) { await new Promise<void>((r) => server!.close(() => r())); server = undefined; }
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function freshDataDir(): string {
  dir = mkdtempSync(join(tmpdir(), "receipt-patience-"));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function socketPathFor(dataDir: string): string {
  return rendezvousPath({ root: dataDir, uid: process.getuid?.() ?? 0 });
}

/** A listener that accepts the connection and then never writes a byte back — frozen/wedged. Tracks
 *  its own live sockets so teardown can destroy them explicitly rather than wait on the client's own
 *  RST to propagate before `server.close()`'s callback is allowed to fire. */
async function standFrozenListener(socketPath: string): Promise<Server> {
  const srv = createServer((sock) => {
    liveSockets.add(sock);
    sock.on("error", () => { /* caller destroyed us — expected */ });
    sock.on("close", () => { liveSockets.delete(sock); });
  });
  await new Promise<void>((resolve, reject) => { srv.once("error", reject); srv.listen(socketPath, resolve); });
  return srv;
}

/** A listener that answers `{requestId, state:"done"}` the instant a line arrives. */
async function standPromptListener(socketPath: string): Promise<Server> {
  const srv = createServer((sock) => {
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("data", (c: string) => {
      buf += c;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const req = JSON.parse(buf.slice(0, nl)) as { requestId: string };
      sock.end(JSON.stringify({ requestId: req.requestId, state: "done", results: { ok: true } }) + "\n");
    });
  });
  await new Promise<void>((resolve, reject) => { srv.once("error", reject); srv.listen(socketPath, resolve); });
  return srv;
}

describe("queryReceipt / cancelRequest — THIS caller's own monotonic read patience (M13)", () => {
  test("★ RED→cure: a frozen peer resolves `unanswered` within patienceMs, never hangs ★", async () => {
    const dataDir = freshDataDir();
    server = await standFrozenListener(socketPathFor(dataDir));
    const t0 = performance.now();
    const answer = await queryReceipt("req-frozen-1", { dataDir, patienceMs: 150 });
    const elapsed = performance.now() - t0;
    expect(answer).toEqual({ requestId: "req-frozen-1", state: "unanswered" });
    // Patient within a generous margin, never instant (proves the timer actually gated the answer)
    // and never wildly over (proves it didn't silently fall back to some OTHER larger default).
    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(elapsed).toBeLessThan(2_000);
  });

  test("cancelRequest carries the SAME patience shape over a frozen peer", async () => {
    const dataDir = freshDataDir();
    server = await standFrozenListener(socketPathFor(dataDir));
    const answer = await cancelRequest("req-frozen-2", { dataDir, patienceMs: 150 });
    expect(answer).toEqual({ requestId: "req-frozen-2", state: "unanswered" });
  });

  test("CONTROL — a peer that answers PROMPTLY, within patienceMs, reads its real answer", async () => {
    const dataDir = freshDataDir();
    server = await standPromptListener(socketPathFor(dataDir));
    const answer = await queryReceipt("req-prompt-1", { dataDir, patienceMs: 2_000 });
    expect(answer).toEqual({ requestId: "req-prompt-1", state: "done", results: { ok: true } });
  });

  test("CONTROL — with no listener at all, the call rejects (UdsUnreachable) rather than waiting out the patience", async () => {
    const dataDir = freshDataDir(); // never stood a listener
    const t0 = performance.now();
    await expect(queryReceipt("req-absent", { dataDir, patienceMs: 5_000 })).rejects.toThrow();
    // ENOENT/ECONNREFUSED fire near-instantly — proves an absent socket never pays the full patience.
    expect(performance.now() - t0).toBeLessThan(1_000);
  });

  test("default patienceMs matches the 2000ms `act.ts` README text (no opts passed)", async () => {
    const dataDir = freshDataDir();
    server = await standFrozenListener(socketPathFor(dataDir));
    const t0 = performance.now();
    const answer = await queryReceipt("req-default", { dataDir });
    const elapsed = performance.now() - t0;
    expect(answer.state).toBe("unanswered");
    expect(elapsed).toBeGreaterThanOrEqual(1_900);
    expect(elapsed).toBeLessThan(3_000);
  }, 5_000);
});
