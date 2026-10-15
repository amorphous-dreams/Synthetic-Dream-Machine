/**
 * vault-carriers.test — THE ONE CARRIER TABLE names every carrier at rest, by home, by class and by writer,
 * and the census reads the table rather than a second list.
 *
 * Six custody classes: `floor` (outside the VK, the floor's own key material), `floor-plain` (plain bytes the
 * floor reads, or public by construction), `serving` (under SK), `hot` (VK-sealed, opened at unlock), `cold`
 * (VK-sealed, opened per act) and `outbox` (under the outbox key the VK wraps in its own hot row). Rows span three homes: the identity home, the storage directory (its
 * `hosting/` and `walk/` subtrees) and the seal home.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CUSTODY_CLASSES, carrierTable, carrierCensus, outsideTheTable, vkSealedCarriers, rotateVesselVk, vkSlotsPath,
  type CustodyHomes, type CustodyClass,
} from "../src/vault-carriers.js";
import { custodyRootCarrier } from "../src/custody-root.js";
import {
  bindSlot, commitSlotTree, mintVk, openSealedCarrier, openVk, decodeSlotTree, writeSealedCarrier, CensusRefusal,
  TreeVkRefusal, mintOutboxKey, openOutboxParcel, readOutboxKey, restDigest, sealOutboxParcel, type SealedCarrier, type VesselKey,
} from "@lararium/mesh";
import { ScratchCustodyIo, scratchHomes } from "./custody-io-fixture.js";

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

/** A home holding one file per row the table names, spelled the way each writer spells it. */
const SOWN: Record<string, string> = {
  "identity/.vessel-key-joshua.json":           "{}",
  "identity/.vessel-kel-joshua.json":           "{}",
  "identity/.vessel-card-joshua.json":          "{}",
  "identity/vk-slots.bin":                      "slots",
  "identity/sk-slots.bin":                      "serving",
  "identity/custody-root.bin":                  "root",
  "identity/outbox-key.bin":                    "x",
  "identity/keyhive-archive.bin":               "x",
  "identity/veil-archive-h0.bin":               "x",
  "identity/.persona-group-root-joshua-h0.json": "{}",
  "identity/recovery-device-share-h0.bin":      "x",
  [`identity/face-proof-key-h0-${"ab".repeat(16)}.bin`]: "x",
  [`identity/seat-key-h0-${"9e".repeat(16)}.bin`]:       "x",
  [`identity/cadence-key-${"7c".repeat(16)}.bin`]:       "x",
  "identity/.restore-pending.json": "x",
  [`identity/vessel-face-key-${"cd".repeat(16)}.bin`]:   "x",
  "identity/.persona-enroll-pending.json":      "{}",
  "identity/.persona-grant-pending.json":       "{}",
  "identity/.persona-admissions.json":          "{}",
  "identity/anchors-h0.json":                   "{}",
  "identity/anchor-roster.json":                "{}",
  "identity/.persona-roster-joshua.json":       "{}",
  "identity/.active-persona-joshua.json":       "{}",
  "identity/.persona-petnames-joshua.json":     "{}",
  "identity/.persona-declarations-joshua.json": "{}",
  "identity/.persona-public-handles-joshua.json": "{}",
  "identity/.handle-book.json":                 "{}",
  "identity/guardian-set-h0.json":              "{}",
  "identity/face-provisional-h0.json":          "{}",
  [`vessel/hosting/${HOST}/state.json`]:        "{}",
  [`vessel/hosting/${HOST}/spent-bafyepoch`]:   "n a b\n",
  [`vessel/hosting/${HOST}/carry/guest/record.json`]: "{}",
  [`vessel/hosting/${HOST}/carry/guest/blobs/abc`]:   "sealed",
  [`vessel/walk/${HOST}.json`]:                 "{}",
  [`vessel/gate-memory/${"ef".repeat(32)}.bin`]: "x",
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
  "nexus/transitions.json":                     "{}",
  [`nexus/cofound-${"5a".repeat(32)}.json`]:     "{}",
};

