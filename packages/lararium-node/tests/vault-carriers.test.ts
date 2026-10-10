/**
 * vault-carriers.test — THE ONE CARRIER TABLE names every carrier at rest, by home, by class and by writer,
 * and the census reads the table rather than a second list.
 *
 * Four custody classes and no fifth: `floor` (outside the VK, the floor's own key material), `floor-plain`
 * (plain bytes the floor reads, or public by construction), `hot` (VK-sealed, opened at unlock), `cold`
 * (VK-sealed, opened per act). Rows span three homes: the identity home, the storage directory (its
 * `hosting/` and `walk/` subtrees) and the seal home.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  CUSTODY_CLASSES, carrierTable, carrierCensus, vaultCarrierFiles, vkSealedCarriers, rotateVesselVk, vkSlotsPath,
  type CustodyHomes, type CustodyClass,
} from "../src/vault-carriers.js";
import { vesselKeyCensus } from "../src/key-class.js";
import { custodyRootCarrier } from "../src/custody-root.js";
import {
  bindSlot, commitSlotTree, mintVk, openSealedCarrier, openVk, decodeSlotTree, writeSealedCarrier, CensusRefusal,
  TreeVkRefusal, type SealedCarrier, type VesselKey,
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
  "identity/.vessel-next-joshua.json":          "{}",
  "identity/.vessel-card-joshua.json":          "{}",
  "identity/vk-slots.bin":                      "slots",
  "identity/custody-root.bin":                  "root",
  "identity/keyhive-archive.bin":               "x",
  "identity/veil-archive.bin":                  "x",
  "identity/.persona-group-root-joshua-h0.json": "{}",
  "identity/recovery-device-share-h0.bin":      "x",
  "identity/seal-reserve-mine-share.bin":       "x",
  "identity/seal-reserve-state.json":           "{}",
  "identity/.nexus-convergence-secrets.json":   "{}",
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
  "identity/.circles-follow.json":              "{}",
  "identity/.handle-book.json":                 "{}",
  "identity/.archive-seal-day.json":            "{}",
  [`vessel/hosting/${HOST}/state.json`]:        "{}",
  [`vessel/hosting/${HOST}/spent-bafyepoch`]:   "n a b\n",
  [`vessel/hosting/${HOST}/carry/guest/record.json`]: "{}",
  [`vessel/hosting/${HOST}/carry/guest/blobs/abc`]:   "sealed",
  [`vessel/walk/${HOST}.json`]:                 "{}",
  "nexus/founding-roster.mem":                  "charter",
  "nexus/carried/AID1/founding-roster.mem":     "charter",
  "nexus/nexus/carriage-consent/AID1.json":     "{}",
  "nexus/nexus/carriage-admit/AID1.json":       "{}",
  "nexus/transition-pending.json":              "{}",
  "nexus/transitions.json":                     "{}",
};

/** The ruled class of every row (refound K7, K12, K15 and the custody plan's hot and cold lists). */
const RULED: Record<string, CustodyClass> = {
  "vessel-key": "floor", "vessel-kel": "floor", "vk-slots": "floor",
  "vessel-card": "floor-plain", "charter": "floor-plain", "carried-charter": "floor-plain",
  "carriage-consent": "floor-plain", "carriage-admit": "floor-plain",
  "custody-root": "hot", "keyhive-archive": "hot", "veil-archive": "hot", "keyring": "hot",
  "enroll-pending": "hot", "grant-pending": "hot", "admissions": "hot", "anchors": "hot", "anchor-roster": "hot",
  "persona-roster": "hot", "active-persona": "hot", "persona-petnames": "hot", "persona-declarations": "hot",
  "public-handles": "hot", "circles": "hot", "handle-book": "hot", "reserve-state": "hot", "seal-day": "hot",
  "hosting-state": "hot", "hosting-spent": "hot", "hosting-carry": "hot", "walk": "hot",
  "transition-pending": "hot", "transitions": "hot",
  "vessel-next": "cold", "persona-root": "cold", "device-share": "cold", "reserve-share": "cold",
};

describe("the carrier table", () => {
  test("RED — the census names the vessel KEL's next seed COLD", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/.vessel-next-joshua.json": "{}", "identity/.vessel-next.json": "{}" });
      const keys = vesselKeyCensus(homes.identity);
      const next = keys.filter((k) => k.name === "vessel-next");
      expect(next.map((k) => k.file)).toEqual([".vessel-next-joshua.json", ".vessel-next.json"]);
      for (const k of next) { expect(k.custody).toBe("cold"); expect(k.class).toBe("device-minted"); }
      const census = carrierCensus(homes).filter((e) => e.row === "vessel-next");
      expect(census.map((e) => e.custody)).toEqual(["cold", "cold"]);
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
      expect(at("seal", "transitions.json")?.custody).toBe("hot");
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
      vesselKeyCensus(homes.identity);
      vaultCarrierFiles(homes.identity);
      expect(treeHash(root)).toBe(before);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test("the seal lifecycle's carriers derive from the same rows the census reads", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, SOWN);
      const lifecycle = carrierCensus(homes).filter((e) => e.lifecycle !== null);
      expect(new Set(lifecycle.map((e) => e.file))).toEqual(vaultCarrierFiles(homes.identity));
      expect(lifecycle.map((e) => e.lifecycle).sort()).toEqual(["archive", "device-share-h0", "reserve-share", "veil"]);
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
    await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [right] }) });
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
      sow(v.homes, { "identity/.vessel-key-joshua.json": "{}", "identity/.vessel-card-joshua.json": "{}" });
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

describe("the seal-day stamp", () => {
  test("RED (L4): `.archive-seal-day.json` rests under its own row, so the census never misses it", () => {
    const { homes, root } = freshHomes();
    try {
      sow(homes, { "identity/.archive-seal-day.json": "{}" });
      const census = carrierCensus(homes);
      expect(census.map((e) => [e.row, e.custody, e.keyClass])).toEqual([["seal-day", "hot", null]]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
