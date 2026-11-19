import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { shutdownComposition, closeCompositionRepo, ownDialPresentation, IslandShutdownCut, shutdownExitCode, CompositionShutdownError, closeRefusedComposition, type ShutdownEntry } from "../src/composition-shutdown.js";

const vessel = readFileSync(new URL("../src/open-node-vessel.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

describe("composition shutdown owns its last wave and store", () => {
  test("drains the pending wave and seals it before dropping signers, islands, Repo and claim", async () => {
    const seen: string[] = [];
    let pending = false;
    let signer = true;
    let daemon = true;
    const entries: ShutdownEntry[] = [
      { what: "repo", phase: "repo", down: () => { seen.push("repo"); } },
      { what: "islands", phase: "islands", down: () => { daemon = false; seen.push("islands"); } },
      { what: "signers", phase: "signers", down: () => { signer = false; seen.push("signers"); } },
      { what: "seal", phase: "flush", down: () => { expect(pending && signer && daemon).toBe(true); seen.push("seal"); } },
      { what: "watch", phase: "producers", down: () => { pending = true; seen.push("wave"); } },
    ];
    await shutdownComposition(entries, async () => { seen.push("claim"); });
    expect(seen).toEqual(["wave", "seal", "signers", "islands", "repo", "claim"]);
    expect(entries).toEqual([]);
  });

  test("a flush failure still ends hydration and closes the Repo, preserving the failure", async () => {
    const seen: string[] = [];
    const failure = new Error("disk full");
    const entries: ShutdownEntry[] = [{ what: "repo", phase: "repo", down: () => closeCompositionRepo({
      flush: async () => { throw failure; }, seal: async () => { seen.push("seal"); },
      endHydration: () => { seen.push("hydration"); }, shutdown: async () => { seen.push("repo"); },
    }) }];
    await expect(shutdownComposition(entries, async () => { seen.push("claim"); })).rejects.toMatchObject({ storeClosed: true, errors: [expect.objectContaining({ errors: [failure] })] });
    expect(seen).toEqual(["seal", "hydration", "repo", "claim"]);
  });

  test("a sealed-store flush failure still closes the Repo and keeps its cause", async () => {
    const failure = new Error("sealed store refused");
    let closed = false;
    await expect(closeCompositionRepo({
      flush: async () => {}, seal: async () => { throw failure; }, endHydration: () => {},
      shutdown: async () => { closed = true; },
    })).rejects.toMatchObject({ storeClosed: true, errors: [failure] });
    expect(closed).toBe(true);
  });

  test("a Repo close failure retains the claim and all failure evidence", async () => {
    const failure = new Error("owner still open");
    let released = false;
    await expect(shutdownComposition([{ what: "repo", phase: "repo", down: () => closeCompositionRepo({
      flush: async () => {}, seal: async () => {}, endHydration: () => {}, shutdown: async () => { throw failure; },
    }) }], async () => { released = true; })).rejects.toMatchObject({ storeClosed: false });
    expect(released).toBe(false);
  });

  test("an earlier failed phase cannot skip remaining cleanup or hide its cause", async () => {
    const failure = new Error("wave refused");
    let closed = false;
    await expect(shutdownComposition([
      { what: "repo", phase: "repo", down: () => { closed = true; } },
      { what: "watch", phase: "producers", down: () => { throw failure; } },
    ])).rejects.toMatchObject({ errors: [failure], storeClosed: true });
    expect(closed).toBe(true);
  });

  test("an overtaken presentation drops its signer and closes its session once", () => {
    const seen: string[] = [];
    const dispose = ownDialPresentation({ signer: { binding: { sessionId: "dial" }, drop: () => { seen.push("signer"); } } },
      { close: (id) => { seen.push(id); } });
    dispose();
    dispose();
    expect(seen).toEqual(["signer", "dial"]);
  });

  test("a presentation's table closes even when its signer drop throws", () => {
    const failure = new Error("drop failed");
    let closed = false;
    const dispose = ownDialPresentation({ signer: { binding: { sessionId: "dial" }, drop: () => { throw failure; } } },
      { close: () => { closed = true; } });
    expect(dispose).toThrow(failure);
    expect(closed).toBe(true);
    expect(dispose).not.toThrow();
  });

  test("island cuts retain their exit code while flush failures take precedence", () => {
    const cut = new IslandShutdownCut("daemon cut (ack silent)");
    expect(shutdownExitCode(new CompositionShutdownError([cut], true))).toBe(76);
    expect(shutdownExitCode(new CompositionShutdownError([cut, new Error("disk full")], true))).toBe(1);
    expect(shutdownExitCode(new CompositionShutdownError([cut], false))).toBe(1);
  });

  test("a refused boot keeps its original cause alongside failed cleanup and retains an open owner's claim", async () => {
    const boot = new Error("boot refused");
    const close = new Error("owner still open");
    await expect(closeRefusedComposition(boot, async () => {
      throw new CompositionShutdownError([close], false);
    })).rejects.toMatchObject({ storeClosed: false, errors: [boot, close] });
  });

  test("the vessel owns dial, sibling, keeper and overtaken mint disposal", () => {
    expect(vessel).toContain("drop: dropCompositionSessions");
    expect(vessel).toContain("for (const group of [...siblingSessions.keys()]) dropSiblingSession(group)");
    expect(vessel).toContain("ownDialPresentation(dialPresentationNow, dialSessions.table)");
    expect(vessel).toContain("dropDialPresentation?.()");
    expect(vessel).toContain("for (const keeper of siblingBasesKeepers.values()) keeper.stop()");
    expect(vessel).toContain("if (!live()) { disposePresentation(); return; }");
    expect(vessel).toContain('what: "the face pool\'s watch", phase: "producers"');
    expect(vessel).toContain('what: "the role caps", phase: "signers"');
    expect(vessel).toContain('what: "the Repo", phase: "repo"');
  });

  test("signal shutdown and recomposition await the same composition teardown", () => {
    const signal = main.slice(main.indexOf('const shutdown = async (sig: string)', main.indexOf('async function composeHearthStanding(')));
    expect(signal).toContain('await step("composition", () => result.teardown(() => front.close()))');
    expect(signal).not.toContain('result.pool.disposeAll()');
    expect(signal).not.toContain('result.daemon.shutdown(');
    expect(main).toContain('teardown: () => result.teardown(() => front.detach())');
  });
});
