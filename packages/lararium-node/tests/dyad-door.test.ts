/**
 * The node dyad door asks the vessel's main thread for its live fleet-edge standing.
 * The browser daemon island reads its own fleet board; the tab reads that board for sibling sync.
 *
 *   D1 no door answers aside. control: clear and all four valid standings pass through unchanged.
 *   D2 throws, an unknown standing, and a non-string ask field answer aside. control: a valid ask returns the door's standing.
 *   D3 only a same-request-id answer settles; silence and unknown standings answer aside. control: concurrent asks settle independently.
 *   D4 daemon asks reach the door. control: wiki asks answer aside and log DyadDoorRefused once; session asks draw no answer.
 *   D5 each protocol guard accepts its own dyad message and refuses the opposite direction.
 *   D6 the node folds its worn fleet and hangs its door before daemon boot.
 *   D7 the browser tab keeps sibling sync current while the daemon island resolves its own board reader.
 */
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isIslandToVesselMsg, isVesselToIslandMsg, type EdgeStanding } from "@lararium/mesh";
import { vesselDyadAsker } from "../src/sovereign-island-model.js";
import { answerDyadAsk, nodeWorkerHandle, setDyadDoor } from "../src/worker-handle.js";

const standings: EdgeStanding[] = ["clear", "aside", "owing", "returned"];

function portPair() {
  const island = new EventEmitter();
  const posted: Array<Record<string, unknown>> = [];
  const port = {
    postMessage: (msg: unknown) => { posted.push(msg as Record<string, unknown>); },
    on: (ev: "message", fn: (m: unknown) => void) => { island.on(ev, fn); },
  };
  return { island, posted, port };
}

type Worker = Parameters<typeof nodeWorkerHandle>[0];
function fakeWorker() {
  const emitter = new EventEmitter();
  const said: Array<Record<string, unknown>> = [];
  const worker = Object.assign(emitter, {
    postMessage: (msg: unknown) => { said.push(msg as Record<string, unknown>); },
    terminate: async () => 0,
  }) as unknown as Worker;
  return {
    worker, said,
    async ask(msg: unknown) { emitter.emit("message", msg); await new Promise((resolve) => setTimeout(resolve, 10)); },
  };
}

const ask = (requestId: string, fleetRoot: unknown = "fleet", deviceKey: unknown = "device") => ({
  type: "dyad:ask", requestId, fleetRoot, deviceKey,
});

afterEach(() => { setDyadDoor(null); vi.restoreAllMocks(); });

