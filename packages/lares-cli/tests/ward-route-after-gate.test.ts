/**
 * ward-route-after-gate — a co-signed ward act (a kāpae lower, the house cap, a push go) asks its route only once the gate lets the
 * act run (row 7, S3b). The gate's judgement needs no root, so the row runs first with no route: on a face of two devices with no
 * answer it refuses `ward-awaiting-cosign` and no passphrase gets asked; where the act will run, the row's signer names
 * `ward-needs-fresh-unlock`, the route gets gathered ONCE, and the row runs again under its one-use ticket.
 *
 * Reds: a two-device lower with no answer asks no route, on a standing vessel and with none standing. Controls: a one-device lower
 * asks the route once and lands under the ticket; a ward act the gate never holds (a lane share) still asks its route first.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
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
vi.mock("../src/custody-door.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/custody-door.js")>();
  return { ...actual, sendCustodyFrame: vi.fn(async (frame: { op: string }) => (frame.op === "ward" ? { ref: "ward-ticket-1" } : null)) };
});
vi.mock("../src/sealed-act-door.js", () => ({ sealedAct: vi.fn() }));
vi.mock("@lararium/node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lararium/node")>();
  return { ...actual, storeDoorDirect: vi.fn() };
});

import { seatWardGatherer, storeDoorDirect } from "@lararium/node";
import { udsAlive } from "../src/local-connector.js";
import { openLocalSession } from "../src/session-connector.js";
import { sendCustodyFrame } from "../src/custody-door.js";
import { storeVerb } from "../src/store-door.js";

const AWAITING = { refused: "ward-awaiting-cosign: " + "c".repeat(64), refusal: "kapae-refused" };
const NEEDS = { refused: "ward-needs-fresh-unlock: a kāpae-lower rests under the face's ward", refusal: "kapae-refused" };
let asked = 0;
const acted: Array<Record<string, unknown>> = [];
let answers: Array<Record<string, unknown>> = [];

beforeEach(() => {
  vi.clearAllMocks();
  asked = 0; acted.length = 0; answers = [];
  seatWardGatherer(async () => { asked += 1; return [{ kind: "passphrase" as const, passphrase: "typed for this act" }]; });
  vi.mocked(openLocalSession).mockImplementation(async ({ faceRef }) => ({
    faceRef,
    act: async (act: string, args: Record<string, unknown>) => { acted.push(args); return { status: "done", output: { verb: act, ...(answers.shift() ?? { lowered: true }) } }; },
    call: async () => { throw new Error("a face row never rides session:call"); },
    close: async () => undefined,
  }) as never);
  vi.mocked(storeDoorDirect).mockImplementation(async (verb: string, args: Record<string, unknown>) => { acted.push(args); return { verb, ...(answers.shift() ?? { lowered: true }) }; });
});

describe("a co-signed ward act on a standing vessel", () => {
  it("RED: a two-device lower with no answer refuses `ward-awaiting-cosign` and asks no route", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    answers = [AWAITING];
    await expect(storeVerb("kapae-lower", { digest: "d".repeat(64), face: 0 })).rejects.toThrow(/ward-awaiting-cosign/);
    expect(asked).toBe(0);
    expect(sendCustodyFrame).not.toHaveBeenCalledWith(expect.objectContaining({ op: "ward" }));
    expect(acted).toHaveLength(1);
    expect(acted[0]).not.toHaveProperty("wardRef");
  });

  it("CONTROL: a lower the gate lets run asks the route once, and the row runs again under its one-use ticket", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    answers = [NEEDS, { lowered: true }];
    expect((await storeVerb("kapae-lower", { digest: "d".repeat(64), face: 0 })).output).toEqual({ lowered: true });
    expect(asked).toBe(1);
    expect(acted).toHaveLength(2);
    expect(acted[0]).not.toHaveProperty("wardRef");
    expect(acted[1]).toMatchObject({ wardRef: "ward-ticket-1" });
  });

  it("RED: a lower the panel answers (its handler throws `ward-needs-fresh-unlock`, so the session answers an error) asks the route once and runs again under its ticket", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    let calls = 0;
    vi.mocked(openLocalSession).mockImplementation(async ({ faceRef }) => ({
      faceRef,
      act: async (_act: string, args: Record<string, unknown>) => {
        acted.push(args); calls += 1;
        return calls === 1
          ? { status: "error", errorMessage: "ward-needs-fresh-unlock: ward-needs-fresh-unlock: the panel's kāpae-lower rests under the face's ward", reason: "kapae-refused" }
          : { status: "done", output: { verb: "kapae-lower", done: "kapae-lower" } };
      },
      call: async () => { throw new Error("a face row never rides session:call"); },
      close: async () => undefined,
    }) as never);
    expect((await storeVerb("kapae-lower", { digest: "d".repeat(64), face: 0 })).output).toEqual({ done: "kapae-lower" });
    expect(asked).toBe(1);
    expect(acted).toHaveLength(2);
    expect(acted[1]).toMatchObject({ wardRef: "ward-ticket-1" });
  });

  it("CONTROL: a panel answer naming another refusal throws it and asks no route", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(openLocalSession).mockImplementation(async ({ faceRef }) => ({
      faceRef,
      act: async (_act: string, args: Record<string, unknown>) => { acted.push(args); return { status: "error", errorMessage: "ward-awaiting-cosign: " + "c".repeat(64), reason: "kapae-refused" }; },
      call: async () => { throw new Error("a face row never rides session:call"); },
      close: async () => undefined,
    }) as never);
    await expect(storeVerb("kapae-lower", { digest: "d".repeat(64), face: 0 })).rejects.toThrow(/ward-awaiting-cosign/);
    expect(asked).toBe(0);
    expect(acted).toHaveLength(1);
  });

  it("CONTROL: the house cap and a go ride the same order; a lane share, which no gate holds, asks its route first", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    for (const [verb, args] of [["swarm-cap-set", { value: 7, face: 0 }], ["swarm-go-issue", { branch: "b", head: "a".repeat(40), face: 0 }]] as const) {
      asked = 0; acted.length = 0; answers = [{ refused: "ward-awaiting-cosign: " + "c".repeat(64), refusal: "swarm-refused" }];
      await expect(storeVerb(verb, { ...args })).rejects.toThrow(/ward-awaiting-cosign/);
      expect(asked).toBe(0);
    }
    asked = 0; acted.length = 0; answers = [{ landed: true }];
    await storeVerb("swarm-share-set", { lane: "l", value: 1, face: 0 });
    expect(asked).toBe(1);
    expect(acted[0]).toMatchObject({ wardRef: "ward-ticket-1" });
  });
});

describe("a co-signed ward act with no vessel standing", () => {
  it("RED: a two-device lower with no answer asks no route before the row runs here", async () => {
    vi.mocked(udsAlive).mockResolvedValue(false);
    answers = [AWAITING];
    await expect(storeVerb("kapae-lower", { digest: "d".repeat(64) })).rejects.toThrow(/ward-awaiting-cosign/);
    expect(asked).toBe(0);
    expect(acted).toHaveLength(1);
    expect(acted[0]).not.toHaveProperty("wardRef");
  });
});
