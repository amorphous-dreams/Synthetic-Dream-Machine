/**
 * store-door.test.ts — M1 and H2 of the door-warden golden-path pass.
 *
 * Proven:
 *   · M1 RED→GREEN: a verb routed through a standing-but-not-yet-serving ("parked") vessel exhausts its OWN
 *     phase budget and refuses NAMING the pid still holding — never a flat, mute "timed out after 30000ms".
 *   · M1 CONTROL: the verb settling before any phase budget is spent wins the race outright, naming nothing.
 *   · H2: `pokeSealHomeRefold` reaches the standing vessel's door (`seal-home-refold`) exactly when one
 *     stands, and is a complete no-op (no connection attempted at all) when none does — nothing to poke, no
 *     wasted `ownedStore` act for a no-op row.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/local-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/local-connector.js")>();
  return { ...actual, udsAlive: vi.fn(), whoHolds: vi.fn() };
});
vi.mock("../src/verb-call.js", () => ({ runVerb: vi.fn() }));
vi.mock("../src/env.js", () => ({ vesselDid: vi.fn(async () => "did:test"), larSealHome: vi.fn(() => "/tmp/unused-seal") }));

import { udsAlive, whoHolds } from "../src/local-connector.js";
import { runVerb } from "../src/verb-call.js";
import { throughStoreDoor, pokeSealHomeRefold, SlowBootTimeout } from "../src/store-door.js";

const FAST_PHASES = [
  { name: "unbound", budgetMs: 30 },
  { name: "parked",  budgetMs: 60 },
] as const;

describe("throughStoreDoor — a budgeted, holder-named wait on a parked vessel (M1)", () => {
  it("RED: a verb parked behind a boot that never serves exhausts its phase budget, naming the holder", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ holder: "vessel", message: "a vessel (pid 4242) holds the store at /tmp/x" });
    vi.mocked(runVerb).mockImplementation(() => new Promise(() => { /* never settles — the parked shape */ }));

    await expect(
      throughStoreDoor({ verb: "nexus-kapae", args: {}, direct: async () => ({}), phases: FAST_PHASES }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(SlowBootTimeout);
      const err = e as SlowBootTimeout;
      expect(err.resource).toBe("the vessel's store door");
      expect(err.holderPids).toEqual([4242]);
      expect(err.message).toMatch(/still held by pid\(s\) 4242/);
      return true;
    });
  });

  it("CONTROL: a verb that settles promptly wins the race outright, naming no holder", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(null);   // nothing answers — irrelevant once the verb settles first
    vi.mocked(runVerb).mockResolvedValue({ status: "done", requestId: "r1" });

    const r = await throughStoreDoor({ verb: "nexus-kapae", args: {}, direct: async () => ({}), phases: FAST_PHASES });
    expect(r.via).toBe("daemon");
  });
});

describe("pokeSealHomeRefold — poke only when a vessel stands (H2)", () => {
  it("does nothing at all when no vessel answers — no verb attempted", async () => {
    vi.mocked(udsAlive).mockResolvedValue(false);
    vi.mocked(runVerb).mockClear();
    await pokeSealHomeRefold();
    expect(runVerb).not.toHaveBeenCalled();
  });

  it("reaches the standing vessel's `seal-home-refold` row when one answers", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ holder: "vessel", message: "" });
    vi.mocked(runVerb).mockClear();
    vi.mocked(runVerb).mockResolvedValue({ status: "done", requestId: "r2", results: {} });
    await pokeSealHomeRefold();
    expect(runVerb).toHaveBeenCalledWith("seal-home-refold", {}, "did:test", expect.anything());
  });
});
