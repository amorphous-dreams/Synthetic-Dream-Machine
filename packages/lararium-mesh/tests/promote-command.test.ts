/**
 * promote-command — the one request shape `lares promote` and `lares kapae` send, and what the vessel's row does with it: the wiki
 * defaults to the daemon wiki, a seat prepares and flags and a hand commits and raises, a malformed ask refuses by name before any door.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { promoteCommand, type PromoteCommandDeps } from "../src/promote-command.js";
import type { PromoteWho } from "../src/index.js";

const D = "d".repeat(64), HAND: PromoteWho = { kind: "hand", id: "h" }, SEAT: PromoteWho = { kind: "seat", id: "s" };

function deps(who: PromoteWho) {
  const calls: Array<[string, unknown]> = [];
  const listing = { rows: [{ digest: "a".repeat(64), title: "rites/old", classes: ["module-type"] }], waiting: [{ digest: D, title: "rites/a", classes: ["module-type"] }], shadowed: [] };
  const d: PromoteCommandDeps = {
    who,
    promotionsFor: (wiki) => ({
      list: async () => { calls.push(["list", wiki]); return listing; },
      promote: async (a: { digest: string }) => { calls.push(["promote", { wiki, ...a }]); return { digest: a.digest }; },
      unpromote: async (a: { digest: string }) => { calls.push(["unpromote", { wiki, ...a }]); },
      decideOrphan: async (a: { digest: string; decision: string }) => { calls.push(["decideOrphan", { wiki, ...a }]); },
    }) as never,
    boardDoor: {
      prepare: async (a: unknown) => { calls.push(["prepare", a]); return { cid: "c" }; },
      flag: async (a: unknown) => { calls.push(["flag", a]); return { cid: "c" }; },
      kapae: async (a: { action: string }) => { if (who.kind !== "hand") throw Object.assign(new Error("kapae-needs-hand"), { code: "kapae-needs-hand" }); calls.push(["kapae", a]); return { cid: "c" }; },
    } as never,
    logWiki: (wiki: string) => calls.push(["wiki", wiki]),
  } as PromoteCommandDeps;
  return { d, calls };
}

describe("the request shapes", () => {
  test("RED: the wiki defaults to `daemon`, and a named wiki reaches its own door; CONTROL: list answers rows and the rites waiting", async () => {
    const a = deps(HAND);
    expect(await promoteCommand({ action: "list" }, a.d)).toMatchObject({ waiting: [{ digest: D }] });
    expect(a.calls[0]).toEqual(["list", "daemon"]);
    const b = deps(HAND);
    await promoteCommand({ action: "list", wiki: "garden" }, b.d);
    expect(b.calls[0]).toEqual(["list", "garden"]);
  });

  test("RED: prepare reads the rite's title and classes off the wiki's waiting list and lands it on the board with the reason; CONTROL: a digest the wiki does not list refuses `promote-unknown`, a missing reason `promote-why-missing`", async () => {
    const a = deps(SEAT);
    await promoteCommand({ action: "prepare", digest: D, why: "opens the field-notes macro" }, a.d);
    expect(a.calls.find((c) => c[0] === "prepare")![1]).toEqual({ wiki: "daemon", digest: D, title: "rites/a", classes: ["module-type"], why: "opens the field-notes macro" });
    await expect(promoteCommand({ action: "prepare", digest: "f".repeat(64), why: "x" }, a.d)).rejects.toMatchObject({ code: "promote-unknown" });
    await expect(promoteCommand({ action: "prepare", digest: D }, a.d)).rejects.toMatchObject({ code: "promote-why-missing" });
  });

  test("RED: commit, drop and orphan reach the wiki's door under the hand; CONTROL: an orphan names keep or drop", async () => {
    const a = deps(HAND);
    await promoteCommand({ action: "commit", digest: D }, a.d);
    await promoteCommand({ action: "drop", digest: D }, a.d);
    await promoteCommand({ action: "orphan", digest: D, decision: "keep" }, a.d);
    expect(a.calls.map((c) => c[0])).toEqual(["promote", "unpromote", "decideOrphan"]);
    await expect(promoteCommand({ action: "orphan", digest: D }, a.d)).rejects.toMatchObject({ code: "promote-decision-malformed" });
    await expect(promoteCommand({ action: "orphan", digest: D, decision: "maybe" }, a.d)).rejects.toMatchObject({ code: "promote-decision-malformed" });
  });

  test("RED: raise and lower reach the board door for (wiki, digest), and a seat's raise refuses `kapae-needs-hand`; CONTROL: a seat flags with a reason", async () => {
    const hand = deps(HAND);
    await promoteCommand({ action: "raise", wiki: "garden", digest: D }, hand.d);
    await promoteCommand({ action: "lower", wiki: "garden", digest: D }, hand.d);
    expect(hand.calls.filter((c) => c[0] === "kapae").map((c) => c[1])).toEqual([{ action: "raise", wiki: "garden", digest: D, who: HAND }, { action: "lower", wiki: "garden", digest: D, who: HAND }]);
    const seat = deps(SEAT);
    await expect(promoteCommand({ action: "raise", digest: D }, seat.d)).rejects.toMatchObject({ code: "kapae-needs-hand" });
    await promoteCommand({ action: "flag", digest: D, why: "the macro leaks the field notes" }, seat.d);
    expect(seat.calls.find((c) => c[0] === "flag")![1]).toEqual({ wiki: "daemon", digest: D, title: "rites/a", classes: ["module-type"], why: "the macro leaks the field notes" });
  });

  test("RED: an unknown action, a malformed digest and a missing digest refuse by name before any door; CONTROL: list needs no digest", async () => {
    const a = deps(HAND);
    await expect(promoteCommand({ action: "teleport" } as never, a.d)).rejects.toMatchObject({ code: "promote-action-unknown" });
    await expect(promoteCommand({ action: "commit", digest: "nope" }, a.d)).rejects.toMatchObject({ code: "promote-digest-malformed" });
    await expect(promoteCommand({ action: "raise" }, a.d)).rejects.toMatchObject({ code: "promote-digest-malformed" });
    expect(a.calls).toEqual([]);
    await expect(promoteCommand({ action: "list" }, a.d)).resolves.toBeTruthy();
  });
});
