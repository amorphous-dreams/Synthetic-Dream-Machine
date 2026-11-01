/**
 * vault-carriers.test — THE ONE CARRIER TABLE names every carrier at rest, by home, by class and by writer,
 * and the census reads the table rather than a second list.
 *
 * Eight custody classes: `floor` (outside the S key, the floor's own key material), `floor-plain` (plain bytes the
 * floor reads, or public by construction), `serving` (under SK), `hot` (S-sealed, opened at unlock), `cold`
 * (S-sealed, opened per act) `outbox` (under the outbox key the S key wraps in its own hot row), `face-hot` and `face-cold` (under a face key). Rows span identity, storage, and seal; hosting rests in face directories under identity.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CUSTODY_CLASSES, carrierTable, carrierCensus, outsideTheTable, sSealedCarriers, rotateNodeKey, sSlotsPath,
  type CustodyHomes, type CustodyClass,
} from "../src/vault-carriers.js";
import { custodyRootCarrier } from "../src/custody-root.js";
import {
  bindSlot, commitSlotTree, mintTreeKey, openSealedCarrier, openTreeKey, decodeSlotTree, writeSealedCarrier, CensusRefusal,
  TreeKeyRefusal, openOutboxParcel, readOutboxKey, restDigest, sealOutboxParcel, type SealedCarrier, type TreeKey,
} from "@lararium/mesh";
import { ScratchCustodyIo, scratchHomes } from "./custody-io-fixture.js";
import { seatScratchCustody } from "./custody-seat-fixture.js";
import { openOutboxKey, outboxKeyFile } from "../src/outbox-key.js";
import { handleRowPathIn } from "./face-paths.js";
import { readFckCarrier } from "@lararium/mesh";
import { nativeKdf } from "@lararium/mesh/node";

const HOST = "0123456789abcdef0123456789abcdef";

/** A sown path's first segment names its home on disk: `identity`, `vessel` (storage) or `nexus` (seal). */
function homeOf(segment: string): keyof CustodyHomes {
  return segment === "identity" ? "identity" : segment === "vessel" ? "storage" : "seal";
}

function sow(homes: CustodyHomes, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const [home, ...rest] = rel.split("/");
    const path = join(homes[homeOf(home!)], ...rest);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}

function freshHomes(): { homes: CustodyHomes; root: string } {
  const root = mkdtempSync(join(tmpdir(), "lar-carriers-"));
  const homes = { identity: join(root, "identity"), storage: join(root, "vessel"), seal: join(root, "nexus") };
  return { homes, root };
}

/** Every file and its bytes under `root`, hashed — the reader's write-nothing witness. */
function treeHash(root: string): string {
  const h = createHash("sha256");
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { h.update(`d:${p}\n`); walk(p); }
      else h.update(`f:${p}:`).update(readFileSync(p)).update("\n");
    }
  };
  walk(root);
  return h.digest("hex");
}

const FCID = "cd".repeat(16);

