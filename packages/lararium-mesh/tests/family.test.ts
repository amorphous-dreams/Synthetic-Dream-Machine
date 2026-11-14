/**
 * family — the one family law and the consequence object (wiki-surface-scout #/meme-aware-actions).
 *
 * THE FIXTURE SPLITS THE THREE OLD LAWS. One root and seven neighbours, chosen so that a title prefix, the
 * `$fragment-parent` edge and the `kahea` references each drew a different family around the same root.
 */

import { describe, expect, test } from "vitest";
import { CARRIER_TYPE } from "../src/carrier-type.js";
import {
  consequence, familyMembers, familyOf, memeOrphanAlertTitle, orphanFamilies, orphansUnder, tombstonesOf,
  type FamilyFields, type FamilyReference, type FamilyView,
} from "../src/family.js";

const R = "lar:///ha.ka.ba/test/family";
const OTHER = "lar:///ha.ka.ba/test/other";

/** A view over a plain map. `kahea` and `loulou` read off test-only fields, standing in for the sigil scanner. */
function viewOf(records: Record<string, FamilyFields>, extra: Partial<FamilyView> = {}): FamilyView {
  return {
    titles: () => Object.keys(records),
    read: (title) => records[title],
    refs: (title, fields): FamilyReference[] => [
      ...String(fields["calls"] ?? "").split(" ").filter(Boolean).map((slot) => ({ kind: "kahea" as const, to: `${title.split("#")[0]}${slot}` })),
      ...String(fields["links"] ?? "").split(" ").filter(Boolean).map((to) => ({ kind: "loulou" as const, to })),
    ],
    version: (title) => (records[title] ? `v:${title}` : null),
    ...extra,
  };
}

const slot = (parent: string, extra: FamilyFields = {}): FamilyFields => ({ type: CARRIER_TYPE, "$fragment-parent": parent, ...extra });

function fixture(): Record<string, FamilyFields> {
  return {
    [R]:                 { type: CARRIER_TYPE, calls: "#/a #/b #/gone" },          // calls a slot nobody holds
    [`${R}#/a`]:         slot(R, { calls: "#/a/deep" }),
    [`${R}#/a/deep`]:    slot(`${R}#/a`),
    [`${R}#/b`]:         { type: CARRIER_TYPE },                                   // called, carries no parent edge
    [`${R}#/c`]:         slot(R),                                                  // parent edge, never called
    [`${R}#/stale`]:     { type: "text/vnd.tiddlywiki" },                          // the prefix alone
    [`${R}/path`]:       { type: CARRIER_TYPE, links: R },                         // its own meme, linking back
    [`${R}/plain`]:      { type: "text/vnd.tiddlywiki" },
    [OTHER]:             { type: CARRIER_TYPE, links: `${R}#/a` },
    "Plain Note":        { type: "text/vnd.tiddlywiki" },
  };
}

