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
  CUSTODY_CLASSES, carrierTable, carrierCensus, vaultCarrierFiles, type CustodyHomes, type CustodyClass,
} from "../src/vault-carriers.js";
import { vesselKeyCensus } from "../src/key-class.js";

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
  "public-handles": "hot", "circles": "hot", "handle-book": "hot", "reserve-state": "hot",
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
