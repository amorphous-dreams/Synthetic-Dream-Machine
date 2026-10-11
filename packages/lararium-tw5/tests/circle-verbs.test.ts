/**
 * circle-verbs — the FOLLOW-GRAPH lands in the circles doc as a PER-NYM OBSERVED-REMOVE CRDT-set, reads back,
 * and NEVER touches a board.
 *
 * M5 (gp25 iteration 4, D2): the prior Lamport-counter fold compared ADD/REMOVE stamp VALUES as plain strings.
 * A single shared counter cannot tell concurrent from later (a remove at height 1 on one replica, a re-follow
 * at height 3 on an unrelated replica, compared as strings, and the higher height "won" regardless of causal
 * relation) — and `cold-boot-ceremony`'s own genesis follow stamped an ISO wall-clock string, which lexically
 * outranks every zero-padded decimal counter forever, so the operator's own follow could never be unfollowed.
 * Membership now rides DOTTED fields (`mbr+:<nym>#<replica>.<n>` / `mbr-:<nym>#<replica>.<n>`) whose VALUE is
 * the comma-joined set of opposite-kind dots that write OBSERVED — never a clock, never compared by magnitude.
 * A legacy undotted `mbr+:<nym>` / `mbr-:<nym>` (any value) still reads as a dot that observed nothing.
 */

import { describe, expect, test } from "vitest";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeCircleReactors, foldMembers, foldMembersDetailed } from "../src/circle-verbs.js";
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

function reactorsOver(store: MemoryTiddlerStore, opts?: { tw5?: TW5Engine; replica?: string }) {
  return makeCircleReactors({
    resolveStore: async () => store,
    replica: opts?.replica ?? "test-replica",
    ...(opts?.tw5 ? { tw5: opts.tw5 } : {}),
  });
}

/** The folded present membership of a circle, read straight off the stored tiddler fields (the CRDT read). */
function membersOf(store: MemoryTiddlerStore, circle: string): string[] {
  const rec = store._snapshot().get(circleTiddlerUri(circle));
  return foldMembers((rec?.tiddler ?? {}) as Record<string, unknown>);
}

/** The raw stamp fields on a circle tiddler — proves the reactor writes per-nym DOT keys, never a joined register. */
function stampFieldsOf(store: MemoryTiddlerStore, circle: string): Record<string, unknown> {
  const rec = store._snapshot().get(circleTiddlerUri(circle));
  return (rec?.tiddler ?? {}) as Record<string, unknown>;
}