/** A home holding one file per row the table names, spelled the way each writer spells it. */
const SOWN: Record<string, string> = {
  "identity/.vessel-key.json":           "{}",
  "identity/relay-gate-seed.hex": "ab".repeat(32) + "\n",
  "identity/.vessel-kel.json":           "{}",
  "identity/.vessel-rotating.json":    "{}",
  "identity/s-slots.bin":                      "slots",
  "identity/sk-slots.bin":                      "serving",
  "identity/gate-root.bin":                  "root",
  "identity/intent-relay-key.bin": "k".repeat(32),
  "identity/intent-relay-faces.json": '{"faces":[]}',
  [`identity/faces/${FCID}/outbox-key-h0.bin`]: "x",
  [`identity/faces/${FCID}/veil-archive-g${"a".repeat(64)}.bin`]: "x",
  [`identity/faces/${FCID}/face-atom-g${"a".repeat(64)}.bin`]: "x",
  [`identity/faces/${FCID}/face-anchor-g${"a".repeat(64)}.json`]: "x",
  [`identity/faces/${FCID}/face-atom-ask-${"b".repeat(64)}.bin`]: "x",
  [`identity/faces/${FCID}/face-owner.bin`]: "x",
  [`identity/faces/${FCID}/fk-slots.bin`]: "tree",
  "identity/face-index.json":                    "{}",
  [`identity/faces/${FCID}/.persona-group-root-h0.json`]: "{}",
  [`identity/faces/${FCID}/recovery-device-share-h0.bin`]:      "x",
  [`identity/faces/${FCID}/face-proof-key-h0-${"ab".repeat(16)}.bin`]: "x",
  [`identity/faces/${FCID}/seat-key-h0-${"9e".repeat(16)}.bin`]:       "x",
  [`identity/faces/${FCID}/cadence-key-h0-${"7c".repeat(16)}.bin`]: "x",
  [`identity/faces/${FCID}/.restore-pending-h0.json`]: "x",
  [`identity/faces/${FCID}/vessel-face-key-h0-${"cd".repeat(16)}.bin`]: "x",
  [`identity/faces/${FCID}/face-address-secret-g${"5e".repeat(32)}.bin`]: "x",
  [`identity/faces/${FCID}/fleet-join-pending-g${"6e".repeat(32)}.json`]: "{}",
  [`identity/faces/${FCID}/face-join-record-g${"6f".repeat(32)}.json`]: "{}",
  "identity/switch-acts.json":                 "[]",
  "identity/.persona-enroll-pending.json":      "{}",
  "identity/.persona-grant-pending.json":       "{}",
  "identity/.persona-admissions.json":          "{}",
  [`identity/faces/${FCID}/anchors-h0.json`]:                   "{}",
  [`identity/faces/${FCID}/.persona-roster-h0.json`]: "{}",
  [`identity/faces/${FCID}/.persona-petnames-h0.json`]: "{}",
  [`identity/faces/${FCID}/.persona-declarations-h0.json`]: "{}",
  [`identity/faces/${FCID}/.persona-public-handles-h0.json`]: "{}",
  [`identity/faces/${FCID}/.handle-book-h0.json`]: "{}",
  [`identity/faces/${FCID}/recovery-contact-set-h0.json`]:              "{}",
  [`identity/faces/${FCID}/face-provisional-h0.json`]:          "{}",
  [`identity/faces/${FCID}/hosting-h0/${HOST}/state.json`]:        "{}",
  [`identity/faces/${FCID}/hosting-h0/${HOST}/spent-bafyepoch`]:   "n a b\n",
  [`identity/faces/${FCID}/hosting-h0/${HOST}/carry/guest/record.json`]: "{}",
  [`identity/faces/${FCID}/hosting-h0/${HOST}/carry/guest/blobs/abc`]:   "sealed",
  [`identity/faces/${FCID}/walk-h0-${HOST}.json`]: "{}",
  [`identity/faces/${FCID}/gate-memory-h0-${"ef".repeat(32)}.bin`]: "x",
  "vessel/sealed/lockbox/aa.bb-cc":             "x",
  "vessel/sealed/own/notes":                    "x",
  "vessel/sealed/outbox/aa.bb":                 "x",
  [`vessel/sealed/keyhive-chunks/${"ab".repeat(8)}/${"cd".repeat(16)}`]: "x",
  "nexus/founding-roster.mem":                  "charter",
  "nexus/carried/AID1/founding-roster.mem":     "charter",
  "nexus/nexus/carriage-consent/AID1.json":     "{}",
  "nexus/nexus/carriage-admit/AID1.json":       "{}",
  "nexus/nexus/key-line/AID1.json":             "[]",
  "nexus/transition-pending.json":              "{}",
  "nexus/transitions.json":                     "[]",
  [`identity/faces/${FCID}/cofound-h0-${"5a".repeat(32)}.json`]: "{}",
};