describe("three-laws-agree — one answer to which records make a family", () => {
  const records = fixture();
  const view = viewOf(records);
  const FAMILY = [R, `${R}#/a`, `${R}#/a/deep`, `${R}#/b`, `${R}#/c`];

  test("the old laws disagree over this fixture", () => {
    const titles = Object.keys(records);
    const prefix = titles.filter((t) => t === R || t.startsWith(`${R}#`) || t.startsWith(`${R}/`));
    const edge = titles.filter((t) => records[t]!["$fragment-parent"] === R);
    const reference = String(records[R]!["calls"]).split(" ").map((s) => R + s);
    expect(new Set(prefix)).not.toEqual(new Set([R, ...edge]));
    expect(new Set(edge)).not.toEqual(new Set(reference));
  });

  test("the family holds the root, every edge child and every called child that stands, at every depth", () => {
    expect(familyMembers(view, R)).toEqual(FAMILY);
  });

  test("every member reads the same family, whichever title a caller names", () => {
    for (const title of FAMILY) {
      const reading = familyOf(view, title);
      expect(reading.root, title).toBe(R);
      expect(reading.members, title).toEqual(FAMILY);
      expect(reading.position, title).toBe(title === R ? "root" : "slot");
    }
  });

  test("a prefix makes no member: a path child stands as its own meme, a bare fragment title stands plain", () => {
    expect(familyOf(view, `${R}/path`)).toMatchObject({ position: "root", root: `${R}/path`, members: [`${R}/path`] });
    expect(familyOf(view, `${R}/plain`)).toMatchObject({ position: "plain", root: null });
    expect(familyOf(view, `${R}#/stale`)).toMatchObject({ position: "plain", root: null });
    expect(familyOf(view, "Plain Note")).toMatchObject({ position: "plain", stands: true });
    expect(familyOf(view, "Nobody")).toMatchObject({ position: "plain", stands: false, members: [] });
  });

  test("each edge names its kind: component for a part, reference for another meme", () => {
    const edges = familyOf(view, R).edges;
    expect(edges.find((e) => e.to === `${R}#/a`)).toMatchObject({ kind: "component", via: "parent+kahea", stands: true });
    expect(edges.find((e) => e.to === `${R}#/b`)).toMatchObject({ kind: "component", via: "kahea", stands: true });
    expect(edges.find((e) => e.to === `${R}#/c`)).toMatchObject({ kind: "component", via: "parent", stands: true });
    expect(edges.find((e) => e.to === `${R}#/gone`)).toMatchObject({ kind: "component", via: "kahea", stands: false });
    expect(familyOf(view, OTHER).edges).toEqual([{ from: OTHER, to: `${R}#/a`, kind: "reference", via: "loulou", stands: true }]);
  });

  test("a carried field reads its root's family", () => {
    expect(familyOf(view, R, { field: "status" })).toMatchObject({ position: "field", field: "status", root: R, members: FAMILY });
  });

  test("the view's own child index answers the same family as the scan", () => {
    const indexed = viewOf(records, { childrenOf: (parent) => Object.keys(records).filter((t) => records[t]!["$fragment-parent"] === parent) });
    expect(familyMembers(indexed, R)).toEqual(FAMILY);
  });
});

describe("orphans — a parent chain that reaches no standing record", () => {
  test("a dead root leaves every slot beneath it an orphan of that root", () => {
    const records = fixture();
    delete records[R];
    const view = viewOf(records);
    expect(orphansUnder(view, R)).toEqual([`${R}#/a`, `${R}#/a/deep`, `${R}#/c`]);
    expect(orphanFamilies(view)).toEqual(new Map([[R, [`${R}#/a`, `${R}#/a/deep`, `${R}#/c`]]]));
    expect(familyOf(view, `${R}#/a/deep`)).toMatchObject({ position: "slot", orphan: true, root: R, rootStands: false });
    expect(memeOrphanAlertTitle(R)).toBe(`$:/temp/lares/alert/meme-orphan/${R}`);
  });

  test("a broken link under a standing root orphans the subtree beneath the break", () => {
    const records = fixture();
    delete records[`${R}#/a`];
    const view = viewOf(records);
    expect(orphanFamilies(view)).toEqual(new Map([[R, [`${R}#/a/deep`]]]));
    expect(familyMembers(view, R)).toEqual([R, `${R}#/b`, `${R}#/c`]);
  });

  test("a whole family holds no orphan", () => {
    expect(orphanFamilies(viewOf(fixture())).size).toBe(0);
  });
});

