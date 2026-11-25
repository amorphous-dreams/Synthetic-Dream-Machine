/**
 * session-open-seat-mark — a CLI run under the seat mark opens its session as the seat (hitl-reads-a-hand).
 *
 * Inside the container house an exec'd process has no parent to walk, so the socket's peer reading cannot see a harness on the
 * host; the host forwarder carries the harness across as the seat mark (`CLAUDECODE=1`). A one-shot line already reads that
 * mark (`seat: "ai"`); a session opened by a store-door or verb call named `hand: "cli"` regardless, so a marked run's session call
 * (`wiki retire`, a lei, a kapae) booked `cli`. CONTROL: an unmarked run opens as the hand its caller names.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { udsSocketPath } from "../src/local-connector.js";
import { openLocalSession } from "../src/session-connector.js";

const cleanups: Array<() => void> = [];
afterEach(() => { for (const c of cleanups.splice(0)) c(); delete process.env["CLAUDECODE"]; });

/** A socket that records the first frame it reads and refuses it, so the open ends at once. */
async function door(): Promise<{ dir: string; frames: Array<Record<string, unknown>> }> {
  const dir = mkdtempSync(join(tmpdir(), "session-open-mark-"));
  const frames: Array<Record<string, unknown>> = [];
  const server: Server = createServer((sock) => {
    sock.setEncoding("utf8");
    sock.once("data", (chunk: string) => {
      const frame = JSON.parse(chunk.split("\n")[0]!) as Record<string, unknown>;
      frames.push(frame);
      sock.write(JSON.stringify({ kind: "session:refused", requestId: frame["requestId"], refusal: "probe" }) + "\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(udsSocketPath(dir), resolve));
  cleanups.push(() => { server.close(); rmSync(dir, { recursive: true, force: true }); });
  return { dir, frames };
}

describe("a session opened under the seat mark opens as the seat", () => {
  test("RED: a marked run that names hand cli opens hand seat", async () => {
    const d = await door();
    process.env["CLAUDECODE"] = "1";
    await openLocalSession({ faceRef: "h0", hand: "cli", dataDir: d.dir }).catch(() => {});
    expect(d.frames[0]).toMatchObject({ op: "session:open", hand: "seat" });
  });

  test("CONTROL: an unmarked run opens as the hand its caller names", async () => {
    const d = await door();
    await openLocalSession({ faceRef: "h0", hand: "cli", dataDir: d.dir }).catch(() => {});
    expect(d.frames[0]).toMatchObject({ op: "session:open", hand: "cli" });
  });
});