describe("circle-verbs — the per-nym observed-remove follow-graph over the circles doc", () => {
  test("circle-add STAMPS the nym's own mbr+ DOT key (never a whole-field register)", async () => {
    const store = seededCircles();
    const { add } = reactorsOver(store, { replica: "dev-A" });

    const out = await add({ circle: "following", nym: NYM_A }, CTX);

    expect(out["added"]).toBe(true);
    expect(out["federated"]).toBe(false);
    expect(out["members"]).toEqual([NYM_A]);
    // The add landed as this nym's OWN per-nym dotted key, carrying this replica's id — never a joined register.
    const fields = stampFieldsOf(store, "following");
    const key = Object.keys(fields).find((k) => k.startsWith(`${MEMBER_ADD_PREFIX}${NYM_A}#`));
    expect(key).toBe(`${MEMBER_ADD_PREFIX}${NYM_A}#dev-A.0`);
    expect(typeof fields[key!]).toBe("string");
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
    expect(one["concurrent"]).toEqual([]);

    const all = await list({}, CTX);
    expect(all["circles"]).toEqual([{ circle: "following", members: [NYM_A, NYM_B], concurrent: [] }]);
  });

  test("circle-add is idempotent (a re-add re-stamps a fresh dot, still one member)", async () => {
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

    // a second remove reads no-op (the nym already folds absent), and a fresh remove-dot still lands
    const again = await remove({ circle: "following", nym: NYM_A }, CTX);
    expect(again["removed"]).toBe(false);
    expect(membersOf(store, "following")).toEqual([NYM_B]);

    // a re-follow mints a NEW add-dot whose observed-set covers every remove-dot presently on the nym
    // (both prior removes) — it dominates them, so the fold reads present again (resurrection).
    await add({ circle: "following", nym: NYM_A }, CTX);
    expect(membersOf(store, "following")).toEqual([NYM_A, NYM_B]);
  });

  test("M5 PROOF 1 — the LIVE cold-boot genesis follow (dotted form) DOES unfollow", async () => {
    // Before M5: cold-boot-ceremony stamped `mbr+:<did>` = an ISO string. `circle-remove` minted a
    // zero-padded decimal counter, and the string compare `'0' < '2'` meant the remove NEVER outranked the
    // ISO stamp — the operator's own follow was permanently un-unfollowable. buildCeremonyTiddlers now
    // mints the DOTTED form; prove the live reactor can remove it.
    const [, circle] = buildCeremonyTiddlers("ab".repeat(32), "Operator One");
    const did = Object.keys(circle!.fields).find((k) => k.startsWith(MEMBER_ADD_PREFIX))!
      .slice(MEMBER_ADD_PREFIX.length).split("#")[0]!;
    const store = new MemoryTiddlerStore(CIRCLES_INNER);
    store._seed(mutableLarRecord(circleTiddlerUri("operators"), circle!.fields, "cold-boot-ceremony"));
    expect(membersOf(store, "operators")).toEqual([did]);

    const { remove } = reactorsOver(store);
    const out = await remove({ circle: "operators", nym: did }, CTX);
    expect(out["removed"]).toBe(true);
    expect(membersOf(store, "operators")).toEqual([]);
  });

  test("EVERGREEN (gp25-SW2) — a LEGACY undotted mbr+ (any value, ISO included) REFUSES by name: ignored, "
    + "never counted present, never removable", async () => {
    // Before this sweep: an undotted mbr+ parsed as a dot (reserved id "~") that a remove could dominate.
    // After: `parseDotKey` does not recognize the undotted shape AT ALL — it is not a dot, so `foldMembers`
    // never sees an add for this nym, and the nym never becomes present off a legacy stamp alone.
    const store = seededCircles();
    const fields = stampFieldsOf(store, "following");
    const seeded = { ...fields, [`${MEMBER_ADD_PREFIX}${NYM_A}`]: new Date().toISOString() };
    store._seed(mutableLarRecord(circleTiddlerUri("following"), seeded, "legacy-writer"));
    expect(membersOf(store, "following")).toEqual([]);   // INVERTED: no longer present off the legacy stamp

    // A `circle-remove` against it is therefore a no-op by the reactor's own count (the nym already reads
    // absent) — it refuses to treat the stale key as anything to unfollow FROM.
    const { remove } = reactorsOver(store);
    const out = await remove({ circle: "following", nym: NYM_A }, CTX);
    expect(out["removed"]).toBe(false);
    expect(membersOf(store, "following")).toEqual([]);
  });

  test("EVERGREEN (gp25-SW2) — a pre-M5 undotted add+remove pair is IGNORED wholesale; a fresh dotted "
    + "follow lands clean (observing nothing stale, not even its own legacy history)", async () => {
    // L1 shape (probe-m5-legacy.mjs), inverted: before, the legacy remove dominated the legacy add. Now
    // NEITHER legacy key parses as a dot at all, so there is no add and no remove to fold — a fresh,
    // dotted follow does not need to "observe" anything stale; it simply lands as the nym's first dot.
    const store = seededCircles();
    const fields = stampFieldsOf(store, "following");
    const seeded = {
      ...fields,
      [`${MEMBER_ADD_PREFIX}${NYM_A}`]: "00000000000000000001",
      [`mbr-:${NYM_A}`]:                "00000000000000000002",
    };
    store._seed(mutableLarRecord(circleTiddlerUri("following"), seeded, "legacy-writer"));
    expect(membersOf(store, "following")).toEqual([]);   // no dotted add exists — absent either way

    const { add } = reactorsOver(store, { replica: "dev-fresh" });
    await add({ circle: "following", nym: NYM_A }, CTX);
    expect(membersOf(store, "following")).toEqual([NYM_A]);
    // The fresh add's own observed-set is EMPTY — it never had a legacy dot to observe, because the legacy
    // keys were never dots in the first place.
    const key = Object.keys(stampFieldsOf(store, "following")).find((k) => k.startsWith(`${MEMBER_ADD_PREFIX}${NYM_A}#dev-fresh.`))!;
    expect(stampFieldsOf(store, "following")[key]).toBe("");
  });

  test("MUTATION PROOF — the RETIRED reserved-dot-id reader (treating undotted as dot \"~\") would have "
    + "resurrected/removed off a stale legacy stamp; the real fold refuses to see it at all", () => {
    // Reproduces the retired behavior inline (never touching the real module) to show what it would have
    // done, then proves the real `foldMembers` does NOT: a bare undotted `mbr+:<nym>` is not present.
    function legacyFoldPresent(fields: Record<string, unknown>): string[] {
      const present: string[] = [];
      for (const key of Object.keys(fields)) {
        if (!key.startsWith(MEMBER_ADD_PREFIX)) continue;
        const nym = key.slice(MEMBER_ADD_PREFIX.length).split("#")[0]!;
        if (!fields[`mbr-:${nym}`] && !Object.keys(fields).some((k) => k.startsWith(`mbr-:${nym}#`))) present.push(nym);
      }
      return present.sort();
    }
    const fields = { [`${MEMBER_ADD_PREFIX}${NYM_A}`]: new Date().toISOString() };
    expect(legacyFoldPresent(fields)).toEqual([NYM_A]);   // the retired reader WOULD have counted it present
    expect(foldMembers(fields)).toEqual([]);              // the real, evergreen fold refuses to — it is GONE
  });

  test("M5 PROOF 5 — two devices with DISTINCT replica ids keep a concurrent unfollow visible across the merge (A∥B)", async () => {
    // F1-CONTROL shape (probe-m5-legacy.mjs): replica devA and replica devB each independently unfollow X from
    // the SAME base state (disjoint dots — different replicas never collide); devA then re-follows, observing
    // only its OWN remove (not devB's, which it has not merged yet). The key-wise merge of both forks must
    // still name X concurrent — devB's unobserved remove is never silently dropped.
    const base = { text: "", id: "following", displayName: "Following", kind: "System", createdAt: "", [`${MEMBER_ADD_PREFIX}${NYM_A}#base.0`]: "" };
    const seed = () => {
      const s = new MemoryTiddlerStore(CIRCLES_INNER);
      s._seed(mutableLarRecord(circleTiddlerUri("following"), { ...base }, "lararium-seed"));
      return s;
    };
    const storeA = seed(), storeB = seed();
    await reactorsOver(storeA, { replica: "devA" }).remove({ circle: "following", nym: NYM_A }, CTX);
    await reactorsOver(storeB, { replica: "devB" }).remove({ circle: "following", nym: NYM_A }, CTX);
    await reactorsOver(storeA, { replica: "devA" }).add({ circle: "following", nym: NYM_A }, CTX);   // A re-follows, observing only ITS OWN remove

    const merged = { ...stampFieldsOf(storeB, "following"), ...stampFieldsOf(storeA, "following") };
    const { present, concurrent } = foldMembersDetailed(merged);
    expect(present).not.toContain(NYM_A);       // remove still wins
    expect(concurrent).toEqual([NYM_A]);        // B's remove and A's re-add never observed each other

    // CONTROL: distinct replicas never collide on a dot — devA's and devB's own remove-dots stay disjoint.
    const removeDots = Object.keys(merged).filter((k) => k.startsWith(`mbr-:${NYM_A}#`));
    expect(removeDots.sort()).toEqual([`mbr-:${NYM_A}#devA.0`, `mbr-:${NYM_A}#devB.0`]);
  });

  test("M5 PROOF 2 — genuine CONCURRENCY: an unfollow that never saw a re-follow (and vice versa) reads absent and is NAMED", () => {
    // Base: NYM_A already followed by a third replica ("base"), dot base.0, nothing observed.
    const base = { [`${MEMBER_ADD_PREFIX}${NYM_A}#base.0`]: "" };
    // Replica A removes NYM_A having seen only the base add (observes base.0).
    const forkA = { ...base, [`mbr-:${NYM_A}#A.0`]: "base.0" };
    // Replica B, with NO knowledge of A's remove, concurrently re-follows NYM_A (observes nothing new).
    const forkB = { ...base, [`${MEMBER_ADD_PREFIX}${NYM_A}#B.0`]: "" };
    // Automerge merges disjoint keys — the field union models the CRDT merge.
    const merged = { ...forkA, ...forkB };

    const { present, concurrent } = foldMembersDetailed(merged);
    expect(present).not.toContain(NYM_A);      // remove wins
    expect(concurrent).toEqual([NYM_A]);        // B's add and A's remove never observed each other
  });

  test("M5 PROOF 3 — a SEQUENTIAL re-follow (one that OBSERVES the remove) resurrects, no concurrency named", async () => {
    const store = seededCircles();
    const { add, remove } = reactorsOver(store, { replica: "dev-X" });
    await add({ circle: "following", nym: NYM_A }, CTX);
    await remove({ circle: "following", nym: NYM_A }, CTX);
    expect(membersOf(store, "following")).toEqual([]);
    await add({ circle: "following", nym: NYM_A }, CTX);   // this add observes the standing remove-dot
    const { present, concurrent } = foldMembersDetailed(stampFieldsOf(store, "following"));
    expect(present).toContain(NYM_A);
    expect(concurrent).toEqual([]);
  });

  test("M5 PROOF 4 — proofs 1-3 hold identically under a set-back and a set-forward system clock (the dot carries no clock reading at all)", async () => {
    const realDateNow = Date.now;
    try {
      Date.now = () => 1_000;
      const storeA = seededCircles();
      const { add: addA, remove: remA } = reactorsOver(storeA, { replica: "clockA" });
      await addA({ circle: "following", nym: NYM_A }, CTX);
      Date.now = () => 9_999_999_999_999;
      await remA({ circle: "following", nym: NYM_A }, CTX);
      Date.now = () => 500;
      expect(membersOf(storeA, "following")).toEqual([]);   // PROOF 1 shape, under clock swings
      await addA({ circle: "following", nym: NYM_A }, CTX);
      Date.now = () => 9_999_999_999_999;
      expect(membersOf(storeA, "following")).toEqual([NYM_A]);   // PROOF 3 shape, under clock swings
    } finally {
      Date.now = realDateNow;
    }
  });

  test("MUTATION PROOF — comparing stamp VALUES (the old Lamport-counter bug) reads the legacy ISO follow as present forever", () => {
    // Reproduces the EXACT bug M5 fixes, as a self-contained inline fold (never touching the real module) to
    // prove the real fold does NOT do this. The old reader compared `addedAt > removedAt` as plain strings.
    function buggyFoldPresent(fields: Record<string, unknown>): string[] {
      const added = new Map<string, string>(), removed = new Map<string, string>();
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value !== "string") continue;
        if (key.startsWith(MEMBER_ADD_PREFIX)) added.set(key.slice(MEMBER_ADD_PREFIX.length), value);
        else if (key.startsWith("mbr-:")) removed.set(key.slice("mbr-:".length), value);
      }
      const present: string[] = [];
      for (const [nym, addedAt] of added) {
        const removedAt = removed.get(nym);
        if (removedAt === undefined || addedAt > removedAt) present.push(nym);
      }
      return present.sort();
    }
    const isoFollow = new Date().toISOString();                                  // e.g. "2026-10-11T..."
    const decimalRemove = "00000000000000000001";                                // any zero-padded counter
    const fields = { [`${MEMBER_ADD_PREFIX}${NYM_A}`]: isoFollow, [`mbr-:${NYM_A}`]: decimalRemove };
    // The bug: '0' < '2' lexically, so the buggy fold NEVER reads the ISO follow as removed.
    expect(buggyFoldPresent(fields)).toEqual([NYM_A]);
    // The real fold is immune — it never compares values, only dot-id SET MEMBERSHIP, and a legacy add
    // (dot "", observed nothing) never dominates any remove-dot that exists.
    expect(foldMembers(fields)).toEqual([]);
  });

  test("CONCURRENT-MERGE: add-on-fork-A + remove-on-fork-B (DIFFERENT nyms) merge with NO lost add", async () => {
    const base = { text: "", id: "following", displayName: "Following", kind: "System", createdAt: "", [`${MEMBER_ADD_PREFIX}${NYM_A}#base.0`]: "" };
    const seed = () => {
      const s = new MemoryTiddlerStore(CIRCLES_INNER);
      s._seed(mutableLarRecord(circleTiddlerUri("following"), { ...base }, "lararium-seed"));
      return s;
    };
    // Fork A (this device): follow a FRESH nym NYM_B — a DIFFERENT per-nym key than the base.
    const forkA = seed();
    await reactorsOver(forkA, { replica: "A" }).add({ circle: "following", nym: NYM_B }, CTX);
    // Fork B (a fleet-mate, offline & concurrent): unfollow NYM_A — disjoint keys from A's add.
    const forkB = seed();
    await reactorsOver(forkB, { replica: "B" }).remove({ circle: "following", nym: NYM_A }, CTX);

    const merged: Record<string, unknown> = { ...stampFieldsOf(forkA, "following"), ...stampFieldsOf(forkB, "following") };

    const present = foldMembers(merged);
    expect(present).toContain(NYM_B);       // NO LOST ADD
    expect(present).not.toContain(NYM_A);   // REMOVE-WINS
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
    const { add } = reactorsOver(store, { tw5: fakeTw5 });

    await add({ circle: "following", nym: NYM_A }, CTX);

    const last = rendered.at(-1)!;
    expect(last["title"]).toBe("$:/temp/lares/circles");
    expect(last["circle"]).toBe("following");
    expect(last["count"]).toBe("1");
    expect(last["nym-0"]).toBe(NYM_A);
    expect(last["petname-0"]).toBe("");   // blank — the handle-book stays local (the co-move fork)
  });

  test("two devices mint DISJOINT dots for the same nym — no replica ever collides with another's counter", async () => {
    const store = seededCircles();
    const devA = reactorsOver(store, { replica: "deviceA" });
    const devB = reactorsOver(store, { replica: "deviceB" });
    await devA.add({ circle: "following", nym: NYM_A }, CTX);
    await devB.add({ circle: "following", nym: NYM_A }, CTX);   // a different device, same nym
    const fields = stampFieldsOf(store, "following");
    const dotKeys = Object.keys(fields).filter((k) => k.startsWith(`${MEMBER_ADD_PREFIX}${NYM_A}#`));
    expect(dotKeys.sort()).toEqual([
      `${MEMBER_ADD_PREFIX}${NYM_A}#deviceA.0`,
      `${MEMBER_ADD_PREFIX}${NYM_A}#deviceB.0`,
    ]);
    expect(membersOf(store, "following")).toEqual([NYM_A]);
  });
});