describe("consequence — what follows, named before the act", () => {
  const SLOTS = [`${R}#/a`, `${R}#/a/deep`, `${R}#/b`, `${R}#/c`];

  test("delete-root-previews-family: the family leaves as one set of tombstones, no orphan; a reference dangles into leaves", () => {
    const c = consequence(viewOf(fixture()), { kind: "delete", title: R });
    expect(c).toMatchObject({ position: "root", family: R, orphans: [], refusals: [] });
    expect(tombstonesOf(c)).toEqual([R, ...SLOTS]);
    expect(c.leaves).toEqual(expect.arrayContaining([
      { title: `${R}/path`, why: "path-child-stands-as-its-own-meme" },
      { title: `${R}/plain`, why: "path-child-stands-as-its-own-meme" },
      { title: OTHER, why: "reference-dangles:loulou" },
    ]));
    expect(tombstonesOf(c)).not.toContain(`${R}/path`);
    expect(tombstonesOf(c)).not.toContain(`${R}#/stale`);
  });

  test("control: a plain tiddler's delete names `plain` and one tombstone", () => {
    const c = consequence(viewOf(fixture()), { kind: "delete", title: "Plain Note" });
    expect(c).toMatchObject({ position: "plain", family: null, acts: [{ title: "Plain Note", act: "tombstone", bag: null }], leaves: [], orphans: [], refusals: [] });
  });

  test("a bare delete of a root names every child it orphans", () => {
    const c = consequence(viewOf(fixture()), { kind: "delete", title: R, bare: true });
    expect(tombstonesOf(c)).toEqual([R]);
    expect(c.orphans).toEqual(SLOTS);
  });

  test("delete of a slot takes its subtree and drops the parent's call in the same change", () => {
    const c = consequence(viewOf(fixture()), { kind: "delete", title: `${R}#/a` });
    expect(c.position).toBe("slot");
    expect(tombstonesOf(c)).toEqual([`${R}#/a`, `${R}#/a/deep`]);
    expect(c.acts).toContainEqual({ title: R, act: "put", bag: null });
    expect(c.leaves).toContainEqual({ title: OTHER, why: "reference-dangles:loulou" });
    const bare = consequence(viewOf(fixture()), { kind: "delete", title: `${R}#/a`, bare: true });
    expect(tombstonesOf(bare)).toEqual([`${R}#/a`]);
    expect(bare.orphans).toEqual([`${R}#/a/deep`]);
    expect(bare.leaves).toContainEqual({ title: R, why: "reference-dangles:kahea" });
  });

  test("an absent target refuses by name", () => {
    expect(consequence(viewOf(fixture()), { kind: "delete", title: "Nobody" }).refusals).toEqual([{ title: "Nobody", code: "absent" }]);
  });

  test("put: a root that stops declaring a slot tombstones that slot and spares the prefix", () => {
    const c = consequence(viewOf(fixture()), { kind: "put", title: R, lands: [R, `${R}#/a`, `${R}#/new`] });
    expect(c.acts.filter((a) => a.act === "put").map((a) => a.title)).toEqual([R, `${R}#/a`, `${R}#/new`]);
    expect(tombstonesOf(c)).toEqual([`${R}#/a/deep`, `${R}#/b`, `${R}#/c`]);
  });

  test("move-slot-refuses: a slot moves only with the root that holds it", () => {
    const view = viewOf(fixture());
    const refused = consequence(view, { kind: "move", title: `${R}#/a`, toBag: "bag:dest" });
    expect(refused.refusals).toEqual([{ title: `${R}#/a`, code: "slot-without-root" }]);
    expect(refused.acts).toEqual([]);
    expect(refused.leaves).toContainEqual({ title: R, why: "the-caller-names-the-root" });
    const widened = consequence(view, { kind: "move", title: `${R}#/a`, toBag: "bag:dest", withRoot: true });
    expect(widened.acts.filter((a) => a.act === "put").map((a) => a.title)).toEqual([R, ...SLOTS]);
    const bare = consequence(view, { kind: "copy", title: `${R}#/a`, toBag: "bag:dest", bare: true });
    expect(bare.orphans).toEqual([`${R}#/a`]);
  });

  test("control: a root move carries the family and leaves each path child", () => {
    const c = consequence(viewOf(fixture()), { kind: "move", title: R, toBag: "bag:dest" });
    expect(c.refusals).toEqual([]);
    expect(c.acts.filter((a) => a.act === "put")).toEqual([R, ...SLOTS].map((title) => ({ title, act: "put", bag: "bag:dest" })));
    expect(c.acts.filter((a) => a.act === "retract").map((a) => a.title)).toEqual([R, ...SLOTS]);
    expect(c.leaves).toContainEqual({ title: `${R}/path`, why: "path-child-stands-as-its-own-meme" });
  });

  test("rename-root-carries-family: every slot re-titles under the new root; the bare act names the orphans", () => {
    const TO = "lar:///ha.ka.ba/test/renamed";
    const c = consequence(viewOf(fixture()), { kind: "rename", title: R, to: TO });
    expect(c.acts).toEqual([R, ...SLOTS].map((title) => ({ title, act: "retitle", bag: null, to: TO + title.slice(R.length) })));
    expect(c.orphans).toEqual([]);
    expect(c.leaves).toContainEqual({ title: OTHER, why: "reference-dangles:loulou" });
    const bare = consequence(viewOf(fixture()), { kind: "rename", title: R, to: TO, bare: true });
    expect(bare.acts).toEqual([{ title: R, act: "retitle", bag: null, to: TO }]);
    expect(bare.orphans).toEqual(SLOTS);
    expect(consequence(viewOf(fixture()), { kind: "rename", title: `${R}#/a`, to: `${R}#/z` }).refusals).toEqual([{ title: `${R}#/a`, code: "slot-without-root" }]);
    expect(consequence(viewOf(fixture()), { kind: "rename", title: R, to: OTHER }).refusals).toContainEqual({ title: OTHER, code: "rename-target-stands" });
  });

  test("control: a plain rename re-titles one record", () => {
    expect(consequence(viewOf(fixture()), { kind: "rename", title: "Plain Note", to: "Other Note" }))
      .toMatchObject({ position: "plain", acts: [{ title: "Plain Note", act: "retitle", bag: null, to: "Other Note" }], orphans: [], refusals: [] });
  });

  test("a field write on a root names the carried field and the block check it moves", () => {
    const c = consequence(viewOf(fixture()), { kind: "field", title: R, field: "status", value: "draft" });
    expect(c).toMatchObject({ position: "field", family: R, acts: [{ title: R, act: "put", bag: null }], leaves: [{ title: R, why: "block-check-re-mints" }] });
  });

  test("versions name every title read or written, so an apply can bind to them", () => {
    const c = consequence(viewOf(fixture()), { kind: "delete", title: R });
    for (const title of [R, ...SLOTS]) expect(c.versions[title]).toBe(`v:${title}`);
    expect(c.versions[`${R}#/gone`]).toBeNull();
  });
});

