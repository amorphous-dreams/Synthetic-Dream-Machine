/**
 * uds-front — THE LIVE SEAT ANSWERS THE HOLDER PROBE AS SERVING, naming the oldest ask it holds in flight.
 *
 * A caller that probed a serving vessel (`{holder:"?"}`) got the seat's answer to a line with no verb, and the CLI read
 * any answered line as a vessel PARKED mid-boot, then spent a parked budget and refused "no discoverable holder" against
 * a vessel that served the whole time, its act waiting behind a long island walk. The front now answers the probe
 * itself, at once and dispatching nothing: `serving` with the asks in flight and the oldest one's request id, so the
 * caller waits on the vessel's own answer and names whose act it waits behind.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection, type Socket } from "node:net";
import { claimStore } from "../src/owned-store.js";
import { serveUdsFront } from "../src/uds-channel.js";

const dirs: string[] = [];
const sockets: Socket[] = [];
afterEach(() => {
  for (const sock of sockets.splice(0)) sock.destroy();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
/** Send one line; resolve with the first line the front answers. */
function ask(path: string, frame: unknown, keepOpen = false): Promise<{ sock: Socket; line: Promise<Record<string, unknown>> }> {
  const sock = createConnection(path);
  sockets.push(sock);
  sock.setEncoding("utf8");
  let data = "";
  const line = new Promise<Record<string, unknown>>((resolve) => {
    sock.on("data", (chunk: string) => { data += chunk; const nl = data.indexOf("\n"); if (nl !== -1) resolve(JSON.parse(data.slice(0, nl)) as Record<string, unknown>); });
  });
  return new Promise((resolve, reject) => {
    sock.once("connect", () => { sock.write(JSON.stringify(frame) + "\n", (err) => (err ? reject(err) : resolve({ sock, line }))); });
    sock.once("error", (err) => { if (!keepOpen) reject(err); });
  });
}

describe("the live seat answers the holder probe as serving", () => {
  test("RED: a seated front answers the probe `serving`, naming the oldest ask's verb, its id to its own asker alone, and hands the probe to no seat", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uds-probe-"));
    dirs.push(dir);
    const claim = await claimStore(dir, { holder: "vessel" });
    const front = serveUdsFront({ claim });
    const seen: unknown[] = [];
    let reached!: () => void;
    const handed = new Promise<void>((resolve) => { reached = resolve; });
    // A seat that holds every verb in flight and never answers: an act waiting behind a long island walk.
    front.attach({ handle: (parsed) => { seen.push(parsed); reached(); }, close: () => {} });
    await ask(claim.socketPath, { verb: "tiddler-put", args: {}, requestId: "req-oldest" }, true);
    await handed;
    const stranger = await (await ask(claim.socketPath, { holder: "?" })).line;
    expect(stranger["serving"]).toBe(true);
    expect(stranger["holder"]).toBe("vessel");
    expect(stranger["inFlight"]).toBe(1);
    expect(stranger["oldest"]).toEqual({ verb: "tiddler-put" });
    expect(stranger["held"]).toBeUndefined();
    expect(String(stranger["errorMessage"])).not.toContain("req-oldest");
    const own = await (await ask(claim.socketPath, { holder: "?", requestId: "req-oldest" })).line;
    expect(own["oldest"]).toEqual({ verb: "tiddler-put", requestId: "req-oldest" });
    expect(own["held"]).toBe(true);
    const gone = await (await ask(claim.socketPath, { holder: "?", requestId: "req-never-sent" })).line;
    expect(gone["held"]).toBe(false);
    expect(seen).toEqual([{ verb: "tiddler-put", args: {}, requestId: "req-oldest" }]);
    await front.close();
  });

  test("RED: an ask leaves the count once the seat writes its answer frame, though its socket stays open (an idle session holds none)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uds-probe-"));
    dirs.push(dir);
    const claim = await claimStore(dir, { holder: "vessel" });
    const front = serveUdsFront({ claim });
    let answer!: (sock: Socket) => void;
    const handed = new Promise<Socket>((resolve) => { answer = resolve; });
    front.attach({ handle: (_parsed, sock) => { answer(sock); }, close: () => {} });
    const caller = await ask(claim.socketPath, { verb: "seal", args: {}, requestId: "req-answered" }, true);
    const seatSock = await handed;
    expect((await (await ask(claim.socketPath, { holder: "?", requestId: "req-answered" })).line)["held"]).toBe(true);
    // The seat answers on a socket it keeps open, as a session answers each act.
    seatSock.write(JSON.stringify({ kind: "session:result", requestId: "req-answered", status: "done" }) + "\n");
    await caller.line;
    const after = await (await ask(claim.socketPath, { holder: "?", requestId: "req-answered" })).line;
    expect(after["held"]).toBe(false);
    expect(after["inFlight"]).toBe(0);
    expect(after["oldest"]).toBeNull();
    await front.close();
  });

  test("CONTROL: an unseated front (a recomposition) answers the probe held, not serving", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uds-probe-"));
    dirs.push(dir);
    const claim = await claimStore(dir, { holder: "vessel" });
    const front = serveUdsFront({ claim });
    const answer = await (await ask(claim.socketPath, { holder: "?" })).line;
    expect(answer["serving"]).toBe(false);
    expect(answer["holder"]).toBe("vessel");
    await front.close();
  });
});
