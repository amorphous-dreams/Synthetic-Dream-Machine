/**
 * share-apply — the share config lands by reference and delegation, never a copy.
 *
 *   SA1 — owner and grantee both lit: the grantee's catalog half takes the owner's row (its ONE document's url), the owner's
 *         hive delegates (edit for a writer), and no flag stands
 *   SA2 — the grantee stands shut: nothing lifts, an opaque flag stands (it names no face, no bag), and the next light lands it
 *         and clears the flag
 *   SA3 — a vessel-tier bag owes no grant; a pet-name no face carries waits, named
 */
import { describe, expect, test } from "vitest";
import { bagUri, emptyLarDoc, storedLarRecord, SHARE_PENDING_PREFIX, type LarDoc, type ShareRow } from "@lararium/mesh";
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
  const floor = half({ [SDM]: "automerge:sdmDoc" });
  floor.doc().tiddlers[SDM] = storedLarRecord(SDM, { text: "automerge:sdmDoc", kind: "oracle", "cap-tier": "vessel" }, "test") as never;
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
    rows: async () => rows, faces: faces(granteeLit), floor: async () => floor.doc(), salt: "salt",
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

  test("SA3 — vessel tier owes nothing; a pet-name no face carries waits named", async () => {
    const r = rig({ granteeLit: true });
    const out = await r.run(true);
    expect(r.grants.some((g) => g["bag"] === SDM)).toBe(false);
    expect(out.waiting).toEqual(["nobody"]);
  });
});