describe("caps versus family — where a cap alone cannot decide", () => {
  const CANON = "bag:canon";
  const WORKING = "bag:working";
  const layered = (extra: Partial<FamilyView> = {}): FamilyView => {
    const records = fixture();
    const bags: Record<string, string> = Object.fromEntries(Object.keys(records).map((t) => [t, CANON]));
    bags[`${R}#/c`] = WORKING;
    return viewOf(records, { bagOf: (t) => bags[t] ?? null, writable: (bag) => bag === WORKING, workingBag: () => WORKING, ...extra });
  };

  test("a slot write under a canon root lands in working and names the root read-only", () => {
    const c = consequence(layered(), { kind: "put", title: `${R}#/c` });
    expect(c).toMatchObject({ family: R, refusals: [], acts: [{ title: `${R}#/c`, act: "put", bag: WORKING }] });
    expect(c.leaves).toContainEqual({ title: R, why: `read-only:${CANON}` });
  });

  test("a root delete names every shadowing tombstone and its layer", () => {
    const c = consequence(layered(), { kind: "delete", title: R });
    expect(c.refusals).toEqual([]);
    expect(c.acts).toContainEqual({ title: R, act: "tombstone", bag: WORKING, shadows: CANON });
    expect(c.acts).toContainEqual({ title: `${R}#/c`, act: "tombstone", bag: WORKING });
    expect(c.leaves).toContainEqual({ title: R, why: `stands-beneath:${CANON}` });
  });

  test("with no working layer the same delete refuses, naming each member the grant cannot reach", () => {
    const c = consequence(layered({ workingBag: () => null }), { kind: "delete", title: R });
    expect(c.refusals).toContainEqual({ title: R, code: "family-spans-unwritable-layer" });
    expect(c.refusals).not.toContainEqual({ title: `${R}#/c`, code: "family-spans-unwritable-layer" });
  });

  test("a root rename refuses while any member rests in a bag the grant cannot write", () => {
    const c = consequence(layered(), { kind: "rename", title: R, to: "lar:///ha.ka.ba/test/renamed" });
    expect(c.refusals).toContainEqual({ title: R, code: "family-spans-unwritable-layer" });
    expect(c.family).toBe(R);
  });

  test("a reader's seat refuses before any write and still names the family", () => {
    const c = consequence(layered({ readOnly: true }), { kind: "delete", title: `${R}#/c` });
    expect(c.refusals).toContainEqual({ title: `${R}#/c`, code: "read-only-seat" });
    expect(c.family).toBe(R);
  });
});
