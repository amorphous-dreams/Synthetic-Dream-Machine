/**
 * circle-verbs — the FOLLOW-GRAPH lands in the circles doc as a PER-NYM CRDT-set, reads back, and NEVER touches a board.
 *
 * These hold the source-of-truth move (Build 2a's local file → the sovereign circles doc) + the C2 CRDT move
 * (the space-joined `memberDids` register → per-nym `mbr+:`/`mbr-:` stamps):
 *   · a follow STAMPS the nym's own `mbr+:<nym>` key over the daemon store (never a whole-field register write).
 *   · a circle-list FOLDS that membership back (add-stamp present, no superseding remove-stamp).
 *   · an unfollow stamps `mbr-:<nym>` (remove-wins, idempotent) — the `memberDids` register is GONE; every
 *     writer (cold-boot-ceremony, social-seed) stamps `mbr+:` directly now.
 *   · CONCURRENT-MERGE: an add on one fork + a remove on another merge to remove-wins with NO lost add.
 *   · NEVER-FEDERATES: the reactor reaches ONLY the circles store — no crossroads-plane / board title is ever
 *     written, and every outcome reads `federated: false`.
 *   · the daemon follow surface renders FROM the circles doc (the worker owns the render).
 */

import { describe, expect, test } from "vitest";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeCircleReactors, foldMembers } from "../src/circle-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { circleTiddlerUri, CIRCLES_INNER, MEMBER_ADD_PREFIX, mutableLarRecord, buildCeremonyTiddlers } from "@lararium/mesh";

const CTX = {} as VerbContext;
const NYM_A = "aa".repeat(32);
const NYM_B = "bb".repeat(32);

/** A circles store seeded with the "following" system circle (no members yet), as seedCirclesDoc plants it. */
function seededCircles(): MemoryTiddlerStore {
  const store = new MemoryTiddlerStore(CIRCLES_INNER);
  store._seed(mutableLarRecord(circleTiddlerUri("following"), {
    text: "", id: "following", displayName: "Following", kind: "System", createdAt: "",
  }, "lararium-seed"));
  return store;
}

function reactorsOver(store: MemoryTiddlerStore, tw5?: TW5Engine) {
  return makeCircleReactors({ resolveStore: async () => store, ...(tw5 ? { tw5 } : {}) });
}

/** The folded present membership of a circle, read straight off the stored tiddler fields (the CRDT read). */
function membersOf(store: MemoryTiddlerStore, circle: string): string[] {
  const rec = store._snapshot().get(circleTiddlerUri(circle));
  return foldMembers((rec?.tiddler ?? {}) as Record<string, unknown>);
}

/** The raw stamp fields on a circle tiddler — proves the reactor writes per-nym keys, never a joined register. */
function stampFieldsOf(store: MemoryTiddlerStore, circle: string): Record<string, unknown> {
  const rec = store._snapshot().get(circleTiddlerUri(circle));
  return (rec?.tiddler ?? {}) as Record<string, unknown>;
}