/** The ruled class of every row (refound K7, K12, K15 and the custody plan's hot and cold lists). */
const RULED: Record<string, CustodyClass> = {
  "vessel-key": "floor", "vessel-kel": "floor", "vk-slots": "floor", "sk-slots": "floor",
  "vessel-card": "floor-plain", "charter": "floor-plain", "carried-charter": "floor-plain",
  "carriage-consent": "floor-plain", "carriage-admit": "floor-plain", "nexus-key-line": "floor-plain",
  // The sealed store's rests hold no secret in the clear, and a blind carrier may hold every one (sealed-store#/the-store).
  "sealed-rest": "floor-plain", "sealed-own": "floor-plain", "sealed-chunk": "floor-plain",
  // The outbox's parcels rest under the outbox key, which the VK wraps in its own hot row (custody#/the-table, the outbox).
  "sealed-outbox": "outbox", "outbox-key": "hot",
  "custody-root": "hot", "keyhive-archive": "hot", "veil-archive": "hot",
  "enroll-pending": "hot", "grant-pending": "hot", "guardian-set": "hot", "admissions": "hot", "anchors": "hot", "anchor-roster": "hot",
  "persona-roster": "hot", "active-persona": "hot", "persona-petnames": "hot", "persona-declarations": "hot",
  "public-handles": "hot", "handle-book": "hot",
  "hosting-state": "hot", "hosting-spent": "hot", "hosting-carry": "hot", "walk": "hot", "gate-memory": "hot",
  "transition-pending": "hot", "transitions": "hot",
  "persona-root": "cold", "device-share": "cold",
  // The face proof's two rows, as its library rules them (`FACE_PROOF_CUSTODY_ROWS`, mesh `face-authority`).
  "vessel-face-key": "hot", "face-proof-key": "cold", "face-provisional": "hot",
  // A seat's own key: it opens for one signature (kahu#/seed-and-nexus).
  "seat-key": "cold",
  // A hearth's own cadence key and its next key: they open for one act (kahu#/contract, engine cadence ruling).
  "cadence-key": "cold",
  // One joint founding's record: public material and the judged image, read at each joint signature.
  "cofound": "hot",
  // A restore's own commit row: one act writes it, one act removes it (custody#/the-restore).
  "restore-pending": "cold",
};

