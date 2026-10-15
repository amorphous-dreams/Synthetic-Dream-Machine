/**
 * harness/stop-child — a stop returns on the child's EXIT, never on a pause.
 *
 * The daemon flushes its stores on SIGTERM and only then exits, so a stop that returns before the exit hands
 * the next stand a store still being written. Each child here writes a marker on its way out: a stop that
 * returned early reads the marker absent.
 */
import { describe, test, expect } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stopChild } from "./instance.js";

/** A child that answers SIGTERM by flushing for `flushMs`, writing `marker`, then exiting — or ignores it. */
function child(marker: string, flushMs: number, ignoreTerm = false) {
  const src = ignoreTerm
    ? `process.on("SIGTERM", () => {}); process.send?.("up"); setInterval(() => {}, 1000);`
    : `process.on("SIGTERM", () => setTimeout(() => { require("node:fs").writeFileSync(${JSON.stringify(marker)}, "flushed"); process.exit(0); }, ${flushMs}));
       process.send?.("up"); setInterval(() => {}, 1000);`;
  const c = spawn(process.execPath, ["-e", src], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const up = new Promise<void>((resolve) => c.once("message", () => resolve()));
  return { c, up };
}

describe("stopChild — the exit is the barrier", () => {
  test("returns only after a flushing child has written its last byte and exited", async () => {
    const dir = mkdtempSync(join(tmpdir(), "stop-child-"));
    try {
      const marker = join(dir, "flushed");
      const { c, up } = child(marker, 400);
      await up;
      await stopChild(c);
      expect(existsSync(marker)).toBe(true);
      expect(c.exitCode).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a child that outlives the grace meets SIGKILL, and the stop still ends on its exit", async () => {
    const { c, up } = child("", 0, true);
    await up;
    await stopChild(c, 200);
    expect(c.signalCode).toBe("SIGKILL");
  });

  test("CONTROL: a child already gone returns at once", async () => {
    const { c, up } = child("", 0);
    await up;
    c.kill("SIGKILL");
    await new Promise<void>((resolve) => c.once("exit", () => resolve()));
    await stopChild(c);
    expect(c.signalCode).toBe("SIGKILL");
  });
});
