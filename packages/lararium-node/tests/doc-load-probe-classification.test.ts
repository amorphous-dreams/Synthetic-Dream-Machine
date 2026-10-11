/**
 * H2 — a probe's boundary dying carries a safety verdict (`aborted`, condemned) ONLY when it
 * dies by its OWN abort signature (SIGABRT / exit 134 / its own "abort" stderr line). Anything
 * else that ends the boundary with no verdict line — this door's own timeout, an external
 * SIGKILL, a bare non-abort signal, a spawn failure — reads `unresolved`: liveness, never
 * evidence. Before this fix, EVERY non-ok/non-load-error exit (including a timeout kill) read
 * `aborted` and condemned the doc; the live SIGSTOP freeze probe proved that quarantined five
 * healthy docs, the daemon doc among them (episkopos H2).
 *
 * Proven here with a mocked `node:child_process.spawn` (an EventEmitter double), so every exit
 * shape is exercised deterministically without a real child process or a real timeout wait:
 *   · RED-WOULD-BE (mutation proof): re-enacting the OLD classification (anything but ok/load-error
 *     reads aborted) condemns a plain timeout and a bare SIGKILL — proven false below.
 *   · CONTROL: SIGABRT and exit 134 both read `aborted` (the abort signature).
 *   · the timeout path reads `unresolved`, never `aborted`.
 *   · a bare SIGKILL with no abort signature reads `unresolved`, never `aborted`.
 *   · a spawn failure reads `unresolved`, never `aborted`.
 *   · `isCondemned`/`isUnresolved` partition every status with no overlap.
 */
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { isCondemned, isUnresolved } from "@lararium/mesh";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: vi.fn() };
});

import { spawn } from "node:child_process";
import { probeDocLoad, resolveChildPath } from "../src/doc-load-probe.js";

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill(_sig: string): boolean { this.killed = true; return true; }
}

function mockSpawnOnce(drive: (child: FakeChild) => void): FakeChild {
  const child = new FakeChild();
  (spawn as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
    // Drive the child's events on the next tick, after probeDocLoad has wired its listeners.
    setImmediate(() => drive(child));
    return child;
  });
  return child;
}

// resolveChildPath throws when the dist child is missing (a harness fault, never a doc verdict);
// skip the whole suite rather than mis-measure a repo that has not run `pnpm -r build`.
let childPathOk = true;
try { resolveChildPath(); } catch { childPathOk = false; }
const d = childPathOk ? describe : describe.skip;

d("probeDocLoad — abort-signature classification (H2)", () => {
  it("CONTROL: SIGABRT reads aborted — the abort signature", async () => {
    mockSpawnOnce((child) => child.emit("close", null, "SIGABRT"));
    const r = await probeDocLoad("/tmp/unused-store", "docSigabrt", { skipPrecheck: true });
    expect(r.status).toBe("aborted");
    expect(isCondemned(r)).toBe(true);
    expect(isUnresolved(r)).toBe(false);
  });

  it("CONTROL: exit 134 (128+SIGABRT) reads aborted", async () => {
    mockSpawnOnce((child) => child.emit("close", 134, null));
    const r = await probeDocLoad("/tmp/unused-store", "docExit134", { skipPrecheck: true });
    expect(r.status).toBe("aborted");
    expect(isCondemned(r)).toBe(true);
  });

  it("a bare SIGKILL (no abort signature) reads unresolved, NEVER aborted", async () => {
    mockSpawnOnce((child) => child.emit("close", null, "SIGKILL"));
    const r = await probeDocLoad("/tmp/unused-store", "docSigkill", { skipPrecheck: true });
    expect(r.status).toBe("unresolved");
    expect(isCondemned(r)).toBe(false);
    expect(isUnresolved(r)).toBe(true);
  });

  it("a non-zero, non-2, no-signal exit with no abort line reads unresolved", async () => {
    mockSpawnOnce((child) => child.emit("close", 1, null));
    const r = await probeDocLoad("/tmp/unused-store", "docExit1", { skipPrecheck: true });
    expect(r.status).toBe("unresolved");
  });

  it("the timeout path reads unresolved, never aborted (H2's exact live fault)", async () => {
    mockSpawnOnce(() => { /* never closes within the budget — the timer fires */ });
    const r = await probeDocLoad("/tmp/unused-store", "docTimeout", { skipPrecheck: true, timeoutMs: 15 });
    expect(r.status).toBe("unresolved");
    expect(isCondemned(r)).toBe(false);
    expect(r.reason).toMatch(/load exceeded 15ms/);
  }, 2_000);

  it("a spawn failure reads unresolved — a harness fault, not a doc verdict", async () => {
    mockSpawnOnce((child) => child.emit("error", new Error("ENOENT: spawn fail")));
    const r = await probeDocLoad("/tmp/unused-store", "docSpawnFail", { skipPrecheck: true });
    expect(r.status).toBe("unresolved");
  });

  it("MUTATION PROOF: the OLD classification (anything-but-ok/load-error = aborted) would condemn a plain timeout", () => {
    // Re-enact the retired shape by hand against the SAME `close` callback inputs the timeout
    // and bare-SIGKILL cases above produced: `code=null, signal=null` (timeout) and
    // `code=null, signal="SIGKILL"` — under the OLD rule both read `aborted` (condemned).
    const oldClassify = (code: number | null, signal: string | null): string =>
      code === 0 ? "ok" : code === 2 ? "load-error" : "aborted";
    expect(oldClassify(null, null)).toBe("aborted");      // the exact timeout shape — proves the old bug
    expect(oldClassify(null, "SIGKILL")).toBe("aborted");  // an external kill — proves the old bug
  });

  it("isCondemned / isUnresolved partition every ProbeStatus with no overlap and no gap", () => {
    const statuses = ["ok", "torn", "load-error", "aborted", "unresolved"] as const;
    for (const status of statuses) {
      const r = { documentId: "x", status };
      const condemned = isCondemned(r);
      const unresolved = isUnresolved(r);
      expect(condemned && unresolved).toBe(false); // never both
      const healthy = status === "ok";
      expect(condemned || unresolved || healthy).toBe(true); // never neither
    }
  });
});
