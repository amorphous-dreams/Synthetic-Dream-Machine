/**
 * whoHolds — a probe answer that says `serving` reads SERVING, never PARKED; a park's answer still reads parked.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { udsSocketPath, whoHolds } from "../src/local-connector.js";

const open: { server: Server; dir: string }[] = [];
afterEach(async () => {
  for (const { server, dir } of open.splice(0)) { await new Promise<void>((resolve) => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); }
});
async function holderAnswering(line: Record<string, unknown>): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "who-holds-"));
  const path = udsSocketPath(dir);
  const server = createServer((sock) => { sock.once("data", () => { sock.end(JSON.stringify(line) + "\n"); }); });
  await new Promise<void>((resolve) => server.listen(path, () => resolve()));
  open.push({ server, dir });
  return dir;
}

describe("whoHolds reads the live seat as serving", () => {
  it("RED: an answer that says serving reads serving, with the oldest ask in flight", async () => {
    const dir = await holderAnswering({ holder: "vessel", serving: true, pid: 7, inFlight: 1, oldest: { requestId: "req-1", verb: "seal" }, held: true, errorMessage: "the vessel (pid 7) serves the store" });
    const met = await whoHolds(dir, undefined, "req-1");
    expect(met?.phase).toBe("serving");
    expect(met?.oldest).toEqual({ requestId: "req-1", verb: "seal" });
    expect(met?.inFlight).toBe(1);
    expect(met?.held).toBe(true);
  });

  it("CONTROL: a park's answer (no serving word) still reads parked", async () => {
    const dir = await holderAnswering({ status: "error", errorMessage: "a vessel (pid 7) holds the store at /tmp/x", holder: "vessel" });
    expect((await whoHolds(dir))?.phase).toBe("parked");
  });
});
