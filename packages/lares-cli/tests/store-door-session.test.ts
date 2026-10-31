/**
 * store-door-session.test — every row that acts as a face rides a session of that face on a running vessel, as one act
 * whose answer returns on that socket alone (`session:act`, K20); a row of the place rides the maintenance frame; with no
 * vessel standing every row runs here (session-contract#/the-hands).
 */
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
vi.mock("../src/sealed-act-door.js", () => ({ sealedAct: vi.fn() }));
vi.mock("@lararium/node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/node")>();
  return { ...actual, storeDoorDirect: vi.fn(async (verb: string) => ({ verb, ranHere: true })) };
});

import { udsAlive, invokeLocal } from "../src/local-connector.js";
import { openLocalSession, SessionRefused } from "../src/session-connector.js";
import { sealedAct } from "../src/sealed-act-door.js";
import { storeVerb, storeFailure } from "../src/store-door.js";

const done = (output: Record<string, unknown>) => ({ status: "done", results: { summary: { ok: true, output } } });
const opened: string[] = [];
const acted: Array<{ act: string; args: Record<string, unknown> }> = [];
let answerOf = (act: string): Record<string, unknown> => ({ status: "done", output: { verb: act, via: "session" } });
let closed = 0;

beforeEach(() => {
  vi.clearAllMocks();
  opened.length = 0; acted.length = 0; closed = 0;
  answerOf = (act) => ({ status: "done", output: { verb: act, via: "session" } });
  vi.mocked(udsAlive).mockResolvedValue(true);
  vi.mocked(invokeLocal).mockImplementation(async (verb) => done({ verb, via: "frame" }) as never);
  vi.mocked(openLocalSession).mockImplementation(async ({ faceRef }) => {
    opened.push(faceRef);
    return {
      faceRef, act: async (act: string, args: Record<string, unknown>) => { acted.push({ act, args }); return answerOf(act); },
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
    expect(acted).toEqual([{ act: "handle-publish", args: { glamour: "g", handleIndex: 2 } }]);
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