/** The ruled class of every row (refound K7, K12, K15 and the custody plan's hot and cold lists). */
const RULED: Record<string, CustodyClass> = {
  "vessel-key": "floor", "relay-gate-seed": "floor", "vessel-kel": "floor", "vessel-rotating": "floor", "s-slots": "floor", "sk-slots": "floor",
  "charter": "floor-plain", "carried-charter": "floor-plain",
  "carriage-consent": "floor-plain", "carriage-admit": "floor-plain", "nexus-key-line": "floor-plain",
  // The sealed store's rests hold no secret in the clear, and a blind carrier may hold every one (sealed-store#/the-store).
  "sealed-rest": "floor-plain", "sealed-own": "floor-plain", "sealed-chunk": "floor-plain",
  // The outbox's parcels rest under the outbox key, which its face key seals in a face-hot row.
  "sealed-outbox": "outbox", "outbox-key": "face-hot",
  "gate-root": "hot", "veil-archive": "face-hot", "face-anchor": "face-hot", "face-atom": "face-hot", "face-atom-ask": "face-hot", "face-owner": "face-hot",
  "fk-slots": "floor", "face-index": "floor-plain",
  // A session switch's acts name two faces together, so they rest sealed on this vessel and in no document.
  "switch-acts": "hot", "enroll-pending": "hot", "grant-pending": "hot", "recovery-contact-set": "face-hot", "admissions": "hot", "anchors": "face-hot",
  "persona-roster": "face-hot", "persona-petnames": "face-hot", "persona-declarations": "face-hot",
  "public-handles": "face-hot", "handle-book": "face-hot",
  "hosting-state": "face-hot", "hosting-spent": "face-hot", "hosting-carry": "face-hot", "walk": "face-hot", "gate-memory": "face-hot",
  "transition-pending": "floor-plain", "transitions": "floor-plain",
  "persona-root": "face-cold", "device-share": "face-cold",
  // The face proof's two rows, as its library rules them (`FACE_PROOF_CUSTODY_ROWS`, mesh `face-authority`).
  "vessel-face-key": "face-hot", "face-proof-key": "face-cold", "face-provisional": "face-hot",
  // The fleet-join door's three rows: a face's address secret, a join half done, and the joined face's record.
  "face-address-secret": "face-hot", "fleet-join-pending": "face-hot", "face-join-record": "face-hot",
  // A seat's own key: it opens for one signature (kahu#/seed-and-nexus).
  "seat-key": "face-cold",
  // A hearth's own cadence key and its next key: they open for one act (kahu#/contract, engine cadence ruling).
  "cadence-key": "face-cold",
  "intent-relay-key": "cold", "intent-relay-faces": "hot",
  // One joint founding's record: public material and the judged image, read at each joint signature.
  "cofound": "face-hot",
  // A restore's own commit row: one act writes it, one act removes it (custody#/the-restore).
  "restore-pending": "face-cold",
};

