/**
 * key-class.test — EVERY KEY NAMES ITS CLASS in the one custody reading (`custodyStatus`, printed by `vault status`).
 *
 * The vocabulary stands closed in mesh (`device-minted` · `seed` · `cloud-synced` · `relation`). The custody status
 * reads each standing file ONCE and carries three facts on that one line, and none answers for another:
 *   `keyClass` — what kind of secret the file holds, off its row of the carrier table;
 *   `custody`  — where the vessel key holds it (`floor` · `floor-plain` · `hot` · `cold`), off the same row;
 *   `reading`  — what the bytes standing there read as.
 * Three rows read `seed` and all three rest `cold`; a sweep keyed on the class alone could not tell a sealed root
 * from a bare one, so the reading rides beside the class and a hot or cold row that reads anything but `sealed`
 * reads as a fault.
 */
import { describe, test, expect } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isKeyClass } from "@lararium/mesh";
import { carrierTable, type CustodyHomes } from "../src/vault-carriers.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { custodyStatus, foundCustody, type CustodyStatusRow } from "../src/custody-session.js";

function scratch(): { homes: CustodyHomes; drop: () => void } {
  const base = mkdtempSync(join(tmpdir(), "lar-key-class-"));
  const homes = { identity: join(base, "identity"), storage: join(base, "storage"), seal: join(base, "seal") };
  mkdirSync(homes.identity, { recursive: true });
  return { homes, drop: () => rmSync(base, { recursive: true, force: true }) };
}

async function rowsOf(homes: CustodyHomes, files: Record<string, string | Uint8Array>): Promise<Map<string, CustodyStatusRow>> {
  for (const [name, body] of Object.entries(files)) writeFileSync(join(homes.identity, name), body);
  const status = await custodyStatus({ io: new FsCustodyIo(homes), homes });
  return new Map(status.rows.map((r) => [r.name, r]));
}

describe("custody ⊥ secret-kind — one reading names both axes", () => {
  const SOWN = {
    ".vessel-key-joshua.json": "{}", "keyhive-archive.bin": "x", [`veil-archive-g${"a".repeat(64)}.bin`]: "x",
    ".persona-group-root-joshua-h0.json": "{}", "recovery-device-share-h0.bin": "x",
    ".vessel-card-joshua.json": "{}",
  };

  test("each key names its class and its custody off the one carrier table; a card carries no key", async () => {
    const v = scratch();
    try {
      const rows = await rowsOf(v.homes, SOWN);
      expect(Object.fromEntries([...rows].map(([name, r]) => [name, `${r.keyClass ?? "-"} ${r.custody}`]))).toEqual({
        "vessel-key": "device-minted floor", "vessel-card": "- floor-plain",
        "keyhive-archive": "device-minted hot", [`veil-archive-g${"a".repeat(64)}`]: "device-minted hot",
        "persona-root-h0": "seed cold", "recovery-device-share-h0": "seed cold",
      });
      for (const r of rows.values()) expect(r.keyClass === null || isKeyClass(r.keyClass), r.name).toBe(true);
      expect([...rows.values()].some((r) => r.keyClass === "cloud-synced")).toBe(false);
    } finally { v.drop(); }
  });

  test("RED: three seeds share a class and a custody, and the READING tells a sealed one from a bare one", async () => {
    const v = scratch();
    try {
      const io = new FsCustodyIo(v.homes);
      await foundCustody({ io, homes: v.homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: "census-test-route" }] }] });
      const rows = await rowsOf(v.homes, { ".persona-group-root-joshua-h0.json": "{}", "recovery-device-share-h0.bin": "x" });
      expect(rows.get("custody-root")).toMatchObject({ keyClass: "device-minted", custody: "hot", reading: "sealed", fault: false });
      expect(rows.get("persona-root-h0")).toMatchObject({ keyClass: "seed", custody: "cold", reading: "bare", fault: true });
      expect(rows.get("recovery-device-share-h0")).toMatchObject({ keyClass: "seed", custody: "cold", reading: "bare", fault: true });
      // CONTROL: the floor's own key reads bare by law, and no fault.
      const floor = await rowsOf(v.homes, { ".vessel-key.json": "{}" });
      expect(floor.get("vessel-key")).toMatchObject({ custody: "floor", reading: "bare", fault: false });
    } finally { v.drop(); }
  });

  test("a VK frame that stands DAMAGED reads `torn` and a fault, never bare by law", async () => {
    const v = scratch();
    try {
      const rows = await rowsOf(v.homes, {
        "recovery-device-share-h0.bin": Buffer.concat([Buffer.from("lares-vk-seal"), Buffer.from([1, 2, 3])]),
        "recovery-device-share-h1.bin": "x",
      });
      expect(rows.get("recovery-device-share-h0")).toMatchObject({ reading: "torn", fault: true, bare: null });
      expect(rows.get("recovery-device-share-h1")).toMatchObject({ reading: "bare", fault: true, bare: null });
    } finally { v.drop(); }
  });

  test("CONTROL: a GAP in the handle numbering throws nothing and drops nobody", async () => {
    const v = scratch();
    try {
      const rows = await rowsOf(v.homes, { "recovery-device-share-h0.bin": "x", "recovery-device-share-h3.bin": "x", ".persona-group-root-joshua-h3.json": "{}" });
      expect([...rows.keys()].sort()).toEqual(["persona-root-h3", "recovery-device-share-h0", "recovery-device-share-h3"]);
    } finally { v.drop(); }
  });
});

const RELATION_ROWS = ["admissions", "enroll-pending", "face-address-secret", "face-join-record", "fleet-join-pending", "grant-pending"];

describe("the relation class — a secret only the other party re-issues", () => {
  // The persona admit's three rows, and the fleet-join door's three: the face's address secret and the grants the
  // root re-issues, and a join's seal secret its answer alone consumes.
  test("the six relation rows read `relation` and hot", async () => {
    const v = scratch();
    try {
      const rows = await rowsOf(v.homes, {
        ".persona-enroll-pending.json": "{}", ".persona-grant-pending.json": "{}", ".persona-admissions.json": "{}",
        [`face-address-secret-${"5e".repeat(16)}.bin`]: "x", [`fleet-join-pending-${"6e".repeat(16)}.json`]: "{}", [`face-join-record-${"6f".repeat(16)}.json`]: "{}",
      });
      // A row the table names by a digest reads under its name with that digest.
      expect([...rows.values()].map((r) => r.row).sort()).toEqual(RELATION_ROWS);
      for (const r of rows.values()) expect(r, r.name).toMatchObject({ keyClass: "relation", custody: "hot" });
    } finally { v.drop(); }
  });

  test("CONTROL: a non-relation hot row (the handle-book) names no key class", async () => {
    const v = scratch();
    try {
      expect((await rowsOf(v.homes, { ".handle-book.json": "{}" })).get("handle-book")?.keyClass).toBeNull();
    } finally { v.drop(); }
  });

  test("the table names exactly the six relation rows", () => {
    expect(carrierTable().filter((r) => r.keyClass === "relation").map((r) => r.row).sort()).toEqual(RELATION_ROWS);
  });
});
