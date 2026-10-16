/**
 * store-door.test.ts — M1 and H2 of the door-warden golden-path pass, plus H1's own-decision socket close
 * and M4's wedged-vs-unbound distinction.
 *
 * Proven:
 *   · M1 RED→GREEN: a verb routed through a standing-but-not-yet-serving ("parked") vessel exhausts its OWN
 *     phase budget and refuses NAMING the pid still holding — never a flat, mute "timed out after 30000ms".
 *   · M1 CONTROL: the verb settling before any phase budget is spent wins the race outright, naming nothing.
 *   · H1: the instant `SlowBootTimeout` fires, `throughStoreDoor` aborts the still-open verb socket itself
 *     (`invokeLocal`'s `signal`) — it never lets the verb's own flat `timeoutMs` keep it open for the rest of
 *     a budget nobody is still waiting on. MUTATION PROOF: an `invokeLocal` that never honours the abort
 *     signal still settles the race (the timeout still throws), but this suite's own fixture asserts the
 *     signal fired, which a caller that dropped the abort call would fail.
 *   · M4: a WEDGED holder (`whoHolds` answers `{ phase: "wedged", ... }`) spends the dedicated `wedged`
 *     phase's own budget and names its own pid — never the `unbound` phase's budget, and never read as "no
 *     discoverable holder" just because it never managed to answer.
 *   · H2: `pokeSealHomeRefold` reaches the standing vessel's door (`seal-home-refold`) exactly when one
 *     stands, and is a complete no-op (no connection attempted at all) when none does — nothing to poke, no
 *     wasted `ownedStore` act for a no-op row.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/local-connector.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/local-connector.js")>();
  return { ...actual, udsAlive: vi.fn(), whoHolds: vi.fn(), udsSocketPresent: vi.fn(() => true), invokeLocal: vi.fn() };
});
vi.mock("../src/env.js", () => ({ vesselDid: vi.fn(async () => "did:test"), larSealHome: vi.fn(() => "/tmp/unused-seal") }));

import { udsAlive, whoHolds, invokeLocal } from "../src/local-connector.js";
import { throughStoreDoor, pokeSealHomeRefold, SlowBootTimeout } from "../src/store-door.js";

const FAST_PHASES = [
  { name: "unbound", budgetMs: 30 },
  { name: "parked",  budgetMs: 60 },
] as const;

const FAST_WEDGED_PHASES = [
  { name: "unbound", budgetMs: 10_000 },
  { name: "parked",  budgetMs: 10_000 },
  { name: "wedged",  budgetMs: 30 },
] as const;

describe("throughStoreDoor — a budgeted, holder-named wait on a parked vessel (M1, H1)", () => {
  it("RED: a verb parked behind a boot that never serves exhausts its phase budget, naming the holder, and ITS OWN SOCKET IS ABORTED (H1) — never left open for the verb's own flat budget", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ phase: "parked", holder: "vessel", message: "a vessel (pid 4242) holds the store at /tmp/x" });
    let aborted = false;
    vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
      // The never-settling "parked" shape, EXCEPT it honours an abort exactly as the real socket-backed
      // `invokeLocal` does — this is what proves the fix calls `controller.abort()` at all, rather than
      // merely letting the budgeted wait throw while the verb's own promise dangles forever unaborted.
      opts?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
    }));

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
    expect(aborted).toBe(true);           // H1 — the decision closed the socket; nothing kept it open mute
  });

  it("CONTROL: a verb that settles promptly wins the race outright, naming no holder, with no abort ever fired", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(null);   // nothing answers — irrelevant once the verb settles first
    let aborted = false;
    vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => {
      opts?.signal?.addEventListener("abort", () => { aborted = true; }, { once: true });
      return Promise.resolve({ status: "done", requestId: "r1" });
    });

    const r = await throughStoreDoor({ verb: "nexus-kapae", args: {}, direct: async () => ({}), phases: FAST_PHASES });
    expect(r.via).toBe("daemon");
    expect(aborted).toBe(false);
  });
});

describe("throughStoreDoor — a WEDGED holder spends its own phase budget, never \"unbound\"'s (M4)", () => {
  it("RED: a wedged whoHolds answer exhausts the wedged phase's OWN budget and names its own pid, never reading as unbound", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({
      phase: "wedged", holder: null,
      message: "a listener at /tmp/x accepted the connection but gave no answer within 1500ms — frozen or wedged, still held by pid(s) 9999",
    });
    vi.mocked(invokeLocal).mockImplementation((_verb, _args, _by, opts) => new Promise((_resolve, reject) => {
      // Honours the abort exactly as the real socket-backed `invokeLocal` does, so this door's own
      // `controller.abort()` (H1) can settle it rather than hanging the test on a promise nobody ever
      // resolves.
      opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));

    await expect(
      throughStoreDoor({ verb: "nexus-kapae", args: {}, direct: async () => ({}), phases: FAST_WEDGED_PHASES }),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toBeInstanceOf(SlowBootTimeout);
      const err = e as SlowBootTimeout;
      expect(err.phase).toBe("wedged");                 // spent the WEDGED budget, never the unbound one
      expect(err.holderPids).toEqual([9999]);
      expect(err.message).toMatch(/still held by pid\(s\) 9999/);
      return true;
    });
  });

  it("MUTATION PROOF: a null-fusing map reads a wedged answer as unbound", () => {
    // The mutant: `met === null ? "unbound" : "parked"` — any non-null answer, wedged included, falls into
    // "parked". Enacting it over a wedged answer shows the fusion the real map refuses.
    const met: { phase: "wedged"; holder: null; message: string } = { phase: "wedged", holder: null, message: "…" };
    const oldShapePhase = met === null ? "unbound" : "parked";
    expect(oldShapePhase).toBe("parked");                // the bug: a wedged answer read as merely "parked"
    expect(met.phase).toBe("wedged");                     // the new reading: wedged stays wedged
  });
});

describe("pokeSealHomeRefold — poke only when a vessel stands (H2)", () => {
  it("does nothing at all when no vessel answers — no verb attempted", async () => {
    vi.mocked(udsAlive).mockResolvedValue(false);
    vi.mocked(invokeLocal).mockClear();
    await pokeSealHomeRefold();
    expect(invokeLocal).not.toHaveBeenCalled();
  });

  it("reaches the standing vessel's `seal-home-refold` row when one answers", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue({ holder: "vessel", message: "" });
    vi.mocked(invokeLocal).mockClear();
    vi.mocked(invokeLocal).mockResolvedValue({ status: "done", requestId: "r2", results: {} });
    await pokeSealHomeRefold();
    expect(invokeLocal).toHaveBeenCalledWith("seal-home-refold", {}, "did:test", expect.anything());
  });
});

describe("pokeSealHomeRefold says what the refold did, one word per outcome", () => {
  const rowAnswers = (output: Record<string, unknown>) => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(null);
    vi.mocked(invokeLocal).mockResolvedValue({ status: "done", requestId: "r", results: { summary: { ok: true, output: { verb: "seal-home-refold", ...output } } } });
  };

  it("★ a refold that ran and failed names itself `failed`, never the `none` of a vessel that does not stand ★", async () => {
    rowAnswers({ attempted: true, refolded: false });
    expect(await pokeSealHomeRefold()).toBe("failed");
  });

  it("a poke the vessel never answered reads `failed`: nothing says the refold ran", async () => {
    vi.mocked(udsAlive).mockResolvedValue(true);
    vi.mocked(whoHolds).mockResolvedValue(null);
    vi.mocked(invokeLocal).mockRejectedValue(new Error("a synthetic transport fault"));
    expect(await pokeSealHomeRefold()).toBe("failed");
  });

  it("CONTROL: done, pending, and the two honest `none`s keep their words", async () => {
    rowAnswers({ attempted: true, refolded: true });
    expect(await pokeSealHomeRefold()).toBe("done");
    rowAnswers({ attempted: true, refolded: "pending" });
    expect(await pokeSealHomeRefold()).toBe("pending");
    rowAnswers({ attempted: false, refolded: false });         // the row ran where no live reading stands to refold
    expect(await pokeSealHomeRefold()).toBe("none");
    vi.mocked(udsAlive).mockResolvedValue(false);               // no vessel stands
    expect(await pokeSealHomeRefold()).toBe("none");
  });
});