describe("the carrier table", () => {
  test("RED — the cold next key rests on the card alone, so no row names a next-key seed and a file spelled like one answers to no row", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/.vessel-next.json": "{}", "identity/.vessel-kel.json": "{}" });
      expect(carrierTable().map((r) => r.row)).not.toContain("vessel-next");
      const census = carrierCensus(homes);
      expect(census.filter((e) => e.file.startsWith(".vessel-next"))).toEqual([]);
      expect(census.filter((e) => e.file === ".vessel-kel.json").map((e) => e.row)).toEqual(["vessel-kel"]);   // control
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("every row reads its ruled class, and the table names no row the ruling does not", () => {
    const table = carrierTable();
    expect(Object.fromEntries(table.map((r) => [r.row, r.custody]))).toEqual(RULED);
    for (const name of ["transition-pending", "transitions"])
      expect(table.find((r) => r.row === name)).toMatchObject({ target: { classes: ["F"] }, custody: "floor-plain", keyClass: null });
    expect(table.filter((r) => r.custody === "cold").map((r) => r.row)).toEqual(["intent-relay-key"]);
    expect(new Set(table.map((r) => r.row)).size).toBe(table.length);
    for (const r of table) {
      expect(CUSTODY_CLASSES).toContain(r.custody);
      expect(r.writer.length).toBeGreaterThan(0);
    }
  });

  test("rows span the three homes: hosting, carry and walk under identity faces; charters, consents and admits under seal", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, SOWN);
      const census = carrierCensus(homes);
      const at = (home: string, file: string) => census.find((e) => e.home === home && e.file === file);
      expect(at("identity", `faces/${FCID}/hosting-h0/${HOST}/state.json`)?.row).toBe("hosting-state");
      expect(at("identity", `faces/${FCID}/hosting-h0/${HOST}/spent-bafyepoch`)?.row).toBe("hosting-spent");
      expect(at("identity", `faces/${FCID}/hosting-h0/${HOST}/carry/guest/record.json`)?.row).toBe("hosting-carry");
      expect(at("identity", `faces/${FCID}/hosting-h0/${HOST}/carry/guest/blobs/abc`)?.row).toBe("hosting-carry");
      expect(at("identity", `faces/${FCID}/walk-h0-${HOST}.json`)).toMatchObject({ row: "walk", custody: "face-hot", face: 0 });
      expect(at("identity", `faces/${FCID}/gate-memory-h0-${"ef".repeat(32)}.bin`)).toMatchObject({ row: "gate-memory", custody: "face-hot", face: 0 });
      expect(at("identity", `faces/${FCID}/outbox-key-h0.bin`)).toMatchObject({ row: "outbox-key", custody: "face-hot", face: 0 });
      expect(at("seal", "founding-roster.mem")?.row).toBe("charter");
      expect(at("seal", "carried/AID1/founding-roster.mem")?.row).toBe("carried-charter");
      expect(at("seal", "nexus/carriage-consent/AID1.json")?.row).toBe("carriage-consent");
      expect(at("seal", "nexus/carriage-admit/AID1.json")?.row).toBe("carriage-admit");
      expect(at("seal", "nexus/key-line/AID1.json")?.row).toBe("nexus-key-line");
      expect(at("seal", "transition-pending.json")).toMatchObject({ row: "transition-pending", custody: "floor-plain" });
      expect(at("seal", "transitions.json")).toMatchObject({ row: "transitions", custody: "floor-plain" });
      expect(at("identity", `faces/${FCID}/cofound-h0-${"5a".repeat(32)}.json`)).toMatchObject({ row: "cofound", custody: "face-hot", face: 0 });
      expect(at("identity", `faces/${FCID}/cadence-key-h0-${"7c".repeat(16)}.bin`)).toMatchObject({ row: "cadence-key", custody: "face-cold", face: 0, keyClass: "device-minted" });
      expect(at("identity", `faces/${FCID}/veil-archive-g${"a".repeat(64)}.bin`)).toMatchObject({ row: "veil-archive", face: `group:${"a".repeat(64)}`, bare: null });
      expect(at("identity", `faces/${FCID}/face-atom-g${"a".repeat(64)}.bin`)).toMatchObject({ row: "face-atom", face: `group:${"a".repeat(64)}`, bare: null });
      expect(at("identity", `faces/${FCID}/face-atom-ask-${"b".repeat(64)}.bin`)).toMatchObject({ row: "face-atom-ask", face: `fcid:${FCID}`, bare: null });
      expect(at("storage", "sealed/lockbox/aa.bb-cc")?.row).toBe("sealed-rest");
      expect(at("storage", "sealed/own/notes")?.row).toBe("sealed-own");
      expect(at("storage", "sealed/outbox/aa.bb")?.row).toBe("sealed-outbox");
      // A rest row's names derive from their bytes, and the row carries the check; the notes' names do not.
      expect(at("storage", "sealed/lockbox/aa.bb-cc")?.holds).not.toBeNull();
      expect(at("storage", "sealed/outbox/aa.bb")?.holds).not.toBeNull();
      expect(at("storage", "sealed/own/notes")?.holds).toBeNull();
      expect(at("storage", `sealed/keyhive-chunks/${"ab".repeat(8)}/${"cd".repeat(16)}`)?.row).toBe("sealed-chunk");
      expect(at("identity", `faces/${FCID}/anchors-h0.json`)).toMatchObject({ row: "anchors", face: 0 });
      expect(census.every((entry) => entry.face === "vessel" || typeof entry.face === "number" || entry.face.startsWith("group:") || entry.face.startsWith("fcid:"))).toBe(true);
      // Every sown file lands on exactly one row, and every row stands in the sowing.
      expect(census.length).toBe(Object.keys(SOWN).length);
      expect(new Set(census.map((e) => e.row))).toEqual(new Set(Object.keys(RULED)));
      for (const e of census) expect(e.custody).toBe(RULED[e.row]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("each sown file matches exactly ONE row — the table stays disjoint", () => {
    const table = carrierTable();
    for (const rel of Object.keys(SOWN)) {
      const [home, ...rest] = rel.split("/");
      const key = homeOf(home!);
      const path = rest.join("/");
      const hits = table.filter((r) => r.home === key && r.match.test(path));
      expect(hits.map((r) => r.row), path).toHaveLength(1);
    }
  });

  test("CONTROL: a file no row names stays out of the census, and the store's own chunks are never walked", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, {
        "identity/notes.txt": "x",
        "vessel/3f/2a/snapshot/chunk": "automerge",
        "vessel/social-bootstrap.json": "{}",
        [`identity/faces/${FCID}/hosting-h0/not-a-digest/state.json`]: "{}",
        "vessel/sealed/no-such-kind/name": "x",
        "vessel/sealed/lockbox/.hidden": "x",
        "vessel/sealed/lockbox/-dash": "x",
        "vessel/sealed/lockbox/TMP-00aa": "x",
        "nexus/elsewhere/founding-roster.mem": "x",
      });
      expect(carrierCensus(homes)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("CONTROL: absent homes census to nothing and fault nothing", () => {
    const { homes, root } = freshHomes();
    try { expect(carrierCensus(homes)).toEqual([]); } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("the census reads; it writes nothing in any home", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, SOWN);
      const before = treeHash(root);
      carrierCensus(homes);
      sSealedCarriers(homes);
      expect(treeHash(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

});

describe("the S key rotation reads its carriers from the table", { timeout: 30_000 }, () => {
  const right = { kind: "passphrase", passphrase: "the hearth remembers" } as const;
  const text = (v: string): Uint8Array => new TextEncoder().encode(v);
  const str = (b: Uint8Array): string => new TextDecoder().decode(b);

  /** A founded scratch vessel with two S-sealed identity carriers, written through the one writer. */
  async function founded(): Promise<{ io: ScratchCustodyIo; homes: CustodyHomes; treeKey: TreeKey; drop: () => void; sealed: SealedCarrier[] }> {
    const { homes, drop } = scratchHomes();
    const io = new ScratchCustodyIo(homes);
    const treeKey = mintTreeKey();
    const treePath = sSlotsPath(homes.identity);
    await commitSlotTree({ io, path: treePath, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf), carriers: sSealedCarriers(homes) });
    const sealed: SealedCarrier[] = [
      custodyRootCarrier(homes.identity),
      { name: "identity/.persona-enroll-pending.json", path: join(homes.identity, ".persona-enroll-pending.json"), keyClass: "relation" },
    ];
    for (const c of sealed) await writeSealedCarrier({ io, treeKey, treePath, carrier: c, plaintext: text(`${c.name}-v1`) });
    sow(homes, { "nexus/transition-pending.json": "{}", "nexus/transitions.json": "[]" });
    return { io, homes, treeKey, drop, sealed };
  }

  test("every hot and cold carrier standing names its S-sealed carrier by home and file; plain rows stay out", async () => {
    const v = await founded();
    try {
      sow(v.homes, { "identity/.vessel-key.json": "{}", "vessel/sealed/lockbox/aa.bb": "x" });
      const carriers = sSealedCarriers(v.homes);
      expect(carriers.map((c) => c.name).sort()).toEqual(v.sealed.map((c) => c.name).sort());
      expect(carriers.some((c) => c.name.includes("/hosting-h"))).toBe(false); // hosting belongs to a face key
      expect(carriers.find((c) => c.name === "identity/gate-root.bin")).toEqual(custodyRootCarrier(v.homes.identity));
      expect(carriers.some((c) => c.name.startsWith("seal/transition"))).toBe(false);
    } finally { v.drop(); }
  });

  test("CONTROL (P5-2): rotation re-seals S key carriers and preserves plain seal rows", async () => {
    const v = await founded();
    try {
      const plainBefore = ["transition-pending.json", "transitions.json"].map((file) => readFileSync(join(v.homes.seal, file)));
      const newTreeKey = mintTreeKey();
      await rotateNodeKey({ io: v.io, homes: v.homes, oldTreeKey: v.treeKey, newTreeKey, slots: [{ t: 1, pins: [right] }] });
      const tree = decodeSlotTree(await v.io.read(sSlotsPath(v.homes.identity)));
      const o = tree.reading === "readable" ? await openTreeKey(tree.tree, [right], nativeKdf) : null;
      expect(o?.reading).toBe("opens");
      for (const c of v.sealed) {
        const r = await openSealedCarrier({ io: v.io, treeKey: (o as { treeKey: TreeKey }).treeKey, carrier: c });
        expect(r.reading === "opens" && str(r.plaintext), c.name).toBe(`${c.name}-v1`);
      }
      for (const [i, file] of ["transition-pending.json", "transitions.json"].entries())
        expect(readFileSync(join(v.homes.seal, file)).equals(plainBefore[i]!)).toBe(true);
    } finally { v.drop(); }
  });

  test("RED (the outbox): S key rotation leaves the face-sealed key and parcel byte-identical; the face still opens both", async () => {
    const v = await seatScratchCustody("carrier-outbox");
    try {
      const outboxKey = await openOutboxKey(0);
      const keyPath = handleRowPathIn(v.homes.identity, outboxKeyFile(0));
      const keyBefore = readFileSync(keyPath);
      expect(readFckCarrier(keyBefore)).toBe("sealed");
      const parcel = sealOutboxParcel(outboxKey, "reader-one", text("a parcel"));
      const parcelPath = join(v.homes.storage, "sealed", "outbox", `${"ab".repeat(16)}.${restDigest(parcel)}`);
      mkdirSync(dirname(parcelPath), { recursive: true });
      writeFileSync(parcelPath, parcel);
      const names = sSealedCarriers(v.homes).map((c) => c.name);
      expect(names.some((n) => n.endsWith(`/${outboxKeyFile(0)}`))).toBe(false);
      expect(names.some((n) => n.includes("sealed/outbox"))).toBe(false);
      await rotateNodeKey({ io: v.io, homes: v.homes, oldTreeKey: v.treeKey, newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [right] }] });
      expect(readFileSync(keyPath).equals(keyBefore)).toBe(true);
      expect(Array.from(readFileSync(parcelPath))).toEqual(Array.from(parcel));
      expect(Array.from(await openOutboxKey(0))).toEqual(Array.from(outboxKey));
      expect(openOutboxParcel(readOutboxKey(await openOutboxKey(0))!, readFileSync(parcelPath))?.reader).toBe("reader-one");
    } finally { await v.drop(); }
  });

  test("RED (P5-2): a S-sealed file no row names refuses the rotation before any write, and every carrier still opens", async () => {
    const v = await founded();
    try {
      const stray: SealedCarrier = { name: "identity/stray.bin", path: join(v.homes.identity, "stray.bin") };
      await writeSealedCarrier({ io: v.io, treeKey: v.treeKey, treePath: sSlotsPath(v.homes.identity), carrier: stray, plaintext: text("x") });
      const before = treeHash(v.homes.identity);
      const err = await rotateNodeKey({ io: v.io, homes: v.homes, oldTreeKey: v.treeKey, newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [right] }] })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CensusRefusal);
      expect((err as CensusRefusal).uncovered).toEqual([stray.path]);
      expect(treeHash(v.homes.identity)).toBe(before);
      for (const c of v.sealed) expect((await openSealedCarrier({ io: v.io, treeKey: v.treeKey, carrier: c })).reading).toBe("opens");
    } finally { v.drop(); }
  });

  test("RED (P5-1): a stranger S key rotates nothing", async () => {
    const v = await founded();
    try {
      await expect(rotateNodeKey({ io: v.io, homes: v.homes, oldTreeKey: mintTreeKey(), newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [right] }] }))
        .rejects.toBeInstanceOf(TreeKeyRefusal);
      for (const c of v.sealed) expect((await openSealedCarrier({ io: v.io, treeKey: v.treeKey, carrier: c })).reading).toBe("opens");
    } finally { v.drop(); }
  });
});

