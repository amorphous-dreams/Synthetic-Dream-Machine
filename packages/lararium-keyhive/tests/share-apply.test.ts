/**
 * share-apply — the share config lands by reference and delegation, never a copy.
 *
 *   SA1 — owner and grantee both lit: the grantee's catalog half takes the owner's row (its ONE document's url), the owner's
 *         hive delegates (edit for a writer), and no flag stands
 *   SA2 — the grantee stands shut: nothing lifts, an opaque flag stands (it names no face, no bag), and the next light lands it
 *         and clears the flag
 *   SA3 — a house canon bag owes no grant (it rests in the Kahu realm); a pet-name no face carries waits, named
 *   SA9 — a HOUSE CANON wiki's row delegates no canon, yet hands each grantee the wiki's recipe row by the one carry and lift
 *         a bag row rides, so the grantee reaches the wiki (the referee walk's `wiki-unreached` under a written share); a
 *         shut grantee waits behind its flag, a replay moves nothing, and an unshare takes the carry back
 *   SA10 — while the ledger binds no workbench, only a NAMED owner (the row's, or the canon row's minter) hands the recipe
 *         on or founds the realm: a grantee's replay does neither
 *   SA11 — an unshare drops the carry of every face the row names, the recipe's holder worn or not
 */
import { describe, expect, test } from "vitest";
import { bagUri, recipeUri, emptyLarDoc, seatHouseCanon, storedLarRecord, SHARE_PENDING_PREFIX, type LarDoc, type ShareEntry } from "@lararium/mesh";
import { applyShares, type ShareLitFace } from "../src/share-apply.js";

const NOTES = bagUri("notes"), SDM = bagUri("sdm");
const half = (rows: Record<string, string> = {}) => {
  const doc = emptyLarDoc() as LarDoc;
  for (const [bag, url] of Object.entries(rows)) doc.tiddlers[bag] = storedLarRecord(bag, { text: url, kind: "oracle" }, "test") as never;
  return { doc: () => doc, change: (fn: (d: LarDoc) => void) => fn(doc) };
};

function rig(opts: { granteeLit: boolean }) {
  const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
  const granteeHalf = half();
  const flags = new Set<string>();
  const grants: Array<Record<string, unknown>> = [];
  const faces = (granteeLit: boolean): ShareLitFace[] => [
    { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf },
    { handleIndex: 1, petname: "reader", group: granteeLit ? "g1" : null, catalog: async () => (granteeLit ? granteeHalf : null) },
  ];
  const rows: ShareEntry[] = [
    { slug: "notes", kind: "bag", read: "reader nobody", write: "" },
    { slug: "sdm", kind: "bag", read: "*", write: "" },
  ];
  const run = (granteeLit: boolean) => applyShares({
    rows: async () => rows, faces: faces(granteeLit), salt: "salt",
    grant: async (g) => { grants.push({ ...g }); },
    flag: { set: async (t) => { flags.add(t); }, clear: async (t) => { flags.delete(t); } },
  });
  return { ownerHalf, granteeHalf, flags, grants, run, initial: opts.granteeLit };
}

