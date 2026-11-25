/**
 * share-remove-revokes — `share --remove` takes back the grants the row had landed (checks-owed).
 *
 * The door once dropped the row and sent `share-set {remove}` and nothing else: the owner's hive kept each delegation it had
 * made, so the grantee's landed grant still read after the bag stood unshared.
 *
 *   SR1 RED  `applyShares` over a row named in `unshare` revokes each lit owner -> grantee grant the row owes, delegates none,
 *            and answers the count; a grant whose face stands shut stays standing and is named, never counted revoked
 *   SR2 RED  a real hive: after `revokeAudience`, the grantee's read of the bag answers no access
 *   CONTROL  without `unshare`, the same landing delegates and revokes nothing
 */
import { describe, expect, test } from "vitest";
import { bagUri } from "@lararium/mesh/lar-uris";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { storedLarRecord } from "@lararium/mesh/stored-record";
import { type ShareEntry } from "@lararium/mesh/share-config";
import { applyShares, type ShareLitFace } from "../src/share-apply.js";
import { InMemoryEventStore, KeyhiveProvider } from "../src/index.js";

const NOTES = bagUri("notes");
const half = (rows: Record<string, string>) => {
  const doc = emptyLarDoc() as LarDoc;
  for (const [bag, url] of Object.entries(rows)) doc.tiddlers[bag] = storedLarRecord(bag, { text: url, kind: "oracle" }, "test") as never;
  return { doc: () => doc, change: (fn: (d: LarDoc) => void) => fn(doc) };
};

function landing(granteeLit: boolean) {
  const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
  const granted: string[] = [], revoked: string[] = [];
  const faces: ShareLitFace[] = [
    { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf },
    { handleIndex: 1, petname: "reader", group: granteeLit ? "g1" : null, catalog: async () => (granteeLit ? half({}) : null) },
  ];
  const rows: ShareEntry[] = [{ slug: "notes", kind: "bag", read: "reader", write: "" }];
  const run = (unshare?: readonly string[]) => applyShares({
    rows: async () => rows, faces, salt: "salt",
    grant: async (g) => { granted.push(`${g.ownerGroup}->${g.granteeGroup}`); },
    ...(unshare ? { unshare } : {}),
    revoke: async (g) => { revoked.push(`${g.ownerGroup}->${g.granteeGroup}`); },
    flag: { set: async () => {}, clear: async () => {} },
  });
  return { run, granted, revoked };
}

describe("an unshared row takes its landed grants back", () => {
  test("SR1 RED — the owner's hive revokes each grant the row owes and delegates none", async () => {
    const r = landing(true);
    const out = await r.run(["notes"]);
    expect(r.revoked).toEqual(["g0->g1"]);
    expect(r.granted, "an unshared row delegates nothing").toEqual([]);
    expect(out).toMatchObject({ revoked: 1, standing: [] });
  });

  test("SR1 — a grant whose grantee stands shut cannot be revoked here: it stays named as standing, never counted revoked", async () => {
    const r = landing(false);
    const out = await r.run(["notes"]);
    expect(r.revoked).toEqual([]);
    expect(out).toMatchObject({ revoked: 0, standing: ["notes"] });
  });

  test("CONTROL — with no `unshare`, the landing delegates and revokes nothing", async () => {
    const r = landing(true);
    await r.run();
    expect(r.granted).toEqual(["g0->g1"]);
    expect(r.revoked).toEqual([]);
  });
});

describe("RED (#428 F2) — a name a share line takes out loses its landed grant", () => {
  /** The row as it stands AFTER `--read-remove reader`: the landing revokes the retracted pair and re-delegates nothing to it. */
  function narrowed(granteeLit: boolean, write = "") {
    const ownerHalf = half({ [NOTES]: "automerge:notesDoc" });
    const granted: string[] = [], revoked: string[] = [];
    const faces: ShareLitFace[] = [
      { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => ownerHalf },
      { handleIndex: 1, petname: "reader", group: granteeLit ? "g1" : null, catalog: async () => (granteeLit ? half({}) : null) },
    ];
    const rows: ShareEntry[] = [{ slug: "notes", kind: "bag", read: write, write }];
    const run = () => applyShares({
      rows: async () => rows, faces, salt: "salt", retract: [{ slug: "notes", grantee: 1 }],
      grant: async (g) => { granted.push(`${g.ownerGroup}->${g.granteeGroup}:${g.access}`); },
      revoke: async (g) => { revoked.push(`${g.ownerGroup}->${g.granteeGroup}`); },
      flag: { set: async () => {}, clear: async () => {} },
    });
    return { run, granted, revoked };
  }

  test("a reader taken out: the owner's hive revokes it and the landing delegates nothing to it", async () => {
    const r = narrowed(true);
    expect(await r.run()).toMatchObject({ retracted: 1, stillGranted: [] });
    expect(r.revoked).toEqual(["g0->g1"]);
    expect(r.granted).toEqual([]);
  });

  test("a writer taken out who still reads: the edit grant leaves and a read grant lands in its place", async () => {
    const r = narrowed(true, "");
    const rows = [{ slug: "notes", kind: "bag" as const, read: "reader", write: "" }];
    const out = await applyShares({
      rows: async () => rows, salt: "salt", retract: [{ slug: "notes", grantee: 1 }],
      faces: [
        { handleIndex: 0, petname: "owner", group: "g0", catalog: async () => half({ [NOTES]: "automerge:notesDoc" }) },
        { handleIndex: 1, petname: "reader", group: "g1", catalog: async () => half({}) },
      ],
      grant: async (g) => { r.granted.push(`${g.ownerGroup}->${g.granteeGroup}:${g.access}`); },
      revoke: async (g) => { r.revoked.push(`${g.ownerGroup}->${g.granteeGroup}`); },
      flag: { set: async () => {}, clear: async () => {} },
    });
    expect(out).toMatchObject({ retracted: 1, stillGranted: [] });
    expect(r.revoked).toEqual(["g0->g1"]);
    expect(r.granted).toEqual(["g0->g1:read"]);
  });

  test("a grantee standing shut keeps its grant: the landing names it still granted, never counted retracted", async () => {
    const r = narrowed(false);
    expect(await r.run()).toMatchObject({ retracted: 0, stillGranted: [{ slug: "notes", grantee: 1 }] });
    expect(r.revoked).toEqual([]);
  });
});

describe("a real hive takes a bag's reader back", () => {
  test("SR2 RED — after `revokeAudience` the grantee's read answers no access; CONTROL: before it, the read stood", { timeout: 90_000 }, async () => {
    const strip = (id: string): string => id.replace(/^0x/, "").toLowerCase();
    const stand = async (fill: number): Promise<KeyhiveProvider> => {
      const p = new KeyhiveProvider();
      await p.init({ seed: new Uint8Array(32).fill(fill), eventStore: new InMemoryEventStore() });
      return p;
    };
    const owner = await stand(0xc1), reader = await stand(0xc2);
    const readerId = strip(await reader.vesselIdentifierHex());
    await owner.receiveContactCard(await reader.contactCard());
    await owner.registerBag(NOTES);
    await owner.delegate({ audience: readerId, bagUrl: NOTES, access: "read" });
    expect((await owner.verify({ bagUrl: NOTES, presenter: readerId, access: "read" })).ok).toBe(true);
    const how = await owner.revokeAudience(NOTES, readerId);
    expect(how).toBe("revoked");
    expect((await owner.verify({ bagUrl: NOTES, presenter: readerId, access: "read" })).ok).toBe(false);
  });
});
