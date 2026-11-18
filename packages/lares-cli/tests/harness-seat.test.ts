/**
 * harness-seat.test — an AI shell's CLI line carries the seat's mark (seat-canon-reach, T4-2). A spirit that runs `lares meme
 * put --bag lares` through its harness's shell must meet the same gate the MCP seat meets, so the CLI writes `seat: "ai"` on
 * its one-shot line whenever the harness's OWN mark stands in its environment: Claude Code's `CLAUDECODE=1`, and Codex's
 * sandbox marks (`CODEX_SANDBOX`, `CODEX_SANDBOX_NETWORK_DISABLED`). The house mints no variable of its own for this. The
 * operator's own terminal carries none, and its line carries no seat (CONTROL).
 */
import { afterEach, describe, expect, test } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as connector from "../src/local-connector.js";
import { invokeLocal, udsSocketPath } from "../src/local-connector.js";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => { for (const c of cleanups.splice(0).reverse()) await c(); });

/** A socket at a scratch data dir that records each line and answers `done`. */
async function vessel(): Promise<{ dataDir: string; lines: Array<Record<string, unknown>> }> {
  const dataDir = mkdtempSync(join(tmpdir(), "harness-seat-"));
  const lines: Array<Record<string, unknown>> = [];
  const server: Server = createServer((sock) => {
    sock.setEncoding("utf8");
    let buf = "";
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = JSON.parse(buf.slice(0, nl)) as Record<string, unknown>;
      lines.push(line);
      sock.end(JSON.stringify({ requestId: line["requestId"], status: "done", results: {} }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(udsSocketPath(dataDir), resolve));
  cleanups.push(() => new Promise<void>((resolve) => server.close(() => resolve())), () => rmSync(dataDir, { recursive: true, force: true }));
  return { dataDir, lines };
}

describe("the harness's own mark makes the CLI's asker the seat", () => {
  test("RED: the CLI reads Claude Code's and Codex's own marks; CONTROL: an unmarked shell, or a mark set off, reads none", () => {
    const marked = (connector as unknown as { harnessSeatMarked?: (env: NodeJS.ProcessEnv) => boolean }).harnessSeatMarked;
    expect(typeof marked).toBe("function");
    expect(marked!({ CLAUDECODE: "1" })).toBe(true);
    expect(marked!({ CODEX_SANDBOX: "seatbelt" })).toBe(true);
    expect(marked!({ CODEX_SANDBOX_NETWORK_DISABLED: "1" })).toBe(true);
    expect(marked!({})).toBe(false);
    expect(marked!({ CLAUDECODE: "0" })).toBe(false);
    expect(marked!({ CLAUDECODE: "" , CODEX_SANDBOX: "" })).toBe(false);
  });

  test("RED: the suite clears every harness mark from its own environment, so a run inside an AI harness reads as CI does: a line naming no env sends no seat", async () => {
    const marks = (connector as unknown as { HARNESS_SEAT_MARKS?: readonly string[] }).HARNESS_SEAT_MARKS;
    expect(marks).toBeDefined();
    for (const mark of marks!) expect(process.env[mark], mark).toBeUndefined();
    const v = await vessel();
    await invokeLocal("meme-put", { bag: "lares" }, "0xme", { dataDir: v.dataDir });
    expect(v.lines[0]).not.toHaveProperty("seat");
  });

  test("RED: under the harness's mark the one-shot line carries seat ai; CONTROL: the operator's terminal sends none", async () => {
    const v = await vessel();
    await invokeLocal("meme-put", { bag: "lares" }, "0xme", { dataDir: v.dataDir, env: { CLAUDECODE: "1" } } as never);
    await invokeLocal("meme-put", { bag: "lares" }, "0xme", { dataDir: v.dataDir, env: {} } as never);
    expect(v.lines.map((l) => l["seat"])).toEqual(["ai", undefined]);
  });
});