describe("a row that rests outside the vessel key names its law", () => {
  test("RED: every floor and floor-plain row states why it rests bare; CONTROL: no serving, hot, cold or outbox row states one", () => {
    for (const r of carrierTable()) {
      if (r.custody === "floor" || r.custody === "floor-plain") expect(typeof r.bare === "string" && r.bare.length > 20, r.row).toBe(true);
      else expect(r.bare, r.row).toBeNull();
    }
    const { homes, root } = freshHomes();
    try {
      sow(homes, SOWN);
      for (const e of carrierCensus(homes)) expect(e.bare === null, e.file).toBe(e.custody === "serving" || e.custody === "hot" || e.custody === "cold" || e.custody === "outbox" || e.custody === "face-hot" || e.custody === "face-cold");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe("the census names every private file outside the table", () => {
  /** Sow one file per row, then set every sown file owner-only, the mode each real writer leaves. */
  function sownOwnerOnly(homes: CustodyHomes): void {
    sow(homes, SOWN);
    for (const e of carrierCensus(homes)) chmodSync(e.path, 0o600);
  }

  test("CONTROL: a home that holds one owner-only file per row, beside the document store's own chunks, names nothing", () => {
    const { homes, root } = freshHomes();
    try {
      sownOwnerOnly(homes);
      sow(homes, { "vessel/3f/2a/snapshot/chunk": "automerge", "vessel/social-bootstrap.json": "{}", "identity/notes.txt": "x" });
      expect(carrierCensus(homes).length).toBe(Object.keys(SOWN).length);
      expect(outsideTheTable(homes)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED: an owner-only file no row names reads `owner-only`, in any home and at any depth", () => {
    const { homes, root } = freshHomes();
    try {
      sownOwnerOnly(homes);
      sow(homes, { "identity/side-key.json": "{}", "vessel/deep/er/secret.bin": "x", "nexus/elsewhere/key.json": "{}" });
      for (const rel of ["identity/side-key.json", "vessel/deep/er/secret.bin", "nexus/elsewhere/key.json"]) {
        const [home, ...rest] = rel.split("/");
        chmodSync(join(homes[homeOf(home!)], ...rest), 0o600);
      }
      expect(outsideTheTable(homes).map((o) => [o.home, o.file, o.why])).toEqual([
        ["identity", "side-key.json", "owner-only"],
        ["storage", "deep/er/secret.bin", "owner-only"],
        ["seal", "elsewhere/key.json", "owner-only"],
      ]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("RED: a file under the vessel key's seal that no row names reads `s-seal`, whatever its mode", async () => {
    const { homes, drop } = scratchHomes();
    try {
      const io = new ScratchCustodyIo(homes);
      const treeKey = mintTreeKey();
      const treePath = sSlotsPath(homes.identity);
      await commitSlotTree({ io, path: treePath, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "passphrase", passphrase: "the hearth remembers" }] }, nativeKdf), carriers: sSealedCarriers(homes) });
      const stray: SealedCarrier = { name: "storage/stray.bin", path: join(homes.storage, "stray.bin") };
      await writeSealedCarrier({ io, treeKey, treePath, carrier: stray, plaintext: new TextEncoder().encode("x") });
      chmodSync(stray.path, 0o644);
      expect(outsideTheTable(homes).map((o) => [o.home, o.file, o.why])).toEqual([["storage", "stray.bin", "s-seal"]]);
    } finally { drop(); }
  });

  test("RED: a sidecar left standing reads `sidecar`: the sealed writer's two, and a rest's temporary file", () => {
    const { homes, root } = freshHomes();
    try {
      sownOwnerOnly(homes);
      sow(homes, { "identity/gate-root.bin.s-sealing": "x", [`identity/faces/${FCID}/hosting-h0/${HOST}/state.json.s-rotating`]: "x", "vessel/sealed/lockbox/TMP-00aa": "x" });
      expect(outsideTheTable(homes).map((o) => [o.home, o.file, o.why])).toEqual([
        ["identity", `faces/${FCID}/hosting-h0/${HOST}/state.json.s-rotating`, "sidecar"],
        ["identity", "gate-root.bin.s-sealing", "sidecar"],
        ["storage", "sealed/lockbox/TMP-00aa", "sidecar"],
      ]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("the reading writes nothing, and absent homes name nothing", () => {
    const { homes, root } = freshHomes();
    try {
      expect(outsideTheTable(homes)).toEqual([]);
      sownOwnerOnly(homes);
      const before = treeHash(root);
      outsideTheTable(homes);
      expect(treeHash(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
