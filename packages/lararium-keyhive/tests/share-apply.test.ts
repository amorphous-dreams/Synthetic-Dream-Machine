/**
 * share-apply — the share config lands by reference and delegation, never a copy.
 *
 *   SA1 — owner and grantee both lit: the grantee's catalog half takes the owner's row (its ONE document's url), the owner's
 *         hive delegates (edit for a writer), and no flag stands
 *   SA2 — the grantee stands shut: nothing lifts, an opaque flag stands (it names no face, no bag), and the next light lands it
 *         and clears the flag
 *   SA3 — a house canon bag owes no grant (it rests in the Kahu realm); a pet-name no face carries waits, named
 */
import { describe, expect, test } from "vitest";
import { bagUri, recipeUri, emptyLarDoc, seatHouseCanon, storedLarRecord, SHARE_PENDING_PREFIX, type LarDoc, type ShareRow } from "@lararium/mesh";
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
  const rows: ShareRow[] = [
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
    const rows: ShareRow[] = [{ slug: "notes", kind: "bag", read: "reader", write: "reader" }];
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
    const rows: ShareRow[] = [{ slug: "notes", kind: "wiki", read: "reader", write: "" }];
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

  test("SA3 — house canon owes nothing; a pet-name no face carries waits named", async () => {
    // The checkout carries sdm and the crossroads board: sdm seats as house canon, the board never does.
    seatHouseCanon(["crossroads", "sdm"]);
    const r = rig({ granteeLit: true });
    const out = await r.run(true).finally(() => seatHouseCanon([]));
    expect(r.grants.some((g) => g["bag"] === SDM)).toBe(false);
    expect(out.waiting).toEqual(["nobody"]);
  });
});