describe("circle-verbs — the per-nym follow-graph over the circles doc", () => {
  test("circle-add STAMPS the nym's own mbr+ key (never a whole-field register)", async () => {
    const store = seededCircles();
    const { add } = reactorsOver(store);

    const out = await add({ circle: "following", nym: NYM_A }, CTX);

    expect(out["added"]).toBe(true);
    expect(out["federated"]).toBe(false);
    expect(out["members"]).toEqual([NYM_A]);
    // The add landed as this nym's OWN per-nym key — the reactor never writes a joined register at all.
    const fields = stampFieldsOf(store, "following");
    expect(typeof fields[`mbr+:${NYM_A}`]).toBe("string");
    expect(fields["memberDids"]).toBeUndefined();   // the register is GONE, not merely untouched
    expect(membersOf(store, "following")).toEqual([NYM_A]);
  });

  test("circle-list FOLDS the membership back from the circles doc", async () => {
    const store = seededCircles();
    const { add, list } = reactorsOver(store);
    await add({ circle: "following", nym: NYM_B }, CTX);
    await add({ circle: "following", nym: NYM_A }, CTX);

    const one = await list({ circle: "following" }, CTX);
    expect(one["members"]).toEqual([NYM_A, NYM_B]);   // folded + sorted

    const all = await list({}, CTX);
    expect(all["circles"]).toEqual([{ circle: "following", members: [NYM_A, NYM_B] }]);
  });

  test("circle-add is idempotent (a re-add re-stamps, still one member)", async () => {
    const store = seededCircles();
    const { add } = reactorsOver(store);
    await add({ circle: "following", nym: NYM_A }, CTX);
    const again = await add({ circle: "following", nym: NYM_A }, CTX);
    expect(again["added"]).toBe(false);
    expect(membersOf(store, "following")).toEqual([NYM_A]);
  });

  test("circle-remove drops the nym (remove-wins, idempotent); a re-follow resurrects it", async () => {
    const store = seededCircles();
    const { add, remove } = reactorsOver(store);
    await add({ circle: "following", nym: NYM_A }, CTX);
    await add({ circle: "following", nym: NYM_B }, CTX);

    const out = await remove({ circle: "following", nym: NYM_A }, CTX);
    expect(out["removed"]).toBe(true);
    expect(out["federated"]).toBe(false);
    expect(membersOf(store, "following")).toEqual([NYM_B]);

    // a second remove reads no-op (the nym already folds absent), and the remove stamp still stands
    const again = await remove({ circle: "following", nym: NYM_A }, CTX);
    expect(again["removed"]).toBe(false);
    expect(membersOf(store, "following")).toEqual([NYM_B]);

    // a causally-later re-follow supersedes the remove stamp → present again (resurrection). The stamp is a
    // Lamport counter minted from what THIS write observes (no wall clock, no sleep needed to order it).
    await add({ circle: "following", nym: NYM_A }, CTX);
    expect(membersOf(store, "following")).toEqual([NYM_A, NYM_B]);
  });

  test("a cold-boot-ceremony-seeded circle reads its member through the stamp path alone", () => {
    // buildCeremonyTiddlers writes the "operators" circle with the operator's own did stamped
    // `mbr+:<did>` directly — no `memberDids` register ever lands, and nothing in circle-verbs reads
    // one anymore (parseLegacyMembers is gone). Proves the writer and the reader actually agree.
    const [, circle] = buildCeremonyTiddlers("ab".repeat(32), "Operator One");
    const fields = circle!.fields as Record<string, unknown>;
    expect(fields["memberDids"]).toBeUndefined();
    const did = Object.keys(fields).find((k) => k.startsWith(MEMBER_ADD_PREFIX))?.slice(MEMBER_ADD_PREFIX.length);
    expect(typeof did).toBe("string");
    expect(foldMembers(fields)).toEqual([did]);
  });

  test("CONCURRENT-MERGE: add-on-fork-A + remove-on-fork-B merge to remove-wins with NO lost add", async () => {
    // Both replicas descend from a base where NYM_A is already followed (a standing `mbr+:NYM_A` stamp) — a
    // causal counter, never a wall-clock reading.
    const t0 = "00000000000000000000";
    const baseFields = { text: "", id: "following", displayName: "Following", kind: "System", createdAt: "", [`mbr+:${NYM_A}`]: t0 };
    const seed = () => {
      const s = new MemoryTiddlerStore(CIRCLES_INNER);
      s._seed(mutableLarRecord(circleTiddlerUri("following"), { ...baseFields }, "lararium-seed"));
      return s;
    };
    // Fork A (this device): follow a FRESH nym NYM_B — a DIFFERENT per-nym key than the base.
    const forkA = seed();
    await reactorsOver(forkA).add({ circle: "following", nym: NYM_B }, CTX);
    // Fork B (a fleet-mate, offline & concurrent): unfollow NYM_A — the `mbr-:NYM_A` key, disjoint from A's add.
    const forkB = seed();
    await reactorsOver(forkB).remove({ circle: "following", nym: NYM_A }, CTX);

    // Automerge merges the two replicas key-by-key: the per-nym stamps are DISJOINT (mbr+:NYM_A / mbr+:NYM_B /
    // mbr-:NYM_A), so it keeps EVERY edit — the whole-field register the reactors no longer write would have
    // last-writer-clobbered one of them. Model that disjoint-key merge as the field union.
    const merged: Record<string, unknown> = { ...stampFieldsOf(forkA, "following"), ...stampFieldsOf(forkB, "following") };

    const present = foldMembers(merged);
    expect(present).toContain(NYM_B);       // NO LOST ADD — A's fresh follow survives the concurrent unfollow
    expect(present).not.toContain(NYM_A);   // REMOVE-WINS — B's later unfollow supersedes the standing follow
  });

  test("REMOVE-WINS on a strict tie: an equal add/remove STAMP (a causal counter, never a timestamp) folds to absent", () => {
    const t = "00000000000000000003";
    // The fold reads present iff `addedAt > removedAt` (strict) — so an EQUAL-stamp add + remove folds to
    // absent: on a genuine tie (including two genuinely concurrent writers), remove wins (never a coin-flip
    // that could resurrect a banned/dropped nym).
    expect(foldMembers({ [`mbr+:${NYM_A}`]: t, [`mbr-:${NYM_A}`]: t })).toEqual([]);
    // A causally-later (strictly greater counter) add DOES win (a deliberate re-follow after an unfollow).
    const later = "00000000000000000004";
    expect(foldMembers({ [`mbr+:${NYM_A}`]: later, [`mbr-:${NYM_A}`]: t })).toEqual([NYM_A]);
  });

  test("CLOCKLESS: a set-back and a set-forward system clock leave every stamp and verdict unchanged", async () => {
    const realDateNow = Date.now;
    const store = seededCircles();
    const { add, remove } = reactorsOver(store);
    try {
      Date.now = () => 1_000; // set WAY back
      await add({ circle: "following", nym: NYM_A }, CTX);
      Date.now = () => 9_999_999_999_999; // set WAY forward
      await add({ circle: "following", nym: NYM_B }, CTX);
      Date.now = () => 500; // back again, mid-sequence
      const out = await remove({ circle: "following", nym: NYM_A }, CTX);
      expect(out["removed"]).toBe(true);
      expect(membersOf(store, "following")).toEqual([NYM_B]);
      // The stamps minted across the clock swings are a STRICTLY increasing causal counter, never a reading
      // of the (tampered) wall clock.
      const fields = stampFieldsOf(store, "following");
      const a = Number.parseInt(fields[`mbr+:${NYM_A}`] as string, 10);
      const b = Number.parseInt(fields[`mbr+:${NYM_B}`] as string, 10);
      const rmA = Number.parseInt(fields[`mbr-:${NYM_A}`] as string, 10);
      expect(a).toBeLessThan(b);
      expect(b).toBeLessThan(rmA);
    } finally {
      Date.now = realDateNow;
    }
  });

  test("MUTATION PROOF: reverting the causal stamp to a wall-clock ISO read breaks the clockless proof above", () => {
    // Simulates the bug `nextStamp` fixes: minting a stamp from `Date.now()`/`toISOString()` instead of the
    // tiddler's own observed counters. Re-running the SAME clock-tamper sequence through that reverted shape
    // would read the LATER add (NYM_B, minted under the far-future clock) as "before" a remove minted moments
    // later under a set-BACK clock — the exact inversion this file guards against.
    const wallClockStamp = () => new Date(Date.now()).toISOString();
    const realDateNow = Date.now;
    try {
      Date.now = () => 9_999_999_999_999;
      const laterByWallClock = wallClockStamp();
      Date.now = () => 500;
      const earlierByWallClock = wallClockStamp();
      // The reverted (buggy) shape would store `laterByWallClock` as NYM_B's add and `earlierByWallClock` as a
      // SUBSEQUENT remove — and a wall-clock compare reads the remove as EARLIER than the add it followed.
      expect(earlierByWallClock < laterByWallClock).toBe(true);
      expect(foldMembers({ [`mbr+:${NYM_B}`]: laterByWallClock, [`mbr-:${NYM_B}`]: earlierByWallClock })).toEqual([NYM_B]);
      // ^ WRONG under a set-back clock: the remove that actually happened SECOND folds as though it happened
      // FIRST. `nextStamp`'s causal counter cannot produce this inversion — proven by the test above.
    } finally {
      Date.now = realDateNow;
    }
  });

  test("a follow of a NEW circle the operator names is born (kind Circle)", async () => {
    const store = seededCircles();
    const { add } = reactorsOver(store);
    await add({ circle: "close-friends", nym: NYM_A }, CTX);
    const rec = store._snapshot().get(circleTiddlerUri("close-friends"));
    expect((rec?.tiddler as Record<string, unknown>)?.["kind"]).toBe("Circle");
    expect(membersOf(store, "close-friends")).toEqual([NYM_A]);
  });

  test("NEVER-FEDERATES: a follow writes ONLY the circles doc — no crossroads plane / board title", async () => {
    const store = seededCircles();
    const { add, remove } = reactorsOver(store);
    await add({ circle: "following", nym: NYM_A }, CTX);
    await remove({ circle: "following", nym: NYM_B }, CTX);

    // Every title the reactors ever wrote sits under the CIRCLES INNER namespace — no board shore is
    // reachable. It folds by the inner stem, never the bag address: a title names its own record and never
    // the entity holding it, so a check against `circles-<tag>` would match nothing and pass by vacuity.
    for (const title of store._snapshot().keys()) {
      expect(title.startsWith(CIRCLES_INNER)).toBe(true);
      expect(title).not.toContain("crossroads");
      expect(title).not.toContain("board");
    }
  });

  test("the daemon follow surface renders FROM the circles doc (worker owns the render)", async () => {
    const store = seededCircles();
    const rendered: Array<Record<string, string>> = [];
    const fakeTw5 = { setTiddler: (f: Record<string, string>) => { rendered.push(f); } } as unknown as TW5Engine;
    const { add } = reactorsOver(store, fakeTw5);

    await add({ circle: "following", nym: NYM_A }, CTX);

    const last = rendered.at(-1)!;
    expect(last["title"]).toBe("$:/temp/lares/circles");
    expect(last["circle"]).toBe("following");
    expect(last["count"]).toBe("1");
    expect(last["nym-0"]).toBe(NYM_A);
    expect(last["petname-0"]).toBe("");   // blank — the handle-book stays local (the co-move fork)
  });
});
