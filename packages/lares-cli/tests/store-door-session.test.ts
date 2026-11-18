/**
 * store-door-session.test — every row that acts as a face rides a session of that face on a running vessel, as one act
 * whose answer returns on that socket alone (`session:act`, K20); a row of the place rides the maintenance frame; with no
 * vessel standing every row runs here (session-contract#/the-hands).
 */
import { seatSuiteWard } from "./support/scratch-custody-setup.js";
// This suite stands as the person at the terminal: its root acts carry no ward route, and the suite's person answers (seat-harness#/the-ward).
seatSuiteWard();
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/local-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/local-connector.js")>();
  return { ...actual, udsAlive: vi.fn(), whoHolds: vi.fn(async () => null), udsSocketPresent: vi.fn(() => true), invokeLocal: vi.fn() };
});
vi.mock("../src/env.js", () => ({ vesselDid: vi.fn(async () => "did:test"), larSealHome: vi.fn(() => "/tmp/unused-seal") }));
vi.mock("../src/session-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/session-connector.js")>();
  return { ...actual, openLocalSession: vi.fn() };
});
// A ward row takes its route over the standing vessel's custody door and gets a one-use ticket back (ward-door#wardTicketFor).
vi.mock("../src/custody-door.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/custody-door.js")>();
  return { ...actual, sendCustodyFrame: vi.fn(async (frame: { op: string }) => (frame.op === "ward" ? { ref: "ward-ticket-1" } : null)) };
});
vi.mock("../src/sealed-act-door.js", () => ({ sealedAct: vi.fn() }));
vi.mock("@lararium/node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/node")>();
  return { ...actual, storeDoorDirect: vi.fn(async (verb: string) => ({ verb, ranHere: true })) };
});

import { udsAlive, invokeLocal, UdsUnreachable } from "../src/local-connector.js";
import { openLocalSession, SessionRefused } from "../src/session-connector.js";
import { sealedAct } from "../src/sealed-act-door.js";
import { sendCustodyFrame } from "../src/custody-door.js";
import * as storeDoor from "../src/store-door.js";
import { storeVerb, storeFailure } from "../src/store-door.js";

const done = (output: Record<string, unknown>) => ({ status: "done", results: { summary: { ok: true, output } } });
const opened: string[] = [];
const acted: Array<{ act: string; args: Record<string, unknown> }> = [];
let answerOf = (act: string): Record<string, unknown> => ({ status: "done", output: { verb: act, via: "session" } });
let closed = 0;
/** The request id each act rode, as the door named it. */
const actIds: Array<string | undefined> = [];
/** The receipts a recovery read, by the id it asked under. */
const receiptsRead: string[] = [];
let loseAnswer = false;

beforeEach(() => {
  vi.clearAllMocks();
  opened.length = 0; acted.length = 0; closed = 0; actIds.length = 0; receiptsRead.length = 0; loseAnswer = false;
  answerOf = (act) => ({ status: "done", output: { verb: act, via: "session" } });
  vi.mocked(udsAlive).mockResolvedValue(true);
  vi.mocked(invokeLocal).mockImplementation(async (verb) => done({ verb, via: "frame" }) as never);
  vi.mocked(openLocalSession).mockImplementation(async ({ faceRef }) => {
    opened.push(faceRef);
    return {
      faceRef, act: async (act: string, args: Record<string, unknown>, opts?: { requestId?: string }) => {
        acted.push({ act, args }); actIds.push(opts?.requestId);
        if (loseAnswer) throw new UdsUnreachable("local session socket closed");
        return answerOf(act);
      },
      receipt: async (requestId: string) => { receiptsRead.push(requestId); return { requestId, status: "done" }; },
      call: async () => { throw new Error("a face row never rides session:call"); },
      close: async () => { closed += 1; },
    } as never;
  });
});