describe("the dyad door", () => {
  test("D1 — missing door reads aside; each valid standing passes through", async () => {
    await expect(answerDyadAsk({ requestId: "none", fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing: "aside" });
    setDyadDoor((_fleet, _device) => "clear");
    await expect(answerDyadAsk({ requestId: "clear", fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing: "clear" }); // control
    for (const standing of standings) {
      setDyadDoor(() => standing);
      await expect(answerDyadAsk({ requestId: standing, fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing });
    }
  });

  test("D2 — faults and malformed readings fail closed; a valid ask reaches its door", async () => {
    setDyadDoor(() => { throw new Error("closed"); });
    await expect(answerDyadAsk({ requestId: "throws", fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing: "aside" });
    setDyadDoor(() => "fifth" as EdgeStanding);
    await expect(answerDyadAsk({ requestId: "fifth", fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing: "aside" });
    await expect(answerDyadAsk({ requestId: "bad", fleetRoot: 5, deviceKey: "device" } as never)).resolves.toMatchObject({ standing: "aside" });
    setDyadDoor(() => "owing");
    await expect(answerDyadAsk({ requestId: "good", fleetRoot: "fleet", deviceKey: "device" })).resolves.toMatchObject({ standing: "owing" }); // control
  });

  test("D3 — correlation, timeout, invalid reply, and concurrent asks", async () => {
    const w = portPair();
    const read = vesselDyadAsker(w.port, 30);
    const one = read("fleet-a", "device-a");
    const two = read("fleet-b", "device-b");
    const firstId = String(w.posted[0]?.["requestId"]);
    const secondId = String(w.posted[1]?.["requestId"]);
    let firstSettled = false;
    void one.then(() => { firstSettled = true; });
    w.island.emit("message", { type: "dyad:read", requestId: "other-request", standing: "returned" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstSettled).toBe(false); // control: another request id settles nothing
    w.island.emit("message", { type: "dyad:read", requestId: secondId, standing: "owing" });
    w.island.emit("message", { type: "dyad:read", requestId: firstId, standing: "clear" });
    await expect(Promise.all([one, two])).resolves.toEqual(["clear", "owing"]); // control: each ask gets its own answer
    await expect(vesselDyadAsker(portPair().port, 30)("fleet", "device")).resolves.toBe("aside");
    const invalid = portPair();
    const invalidRead = vesselDyadAsker(invalid.port, 30)("fleet", "device");
    invalid.island.emit("message", { type: "dyad:read", requestId: invalid.posted[0]?.["requestId"], standing: "fifth" });
    await expect(invalidRead).resolves.toBe("aside");
  });

  test("D4 — worker class controls dyad door access", async () => {
    setDyadDoor(() => "clear");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const daemon = fakeWorker();
    nodeWorkerHandle(daemon.worker, { island: "daemon" });
    await daemon.ask(ask("daemon-1"));
    expect(daemon.said.map((m) => [m["type"], m["standing"]])).toEqual([["dyad:read", "clear"]]); // control

    const wiki = fakeWorker();
    nodeWorkerHandle(wiki.worker, { island: "wiki" });
    await wiki.ask(ask("wiki-1"));
    await wiki.ask(ask("wiki-2"));
    expect(wiki.said.map((m) => [m["type"], m["standing"]])).toEqual([["dyad:read", "aside"], ["dyad:read", "aside"]]);
    expect(warn.mock.calls.filter((call) => /DyadDoorRefused/.test(String(call[0])))).toHaveLength(1);

    const session = fakeWorker();
    nodeWorkerHandle(session.worker, { island: "session" });
    await session.ask(ask("session-1"));
    expect(session.said).toEqual([]);
  });

  test("D5 — protocol guards accept only their dyad direction", () => {
    const dyadAsk = ask("ask-1");
    const dyadRead = { type: "dyad:read", requestId: "read-1", standing: "clear" };
    expect(isIslandToVesselMsg(dyadAsk)).toBe(true); // control: ask belongs to island → vessel
    expect(isVesselToIslandMsg(dyadRead)).toBe(true); // control: read belongs to vessel → island
    expect(isVesselToIslandMsg(dyadAsk)).toBe(false);
    expect(isIslandToVesselMsg(dyadRead)).toBe(false);
  });

  test("D6 — the composition folds the worn fleet and stands the door before its island boots (a source weld)", () => {
    const src = readFileSync(join(__dirname, "..", "src", "open-node-vessel.ts"), "utf8");
    // presence first: an ordering over an absent call passes vacuously
    expect((src.match(/^\s*setDyadDoor\(async \(fleetRoot, deviceKey\) => \{$/gm) ?? []).length).toBe(1);
    expect((src.match(/daemonVm = await openDaemonVm\(/g) ?? []).length).toBe(1);
    const fold = src.indexOf("wornFleetRoot = edgeFleetRoot;\n      await shadowRing.refold();");
    const door = src.indexOf("setDyadDoor(async (fleetRoot, deviceKey) => {");
    const boot = src.indexOf("daemonVm = await openDaemonVm(");
    expect(fold).toBeGreaterThan(0);
    expect(fold).toBeLessThan(door);
    expect(door).toBeLessThan(boot);
    // the ring folds the worn fleet at every standing, the floor included
    expect(src).toMatch(/if \(wornFleetRoot\) roots\.add\(wornFleetRoot\);/);
    // the door answers off the ring, waits on a fold where the reading went dark, and drops at teardown
    expect(src).toMatch(/return shadowRing\.deviceStanding\(fleetRoot, deviceKey\);/);
    expect(src).toMatch(/try \{ await shadowRing\.refold\(\); \} catch \{ return "aside"; \}/);
    expect(src).toMatch(/for \(let tries = 0; tries < 3 && !shadowRing\.fold\(\); tries\+\+\) \{/);
    expect(src).toMatch(/down: \(\) => setDyadDoor\(null\)/);
  });

  test("D7 — the leaf reads its fleet board for sibling sync while the daemon island reads its own board for dyad standing (a source weld)", () => {
    const src = readFileSync(join(__dirname, "..", "..", "lararium-browser", "src", "open-browser-vessel.ts"), "utf8");
    const island = readFileSync(join(__dirname, "..", "..", "lararium-browser", "src", "browser-daemon-island.ts"), "utf8");
    const behavior = readFileSync(join(__dirname, "..", "..", "lararium-keyhive", "src", "operator-daemon-behavior.ts"), "utf8");
    const boardReader = readFileSync(join(__dirname, "..", "..", "lararium-keyhive", "src", "board-dyad-reader.ts"), "utf8");

    // The tab attaches a worker handle without hanging a dyad door on it.
    expect(src).not.toMatch(/attachBrowserDyadDoor|dyadDoor/);
    expect((src.match(/daemon = await openBrowserDaemonVm\(/g) ?? []).length).toBe(1);
    const spawnStart = src.indexOf("spawnWorker: (url) => {");
    const spawnEnd = src.indexOf("recipe: { wikiSlug: \"daemon\" }", spawnStart);
    expect(spawnStart).toBeGreaterThan(0);
    expect(spawnEnd).toBeGreaterThan(spawnStart);
    const spawn = src.slice(spawnStart, spawnEnd);
    expect(spawn).toContain("return handle;");
    expect(spawn).not.toMatch(/attachBrowserDyadDoor|dyadDoor|answerBrowserDyadAsk/);

    // The leaf still folds the fleet board before boot, then keeps its sibling gate current on changes.
    expect((src.match(/^\s*fleetRead = readFleet\(\);\n\s*await fleetRead;$/gm) ?? []).length).toBe(1);
    const read = src.search(/^\s*fleetRead = readFleet\(\);\n\s*await fleetRead;$/m);
    expect(src).toMatch(/read\.handle\.on\("change", \(\) => \{\n\s*fleetShadows = null;\n\s*fleetMoves \+= 1;/);
    expect(src).toMatch(/if \(startedAt !== fleetMoves\) return;/);
    expect(src).toMatch(/aside: \(peerId\) => siblingAside\(peerId\)/);
    expect(src).toMatch(/deviceAside: \(vesselKey\) => !fleetShadows \|\| fleetShadows\.readings\.get\(deviceEdgeId\(fleetShadows\.root, vesselKey\)\)\?\.stands === true/);
    const boot = src.indexOf("daemon = await openBrowserDaemonVm(");
    expect(read).toBeGreaterThan(0);
    expect(read).toBeLessThan(boot);

    // The daemon island resolves standing through its own Repo and signed fleet board.
    expect(island).not.toMatch(/browserDyadAsker|vesselDyadAsker|browser-dyad-door/);
    expect((island.match(/readDyadFromBoard: true/g) ?? []).length).toBe(1);
    expect(behavior).toMatch(/readDyadFromBoard\s*\?[\s\S]*?boardDyadReader\(\s*ctx\.repo,[\s\S]*?:\s*dyadReading/);
    expect(boardReader).toMatch(/findOrThrow\(repo, fleetEdgeBoardDocUrl\(fleetRootDid\)/);
    expect(boardReader).toMatch(/readEdgeBoard\(\{[^}]*board,[^}]*kept[^}]*authorityFor: fleetEdgeAuthority\(fleetRootDid\)[^}]*\}\)/);   // the island counts into its own ledger
    expect(boardReader).toMatch(/keptFromLedger\(/);
  });
});
