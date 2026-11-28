/**
 * closed-stream — a write to a stream whose reader left ends the command with a named line, never a Node crash.
 *
 * Measured (2026-11-28): `lares rite keep --if-due`, run under the shim's keep (stderr through a fifo to a tee), crashed on a
 * broken pipe (`Error: write EPIPE`, `syscall: 'write'`, Node v24): an 'error' event on process.stderr with no listener
 * becomes an uncaught exception. The guard listens on both stdio streams: an EPIPE names the closed stream once on the other
 * one (where it still takes writes), the command's own work finishes (no act tears mid-way), and the exit reads 141 (the
 * broken-pipe exit, 128 + SIGPIPE) instead of a crash. Any other stream error still throws.
 */
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { BROKEN_PIPE_EXIT, guardClosedStreams, exitAfterStreams } from "../src/closed-stream.js";

class FakeStream extends EventEmitter {
  readonly lines: string[] = [];
  writable = true;
  write(chunk: string): boolean { if (!this.writable) throw new Error("write after end"); this.lines.push(chunk); return true; }
}

const epipe = (): NodeJS.ErrnoException => Object.assign(new Error("write EPIPE"), { code: "EPIPE", syscall: "write", errno: -32 });

describe("guardClosedStreams", () => {
  it("RED: an EPIPE on stderr crashes nothing, names the closed stream on stdout once, and the exit reads 141", () => {
    const out = new FakeStream(), err = new FakeStream();
    const guard = guardClosedStreams([{ name: "stdout", stream: out }, { name: "stderr", stream: err }]);
    expect(() => { err.writable = false; err.emit("error", epipe()); err.emit("error", epipe()); }).not.toThrow();
    expect(guard.closed()).toBe("stderr");
    expect(out.lines.filter((l) => /stderr closed/.test(l))).toHaveLength(1);
    expect(exitAfterStreams(guard, 0)).toBe(BROKEN_PIPE_EXIT);
    expect(BROKEN_PIPE_EXIT).toBe(141);
  });

  it("RED: with both streams closed the guard writes nowhere and still crashes nothing", () => {
    const out = new FakeStream(), err = new FakeStream();
    const guard = guardClosedStreams([{ name: "stdout", stream: out }, { name: "stderr", stream: err }]);
    out.writable = false; err.writable = false;
    expect(() => { out.emit("error", epipe()); err.emit("error", epipe()); }).not.toThrow();
    expect(guard.closed()).toBe("stdout");
    expect(out.lines).toHaveLength(0);
    expect(err.lines).toHaveLength(0);
  });

  it("CONTROL: with no stream closed the command's own exit stands; another stream error still throws", () => {
    const out = new FakeStream(), err = new FakeStream();
    const guard = guardClosedStreams([{ name: "stdout", stream: out }, { name: "stderr", stream: err }]);
    expect(exitAfterStreams(guard, 3)).toBe(3);
    expect(() => out.emit("error", Object.assign(new Error("boom"), { code: "EIO" }))).toThrow(/boom/);
  });
});