describe("the share config lands", () => {
  test("SA1 — both lit: the row lifts by reference and the owner delegates", async () => {
    const r = rig({ granteeLit: true });
    const out = await r.run(true);
    expect(out).toMatchObject({ granted: 1, pending: 0 });
    expect(JSON.stringify(r.granteeHalf.doc().tiddlers[NOTES])).toContain("automerge:notesDoc");
    expect(r.grants).toEqual([{ bag: NOTES, owner: 0, grantee: 1, access: "read", ownerGroup: "g0", granteeGroup: "g1" }]);
    expect(r.flags.size).toBe(0);
  });

  test("SA2 — the grantee shut: a flag naming nothing waits; its light lands it and clears the flag", async () => {
    const r = rig({ granteeLit: false });
    expect(await r.run(false)).toMatchObject({ granted: 0, pending: 1 });
    expect(r.granteeHalf.doc().tiddlers[NOTES]).toBeUndefined();
    const [flag] = [...r.flags];
    expect(flag!.startsWith(SHARE_PENDING_PREFIX)).toBe(true);
    expect(flag).not.toMatch(/notes|reader|owner/);
    expect(await r.run(true)).toMatchObject({ granted: 1, pending: 0 });
    expect(r.flags.size).toBe(0);
  });

  test("RED SA4 — the grantee stands LIT beside the worn owner, and its catalog half opens only while IT stands worn: the grant delegates now, its row carries in the control document, and the grantee's own wear lifts it", async () => {
    const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
    const granteeHalf = half();
    const flags = new Set<string>();
    const grants: Array<Record<string, unknown>> = [];
    const carried = new Map<string, { group: string; bag: string; row: unknown }>();
    const carry = {
      put: async (group: string, bag: string, row: unknown) => { carried.set(`${group}\n${bag}`, { group, bag, row }); },
      list: async (group: string) => [...carried.values()].filter((c) => c.group === group).map((c) => ({ bag: c.bag, row: c.row as never })),
      clear: async (group: string, bag: string) => { carried.delete(`${group}\n${bag}`); },
    };
    const rows: ShareEntry[] = [{ slug: "notes", kind: "bag", read: "reader", write: "reader" }];
    // `worn` names the one face whose catalog half this island opens; a lit sibling's half answers null, at once.
    const run = (worn: 0 | 1) => applyShares({
      rows: async () => rows, salt: "salt", carry,
      faces: [
        { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => (worn === 0 ? ownerHalf : null) },
        { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => (worn === 1 ? granteeHalf : null) },
      ],
      grant: async (g) => { grants.push({ ...g }); },
      flag: { set: async (t) => { flags.add(t); }, clear: async (t) => { flags.delete(t); } },
    });
    // The owner worn: the delegation lands and the row carries; nothing waits behind a shut face, for none stands shut.
    expect(await run(0)).toMatchObject({ granted: 1, pending: 0, carried: 1, lifted: 0 });
    expect(grants).toEqual([{ bag: NOTES, owner: 0, grantee: 1, access: "edit", ownerGroup: "g0", granteeGroup: "g1" }]);
    expect(flags.size).toBe(0);
    expect(granteeHalf.doc().tiddlers[NOTES], "no byte of the grantee's sealed half moved while another face stood worn").toBeUndefined();
    expect([...carried.values()].map((c) => `${c.group} ${c.bag}`)).toEqual([`g1 ${NOTES}`]);
    // Idempotent: the same landing again carries the same one row and delegates through the same door.
    expect(await run(0)).toMatchObject({ granted: 1, pending: 0, carried: 1 });
    expect(carried.size).toBe(1);
    // The grantee worn: its own half takes the carried row by reference, and the carry leaves the control document.
    expect(await run(1)).toMatchObject({ lifted: 1, pending: 0 });
    expect(JSON.stringify(granteeHalf.doc().tiddlers[NOTES])).toContain("automerge:notesDoc");
    expect(carried.size).toBe(0);
    // A replay lifts nothing.
    expect(await run(1)).toMatchObject({ lifted: 0 });
  });

  test("RED SA5 — a WIKI row hands the grantee the wiki's recipe row beside its canon's, so the grantee mounts the wiki: both carry, both lift", async () => {
    const RECIPE = recipeUri("catalog", "notes");
    const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
    ownerHalf.change((d) => { d.tiddlers[RECIPE] = storedLarRecord(RECIPE, { text: "{\"bags\":[]}", kind: "recipe" }, "test") as never; });
    const granteeHalf = half();
    const carried = new Map<string, { group: string; bag: string; row: unknown }>();
    const carry = {
      put: async (group: string, bag: string, row: unknown) => { carried.set(`${group}\n${bag}`, { group, bag, row }); },
      list: async (group: string) => [...carried.values()].filter((c) => c.group === group).map((c) => ({ bag: c.bag, row: c.row as never })),
      clear: async (group: string, bag: string) => { carried.delete(`${group}\n${bag}`); },
    };
    const rows: ShareEntry[] = [{ slug: "notes", kind: "wiki", read: "reader", write: "" }];
    const run = (worn: 0 | 1) => applyShares({
      rows: async () => rows, salt: "salt", carry,
      faces: [
        { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => (worn === 0 ? ownerHalf : null) },
        { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => (worn === 1 ? granteeHalf : null) },
      ],
      grant: async () => {},
      flag: { set: async () => {}, clear: async () => {} },
    });
    expect(await run(0)).toMatchObject({ granted: 1, carried: 1, pending: 0 });
    expect([...carried.values()].map((c) => c.bag).sort()).toEqual([NOTES, RECIPE].sort());
    expect(await run(1)).toMatchObject({ lifted: 2 });
    expect(JSON.stringify(granteeHalf.doc().tiddlers[RECIPE])).toContain("recipe");
    expect(JSON.stringify(granteeHalf.doc().tiddlers[NOTES])).toContain("automerge:notesDoc");
    // CONTROL: both halves open in one island (a rig, or a face that holds both): the recipe row lands directly.
    const direct = half();
    await applyShares({
      rows: async () => rows, salt: "salt",
      faces: [{ handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf }, { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => direct }],
      grant: async () => {}, flag: { set: async () => {}, clear: async () => {} },
    });
    expect(Object.keys(direct.doc().tiddlers).sort()).toEqual([NOTES, RECIPE].sort());
  });

  test("RED SA6 — a row whose bag no open catalog half names owes nothing here, and the landing names it instead of answering a bare zero", async () => {
    const rows: ShareEntry[] = [{ slug: "ghost", kind: "wiki", read: "reader", write: "" }];
    const out = await applyShares({
      rows: async () => rows, salt: "salt",
      faces: [{ handleIndex: 0, petname: "owner", group: "g0", catalog: async () => half() }, { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => null }],
      grant: async () => { throw new Error("nothing delegates"); }, flag: { set: async () => {}, clear: async () => {} },
    });
    expect(out).toMatchObject({ granted: 0, pending: 0, unowned: ["ghost"] });
    // CONTROL: a row its owner's half names reads owned.
    const r = rig({ granteeLit: true });
    expect((await r.run(true)).unowned, "the owned row reads owned; the rig's other row names a bag no half holds").toEqual(["sdm"]);
  });

  test("SA3 — house canon owes nothing; a pet-name no face carries waits named", async () => {
    // The checkout carries sdm and the crossroads board: sdm seats as house canon, the board never does.
    seatHouseCanon(["crossroads", "sdm"]);
    const r = rig({ granteeLit: true });
    const out = await r.run(true).finally(() => seatHouseCanon([]));
    expect(r.grants.some((g) => g["bag"] === SDM)).toBe(false);
    expect(out.waiting).toEqual(["nobody"]);
  });

  test("RED SA7 — a landing counts what MOVED: the first landing of a grant moves it, and a replay over a roster that already holds it moves nothing (a walked seed printed `landed 2 grant(s)` at every seed); CONTROL: the replay still answers the grant as granted, and a flag that stood counts as a move when its face lights", async () => {
    const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
    const granteeHalf = half();
    const roster = new Set<string>();
    const flags = new Set<string>();
    const rows: ShareEntry[] = [{ slug: "notes", kind: "bag", read: "reader", write: "" }];
    const run = (granteeLit = true) => applyShares({
      rows: async () => rows, salt: "salt",
      faces: [{ handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf }, { handleIndex: 1, petname: "reader", group: granteeLit ? "g1" : null, catalog: async () => (granteeLit ? granteeHalf : null) }],
      // The owner's hive answers whether the delegation stood already (the roster's own read).
      grant: async (g) => { const key = `${g.bag}\n${g.granteeGroup}\n${g.access}`; const fresh = !roster.has(key); roster.add(key); return { fresh }; },
      flag: { set: async (t) => { flags.add(t); }, clear: async (t) => { flags.delete(t); }, has: async (t) => flags.has(t) },
    });
    expect(await run()).toMatchObject({ granted: 1, moved: 1 });
    expect(await run(), "a replay grants again by reference and moves nothing").toMatchObject({ granted: 1, moved: 0 });
    // CONTROL: a grant that waited behind a flag counts as a move at the light that lands it, though the roster held it.
    expect(await run(false)).toMatchObject({ granted: 0, pending: 1, moved: 0 });
    expect(await run()).toMatchObject({ granted: 1, pending: 0, moved: 1 });
  });

  test("RED SA8 — a face the row names as a reader never acts as the bag's owner: under the grantee's own wear its half names the bag by reference, the row names another face as owner, and the landing owes nothing (a walked hearth logged `grant notes h2 -> h0`); CONTROL: under the owner's wear the grant lands", async () => {
    const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
    const granteeHalf = half({ [NOTES]: "automerge:notesDoc" });
    const grants: Array<[number, number]> = [];
    const rows: ShareEntry[] = [{ slug: "notes", kind: "wiki", read: "reader other", write: "", owner: "owner" }];
    const run = (worn: 0 | 1) => applyShares({
      rows: async () => rows, salt: "salt",
      carry: { put: async () => {}, list: async () => [], clear: async () => {} },
      faces: [
        { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => (worn === 0 ? ownerHalf : null) },
        { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => (worn === 1 ? granteeHalf : null) },
        { handleIndex: 2, petname: "other", group: "g2", catalog: async () => null },
      ],
      grant: async (g) => { grants.push([g.owner, g.grantee]); return { fresh: true }; },
      flag: { set: async () => {}, clear: async () => {} },
    });
    expect(await run(1)).toMatchObject({ granted: 0, pending: 0, moved: 0 });
    expect(grants, "the reader delegates nothing, to the owner or to another reader").toEqual([]);
    expect(await run(0)).toMatchObject({ granted: 2 });
    expect(grants).toEqual([[0, 1], [0, 2]]);
  });

  test("RED SA9 — a HOUSE CANON wiki's row hands each grantee the wiki's recipe row (no delegation: canon reads from the floor), through the carry and the wear's lift a bag row rides; a shut grantee waits behind its flag and lands at its light; a replay moves nothing; an unshare takes the carry back", async () => {
    seatHouseCanon(["referee"]);
    try {
      const REFEREE = bagUri("referee"), RECIPE = recipeUri("catalog", "referee");
      const ownerHalf = half({ [REFEREE]: "automerge:refereeCanon" });
      ownerHalf.change((d) => { d.tiddlers[RECIPE] = storedLarRecord(RECIPE, { text: "{\"bags\":[]}", kind: "recipe" }, "test") as never; });
      const granteeHalf = half();
      const flags = new Set<string>();
      const grants: Array<Record<string, unknown>> = [];
      const carried = new Map<string, { group: string; bag: string; row: unknown }>();
      const carry = {
        put: async (group: string, bag: string, row: unknown) => { carried.set(`${group}\n${bag}`, { group, bag, row }); },
        list: async (group: string) => [...carried.values()].filter((c) => c.group === group).map((c) => ({ bag: c.bag, row: c.row as never })),
        clear: async (group: string, bag: string) => { carried.delete(`${group}\n${bag}`); },
      };
      const rows: ShareEntry[] = [{ slug: "referee", kind: "wiki", read: "owner referee", write: "referee" }];
      const run = (worn: 0 | 2, opts: { granteeLit?: boolean; unshare?: string[] } = {}) => applyShares({
        rows: async () => rows, salt: "salt", carry,
        faces: [
          { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => (worn === 0 ? ownerHalf : null) },
          { handleIndex: 2, petname: "referee", group: opts.granteeLit === false ? null : "g2", catalog: async () => (worn === 2 && opts.granteeLit !== false ? granteeHalf : null) },
        ],
        grant: async (g) => { grants.push({ ...g }); return { fresh: true }; },
        revoke: async () => {},
        // The vessel's ledger binds the wiki's workbench under the face that stood it (h0), lit in every leg.
        workbenchOwner: async () => ({ bound: 0, founder: worn, boundElsewhere: true }),
        ...(opts.unshare ? { unshare: opts.unshare } : {}),
        flag: { set: async (t) => { flags.add(t); }, clear: async (t) => { flags.delete(t); }, has: async (t) => flags.has(t) },
      });
      // The grantee SHUT: the hand-over waits behind an opaque flag, named by the count; nothing carries, nothing delegates.
      expect(await run(0, { granteeLit: false })).toMatchObject({ granted: 0, pending: 1, carried: 0 });
      expect(flags.size).toBe(1);
      expect([...flags][0]).not.toMatch(/referee|owner/);
      // Its light, the owner worn: the recipe row carries for the grantee's own wear, the flag clears, and no delegation rides.
      expect(await run(0)).toMatchObject({ granted: 1, pending: 0, carried: 1, moved: 1 });
      expect(flags.size).toBe(0);
      expect(grants, "house canon delegates nothing: every face reads it from the floor").toEqual([]);
      expect([...carried.values()].map((c) => `${c.group} ${c.bag}`), "the recipe row alone carries; the canon's row stays the owner's").toEqual([`g2 ${RECIPE}`]);
      // Idempotent: the same landing again holds the same one carry.
      expect(await run(0)).toMatchObject({ granted: 1, carried: 1 });
      expect(carried.size).toBe(1);
      // The grantee worn: its own half takes the recipe row, and the carry leaves.
      expect(await run(2)).toMatchObject({ lifted: 1, pending: 0 });
      expect(JSON.stringify(granteeHalf.doc().tiddlers[RECIPE])).toContain("recipe");
      expect(granteeHalf.doc().tiddlers[REFEREE]).toBeUndefined();
      expect(carried.size).toBe(0);
      // CONTROL: both halves open in one island: the recipe row lands directly, once; a replay writes nothing more.
      const direct = half();
      const both = () => applyShares({
        rows: async () => rows, salt: "salt",
        faces: [{ handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf }, { handleIndex: 2, petname: "referee", group: "g2", catalog: async () => direct }],
        grant: async () => ({ fresh: true }), flag: { set: async () => {}, clear: async () => {} },
      });
      expect(await both()).toMatchObject({ granted: 1, moved: 1 });
      expect(Object.keys(direct.doc().tiddlers)).toEqual([RECIPE]);
      expect(await both(), "a replay over a half that names the recipe moves nothing").toMatchObject({ granted: 1, moved: 0 });
      // THE UNSHARE TAKES THE CARRY BACK: a carried recipe row the grantee never wore leaves, so no later wear lifts it.
      await run(0);
      expect(carried.size).toBe(1);
      expect(await run(0, { unshare: ["referee"] })).toMatchObject({ granted: 0, carried: 0, standing: [] });
      expect(carried.size).toBe(0);
    } finally { seatHouseCanon([]); }
  });

  /** A house canon wiki's rig with a ledger that binds NO workbench (a landing whose workbench threw after the grants carried). */
  function unboundRig() {
    const REFEREE = bagUri("referee"), RECIPE = recipeUri("catalog", "referee");
    const recipeRow = () => storedLarRecord(RECIPE, { text: "{\"bags\":[]}", kind: "recipe" }, "test") as never;
    const ownerHalf = half({ [REFEREE]: "automerge:refereeCanon" });
    ownerHalf.change((d) => { d.tiddlers[RECIPE] = recipeRow(); });
    // The grantee's own wear already lifted the recipe row: its half names the recipe and never the canon's row.
    const granteeHalf = half();
    granteeHalf.change((d) => { d.tiddlers[RECIPE] = recipeRow(); });
    const carried = new Map<string, { group: string; bag: string; row: unknown }>();
    const carry = {
      put: async (group: string, bag: string, row: unknown) => { carried.set(`${group}\n${bag}`, { group, bag, row }); },
      list: async (group: string) => [...carried.values()].filter((c) => c.group === group).map((c) => ({ bag: c.bag, row: c.row as never })),
      clear: async (group: string, bag: string) => { carried.delete(`${group}\n${bag}`); },
    };
    const founded: number[] = [];
    const rows: ShareEntry[] = [{ slug: "referee", kind: "wiki", read: "owner referee other", write: "referee" }];
    const run = (worn: 0 | 1 | 2 | null, opts: { unshare?: string[] } = {}) => applyShares({
      rows: async () => rows, salt: "salt", carry,
      faces: [
        { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => (worn === 0 ? ownerHalf : null) },
        { handleIndex: 1, petname: "other", group: "g1", catalog: async () => null },
        { handleIndex: 2, petname: "referee", group: "g2", catalog: async () => (worn === 2 ? granteeHalf : null) },
      ],
      grant: async () => ({ fresh: true }), revoke: async () => {},
      ...(opts.unshare ? { unshare: opts.unshare } : {}),
      // THE LEDGER BINDS NOTHING: the worn face would found (the daemon's port names the worn face as founder).
      workbenchOwner: async () => ({ bound: null, founder: worn, boundElsewhere: false }),
      workbench: async (row, owner) => { founded.push(owner.handleIndex); return { slug: row.slug, realmId: `realm-of-h${owner.handleIndex}`, founded: true, members: 0, removed: [] }; },
      flag: { set: async () => {}, clear: async () => {} },
    });
    return { RECIPE, carried, founded, run };
  }

  test("RED SA10 — while the ledger binds no workbench, a grantee whose wear lifted a house canon wiki's recipe row neither hands it onward nor founds the wiki's realm under itself; CONTROL: the owner who minted the canon row hands it over and founds", async () => {
    seatHouseCanon(["referee"]);
    try {
      const r = unboundRig();
      // The grantee worn (a wear's replay of the landing): no hand-over leaves its half, and no realm founds under it.
      expect(await r.run(2)).toMatchObject({ granted: 0, carried: 0, pending: 0 });
      expect([...r.carried.keys()], "the grantee hands the recipe row to no face").toEqual([]);
      expect(r.founded, "a grantee's replay founds no realm under itself").toEqual([]);
      // CONTROL: the owner worn, its half minted the canon's row: it hands the recipe to the other named faces and founds.
      expect(await r.run(0)).toMatchObject({ granted: 2, carried: 2 });
      expect([...r.carried.values()].map((c) => `${c.group} ${c.bag}`).sort()).toEqual([`g1 ${r.RECIPE}`, `g2 ${r.RECIPE}`]);
      expect(r.founded).toEqual([0]);
    } finally { seatHouseCanon([]); }
  });

  test("RED SA11 — an unshare of a house canon wiki drops the carry of every face the row names, while no face that holds the recipe stands worn; the grantee's next wear lifts nothing", async () => {
    seatHouseCanon(["referee"]);
    try {
      const r = unboundRig();
      await r.run(0);
      expect(r.carried.size).toBe(2);
      // No face worn that holds the recipe (a third face stands worn, its half naming nothing): the unshare still drops every carry.
      await r.run(1, { unshare: ["referee"] });
      expect(r.carried.size, "every face the row names loses its carry").toBe(0);
      expect(await r.run(2), "the grantee's next wear lifts nothing the share took back").toMatchObject({ lifted: 0 });
    } finally { seatHouseCanon([]); }
  });
});