describe("store rows on a running vessel", () => {
  it("RED: a face row rides a session of the face it names, and no maintenance frame carries it", async () => {
    const r = await storeVerb("handle-publish", { glamour: "g", handleIndex: 2 });
    expect(r).toEqual({ output: { via: "session" }, via: "daemon" });
    expect(opened).toEqual(["h2"]);
    // handle-publish is a ward act: the route rode the custody door and the session act carries the one-use ticket it answered.
    expect(sendCustodyFrame).toHaveBeenCalledWith(expect.objectContaining({ op: "ward" }));
    expect(acted).toEqual([{ act: "handle-publish", args: { glamour: "g", handleIndex: 2, wardRef: "ward-ticket-1" } }]);
    expect(closed).toBe(1);
    expect(invokeLocal).not.toHaveBeenCalled();
  });

  it("a face row naming no face rides the session of the one face the vessel resolves", async () => {
    vi.mocked(sealedAct).mockResolvedValue({ face: 1 } as never);
    await storeVerb("cabal-face", { realm: "r" });
    expect(sealedAct).toHaveBeenCalledWith("face.resolve", {});
    expect(opened).toEqual(["h1"]);
  });

  it("a face row the vessel could not run throws with its words and the act's own reason", async () => {
    answerOf = () => ({ status: "error", errorMessage: "capability denied for routed verb \"cabal-face\"" });
    const denied = await storeVerb("cabal-face", { realm: "r", face: 0 }).catch((e: unknown) => e);
    expect(storeFailure(denied, "cabal-refused").message).toMatch(/capability denied/);
    answerOf = () => ({ status: "error", reason: "act-faulted" });
    const faulted = await storeVerb("cabal-face", { realm: "r", face: 0 }).catch((e: unknown) => e);
    expect(storeFailure(faulted).code).toBe("act-faulted");
  });

  it("a session the vessel refuses answers by the vessel's own name", async () => {
    vi.mocked(openLocalSession).mockRejectedValue(new SessionRefused("face-locked"));
    const err = await storeVerb("edge-kapae", { face: 0 }).catch((e: unknown) => e);
    expect(storeFailure(err).code).toBe("face-locked");
  });

  it("CONTROL: a row of the place rides the maintenance frame, and with no vessel standing every row runs here", async () => {
    expect(await storeVerb("persona-new", { handleIndex: 3 })).toEqual({ output: { via: "frame" }, via: "daemon" });
    expect(opened).toEqual([]);
    vi.mocked(udsAlive).mockResolvedValue(false);
    expect(await storeVerb("handle-publish", { glamour: "g", handleIndex: 2 })).toEqual({ output: { ranHere: true }, via: "direct" });
    expect(opened).toEqual([]);
    expect(sealedAct).not.toHaveBeenCalled();
  });
});

describe("a face row's act rides a request id the door owns (K20)", () => {
  it("RED: each act carries one id the door minted, and two acts never share one", async () => {
    await storeVerb("cabal-face", { realm: "r", face: 0 });
    await storeVerb("cabal-face", { realm: "r", face: 0 });
    expect(actIds).toHaveLength(2);
    expect(typeof actIds[0]).toBe("string");
    expect(typeof actIds[1]).toBe("string");
    expect(actIds[0]).not.toBe(actIds[1]);
  });

  it("RED: an answer the socket lost names the id it rode, and the face's receipt recovers under that id", async () => {
    loseAnswer = true;
    const lost = await storeVerb("cabal-face", { realm: "r", face: 0 }).catch((e: unknown) => e);
    const failure = storeFailure(lost);
    expect(failure.code).toBe("outcome-unknown");
    expect(failure.message).toContain(actIds[0]!);
    expect((lost as { requestId?: unknown }).requestId).toBe(actIds[0]);
    const recover = (storeDoor as Record<string, unknown>)["sessionActReceipt"] as ((face: number, requestId: string) => Promise<unknown>) | undefined;
    expect(typeof recover).toBe("function");
    expect(await recover!(0, actIds[0]!)).toEqual({ requestId: actIds[0], status: "done" });
    expect(receiptsRead).toEqual([actIds[0]]);
  });
});