describe("the carrier table", () => {
  test("RED — the floor key commits no next key, so no row names a next-key seed and a file spelled like one answers to no row", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/.vessel-next-joshua.json": "{}", "identity/.vessel-next.json": "{}", "identity/.vessel-kel.json": "{}" });
      expect(carrierTable().map((r) => r.row)).not.toContain("vessel-next");
      const census = carrierCensus(homes);
      expect(census.filter((e) => e.file.startsWith(".vessel-next"))).toEqual([]);
      expect(census.filter((e) => e.file === ".vessel-kel.json").map((e) => e.row)).toEqual(["vessel-kel"]);   // control
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("every row reads its ruled class, and the table names no row the ruling does not", () => {
    const table = carrierTable();
    expect(Object.fromEntries(table.map((r) => [r.row, r.custody]))).toEqual(RULED);
    expect(new Set(table.map((r) => r.row)).size).toBe(table.length);
    for (const r of table) {
      expect(CUSTODY_CLASSES).toContain(r.custody);
      expect(r.writer.length).toBeGreaterThan(0);
    }
  });

  test("rows span the three homes: hosting, carry and walk under storage; charters, consents and admits under the seal home", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, SOWN);
      const census = carrierCensus(homes);
      const at = (home: string, file: string) => census.find((e) => e.home === home && e.file === file);
      expect(at("storage", `hosting/${HOST}/state.json`)?.row).toBe("hosting-state");
      expect(at("storage", `hosting/${HOST}/spent-bafyepoch`)?.row).toBe("hosting-spent");
      expect(at("storage", `hosting/${HOST}/carry/guest/record.json`)?.row).toBe("hosting-carry");
      expect(at("storage", `hosting/${HOST}/carry/guest/blobs/abc`)?.row).toBe("hosting-carry");
      expect(at("storage", `walk/${HOST}.json`)?.row).toBe("walk");
      expect(at("seal", "founding-roster.mem")?.row).toBe("charter");
      expect(at("seal", "carried/AID1/founding-roster.mem")?.row).toBe("carried-charter");
      expect(at("seal", "nexus/carriage-consent/AID1.json")?.row).toBe("carriage-consent");
      expect(at("seal", "nexus/carriage-admit/AID1.json")?.row).toBe("carriage-admit");
      expect(at("seal", "nexus/key-line/AID1.json")?.row).toBe("nexus-key-line");
      expect(at("seal", "transitions.json")?.custody).toBe("hot");
      expect(at("seal", `cofound-${"5a".repeat(32)}.json`)).toMatchObject({ row: "cofound", custody: "hot", face: "vessel" });
      expect(at("identity", `cadence-key-${"7c".repeat(16)}.bin`)).toMatchObject({ row: "cadence-key", custody: "cold", face: "vessel", keyClass: "device-minted" });
      expect(at("identity", "keyhive-archive.bin")).toMatchObject({ row: "keyhive-archive", face: "vessel", bare: null });
      expect(at("identity", "veil-archive-h0.bin")).toMatchObject({ row: "veil-archive", face: 0, bare: null });
      expect(at("storage", "sealed/lockbox/aa.bb-cc")?.row).toBe("sealed-rest");
      expect(at("storage", "sealed/own/notes")?.row).toBe("sealed-own");
      expect(at("storage", "sealed/outbox/aa.bb")?.row).toBe("sealed-outbox");
      // A rest row's names derive from their bytes, and the row carries the check; the notes' names do not.
      expect(at("storage", "sealed/lockbox/aa.bb-cc")?.holds).not.toBeNull();
      expect(at("storage", "sealed/outbox/aa.bb")?.holds).not.toBeNull();
      expect(at("storage", "sealed/own/notes")?.holds).toBeNull();
      expect(at("storage", `sealed/keyhive-chunks/${"ab".repeat(8)}/${"cd".repeat(16)}`)?.row).toBe("sealed-chunk");
      expect(at("identity", "anchors-h0.json")).toMatchObject({ row: "anchors", face: 0 });
      expect(census.every((entry) => entry.face === "vessel" || typeof entry.face === "number")).toBe(true);
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
        "vessel/hosting/not-a-digest/state.json": "{}",
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
      vkSealedCarriers(homes);
      expect(treeHash(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

});

describe("the VK rotation reads its carriers from the table", { timeout: 30_000 }, () => {
  const right = { kind: "passphrase", passphrase: "the hearth remembers" } as const;
  const text = (v: string): Uint8Array => new TextEncoder().encode(v);
  const str = (b: Uint8Array): string => new TextDecoder().decode(b);

  /** A founded scratch vessel with one VK-sealed carrier in each home, written through the one writer. */
  async function founded(): Promise<{ io: ScratchCustodyIo; homes: CustodyHomes; vk: VesselKey; drop: () => void; sealed: SealedCarrier[] }> {
    const { homes, drop } = scratchHomes();
    const io = new ScratchCustodyIo(homes);
    const vk = mintVk();
    const treePath = vkSlotsPath(homes.identity);
    await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [right] }), carriers: vkSealedCarriers(homes) });
    const sealed: SealedCarrier[] = [
      custodyRootCarrier(homes.identity),
      { name: `storage/walk/${HOST}.json`, path: join(homes.storage, "walk", `${HOST}.json`) },
      { name: "seal/transitions.json", path: join(homes.seal, "transitions.json") },
      { name: "identity/recovery-device-share-h1.bin", path: join(homes.identity, "recovery-device-share-h1.bin") },
    ];
    for (const c of sealed) await writeSealedCarrier({ io, vk, treePath, carrier: c, plaintext: text(`${c.name}-v1`) });
    return { io, homes, vk, drop, sealed };
  }

  test("every hot and cold carrier standing names its VK-sealed carrier by home and file; floor rows stay out", async () => {
    const v = await founded();
    try {
      sow(v.homes, { "identity/.vessel-key-joshua.json": "{}", "identity/.vessel-card-joshua.json": "{}", "vessel/sealed/lockbox/aa.bb": "x" });
      const carriers = vkSealedCarriers(v.homes);
      expect(carriers.map((c) => c.name).sort()).toEqual(v.sealed.map((c) => c.name).sort());
      expect(carriers.find((c) => c.name === "identity/custody-root.bin")).toEqual(custodyRootCarrier(v.homes.identity));
    } finally { v.drop(); }
  });

  test("CONTROL (P5-2): the rotation re-seals every carrier the table names, across all three homes", async () => {
    const v = await founded();
    try {
      const newVk = mintVk();
      await rotateVesselVk({ io: v.io, homes: v.homes, oldVk: v.vk, newVk, slots: [{ t: 1, pins: [right] }] });
      const tree = decodeSlotTree(await v.io.read(vkSlotsPath(v.homes.identity)));
      const o = tree.reading === "readable" ? openVk(tree.tree, [right]) : null;
      expect(o?.reading).toBe("opens");
      for (const c of v.sealed) {
        const r = await openSealedCarrier({ io: v.io, vk: (o as { vk: VesselKey }).vk, carrier: c });
        expect(r.reading === "opens" && str(r.plaintext), c.name).toBe(`${c.name}-v1`);
      }
    } finally { v.drop(); }
  });

  test("RED (the outbox): the rotation re-seals the outbox key's row and reads no parcel — a sealed parcel stays byte-identical and the key opens under the new VK", async () => {
    const v = await founded();
    try {
      const keyCarrier: SealedCarrier = { name: "identity/outbox-key.bin", path: join(v.homes.identity, "outbox-key.bin") };
      const outboxKey = mintOutboxKey();
      await writeSealedCarrier({ io: v.io, vk: v.vk, treePath: vkSlotsPath(v.homes.identity), carrier: keyCarrier, plaintext: outboxKey });
      const parcel = sealOutboxParcel(outboxKey, "reader-one", text("a parcel"));
      const parcelPath = join(v.homes.storage, "sealed", "outbox", `${"ab".repeat(16)}.${restDigest(parcel)}`);
      mkdirSync(dirname(parcelPath), { recursive: true });
      writeFileSync(parcelPath, parcel);
      const names = vkSealedCarriers(v.homes).map((c) => c.name);
      expect(names).toContain("identity/outbox-key.bin");
      expect(names.some((n) => n.includes("sealed/outbox"))).toBe(false);
      const newVk = mintVk();
      await rotateVesselVk({ io: v.io, homes: v.homes, oldVk: v.vk, newVk, slots: [{ t: 1, pins: [right] }] });
      expect(Array.from(readFileSync(parcelPath))).toEqual(Array.from(parcel));
      const tree = decodeSlotTree(await v.io.read(vkSlotsPath(v.homes.identity)));
      const o = tree.reading === "readable" ? openVk(tree.tree, [right]) : null;
      const opened = await openSealedCarrier({ io: v.io, vk: (o as { vk: VesselKey }).vk, carrier: keyCarrier });
      expect(opened.reading === "opens" && Array.from(opened.plaintext)).toEqual(Array.from(outboxKey));
      expect(openOutboxParcel(readOutboxKey(opened.reading === "opens" ? opened.plaintext : null)!, readFileSync(parcelPath))?.reader).toBe("reader-one");
    } finally { v.drop(); }
  });

  test("RED (P5-2): a VK-sealed file no row names refuses the rotation before any write, and every carrier still opens", async () => {
    const v = await founded();
    try {
      const stray: SealedCarrier = { name: "identity/stray.bin", path: join(v.homes.identity, "stray.bin") };
      await writeSealedCarrier({ io: v.io, vk: v.vk, treePath: vkSlotsPath(v.homes.identity), carrier: stray, plaintext: text("x") });
      const before = treeHash(v.homes.identity);
      const err = await rotateVesselVk({ io: v.io, homes: v.homes, oldVk: v.vk, newVk: mintVk(), slots: [{ t: 1, pins: [right] }] })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CensusRefusal);
      expect((err as CensusRefusal).uncovered).toEqual([stray.path]);
      expect(treeHash(v.homes.identity)).toBe(before);
      for (const c of v.sealed) expect((await openSealedCarrier({ io: v.io, vk: v.vk, carrier: c })).reading).toBe("opens");
    } finally { v.drop(); }
  });

  test("RED (P5-1): a stranger VK rotates nothing", async () => {
    const v = await founded();
    try {
      await expect(rotateVesselVk({ io: v.io, homes: v.homes, oldVk: mintVk(), newVk: mintVk(), slots: [{ t: 1, pins: [right] }] }))
        .rejects.toBeInstanceOf(TreeVkRefusal);
      for (const c of v.sealed) expect((await openSealedCarrier({ io: v.io, vk: v.vk, carrier: c })).reading).toBe("opens");
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
      for (const e of carrierCensus(homes)) expect(e.bare === null, e.file).toBe(e.custody === "serving" || e.custody === "hot" || e.custody === "cold" || e.custody === "outbox");
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

  test("RED: a file under the vessel key's seal that no row names reads `vk-seal`, whatever its mode", async () => {
    const { homes, drop } = scratchHomes();
    try {
      const io = new ScratchCustodyIo(homes);
      const vk = mintVk();
      const treePath = vkSlotsPath(homes.identity);
      await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [{ kind: "passphrase", passphrase: "the hearth remembers" }] }), carriers: vkSealedCarriers(homes) });
      const stray: SealedCarrier = { name: "storage/stray.bin", path: join(homes.storage, "stray.bin") };
      await writeSealedCarrier({ io, vk, treePath, carrier: stray, plaintext: new TextEncoder().encode("x") });
      chmodSync(stray.path, 0o644);
      expect(outsideTheTable(homes).map((o) => [o.home, o.file, o.why])).toEqual([["storage", "stray.bin", "vk-seal"]]);
    } finally { drop(); }
  });

  test("RED: a sidecar left standing reads `sidecar`: the sealed writer's two, and a rest's temporary file", () => {
    const { homes, root } = freshHomes();
    try {
      sownOwnerOnly(homes);
      sow(homes, { "identity/custody-root.bin.vk-sealing": "x", "nexus/transitions.json.vk-rotating": "x", "vessel/sealed/lockbox/TMP-00aa": "x" });
      expect(outsideTheTable(homes).map((o) => [o.home, o.file, o.why])).toEqual([
        ["identity", "custody-root.bin.vk-sealing", "sidecar"],
        ["storage", "sealed/lockbox/TMP-00aa", "sidecar"],
        ["seal", "transitions.json.vk-rotating", "sidecar"],
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
