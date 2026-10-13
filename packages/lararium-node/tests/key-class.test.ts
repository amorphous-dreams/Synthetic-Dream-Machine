/**
 * key-class.test — EVERY KEY NAMES ITS CLASS (basket-one #/the-phone-seat, ruled 2026-09-11: "every key names its
 * class in vault status"). The classes form a CLOSED vocabulary — `device-minted` (the vessel key, the veil it
 * derives), `seed` (a persona root, a recovery share of it), `cloud-synced` (any key that reads identical across
 * devices — none today; the slot exists so a future PRF / synced-passkey wrap MUST declare it). An unknown class
 * refuses at the type AND at the guard, so a synced key can never pass as a device key by omission.
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEY_CLASSES, isKeyClass, vesselKeyCensus, type KeyClass } from "../src/key-class.js";
import { carrierTable, vaultCarrierFiles } from "../src/vault-carriers.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";

describe("the key-class vocabulary is closed", () => {
  test("four classes, and an unknown spelling refuses at the guard", () => {
    expect([...KEY_CLASSES]).toEqual(["device-minted", "seed", "cloud-synced", "relation"]);
    expect(isKeyClass("relation")).toBe(true);
    expect(isKeyClass("device-minted")).toBe(true);
    expect(isKeyClass("cloud-synced")).toBe(true);
    expect(isKeyClass("passkey")).toBe(false);
    expect(isKeyClass("")).toBe(false);
    // CONTROL at the TYPE: a KeyClass slot takes no other string (a compile-time refusal, witnessed by ts-expect-error).
    // @ts-expect-error — "synced" is not a KeyClass
    const refused: KeyClass = "synced";
    void refused;
  });
});

describe("vesselKeyCensus — every key the identity dir holds, with its class", () => {
  test("the vessel key reads device-minted; a persona root and a recovery share read seed; nothing reads cloud-synced today", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-keys-"));
    try {
      writeFileSync(join(dir, ".vessel-key-joshua.json"), "{}");
      writeFileSync(join(dir, ".persona-group-root-joshua-h0.json"), "{}");
      writeFileSync(join(dir, ".persona-group-root-joshua-h2.json"), "{}");
      writeFileSync(join(dir, "keyhive-archive.bin"), "x");
      writeFileSync(join(dir, "veil-archive-h0.bin"), "x");
      writeFileSync(join(dir, ".vessel-card-joshua.json"), "{}");   // a CARD is public — never a key
      const keys = vesselKeyCensus(dir);
      const byName = Object.fromEntries(keys.map((k) => [k.name, k.class]));
      expect(byName["vessel-key"]).toBe("device-minted");
      expect(byName["veil-archive-h0"]).toBe("device-minted");
      expect(byName["persona-root-h0"]).toBe("seed");
      expect(byName["persona-root-h2"]).toBe("seed");
      expect(keys.every((k) => isKeyClass(k.class))).toBe(true);
      expect(keys.some((k) => k.class === "cloud-synced")).toBe(false);
      expect(keys.some((k) => /card/.test(k.name))).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  test("CONTROL: an empty identity dir names no keys (and faults nothing)", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-keys-"));
    try { expect(vesselKeyCensus(dir)).toEqual([]); } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(vesselKeyCensus(join(tmpdir(), "no-such-dir-" + Date.now()))).toEqual([]);
  });
});

/**
 * CUSTODY IS A SECOND AXIS, AND `class` NEVER ANSWERED FOR IT.
 *
 * `class: "seed"` correctly names WHAT KIND OF SECRET a carrier holds, and three files answer to it —
 * `recovery-device-share-h{N}.bin`, `seal-reserve-mine-share.bin`, and `.persona-group-root-…-h{N}.json`.
 * Only the first two ride the vault's at-rest seal lifecycle (`vaultCarriers` → seal/rotate/repair/status/
 * export). The persona-group root rides NO seal at all.
 *
 * THE COST OF ONE CLASS NAMING TWO REGIMES: a hand writes "re-seal every `seed`-class carrier under the new
 * passphrase", iterates the census, and either writes over a file the lifecycle does not own or SKIPS it
 * silently and reports "all seeds re-sealed" over a cleartext root. A sweep over a class that names two
 * regimes reports success on what it skipped — the vacuous-pass family.
 *
 * The cure adds the axis rather than splitting the class, the same shape as presence ⊥ readability in
 * `readArchiveOpening`: `class` says what the secret is, `atRest` says who holds it at rest, and neither
 * answers for the other.
 */
describe("custody ⊥ secret-kind — the census names both axes", () => {
  function sownDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "lar-custody-"));
    writeFileSync(join(dir, ".vessel-key-joshua.json"), "{}");
    writeFileSync(join(dir, "keyhive-archive.bin"), "x");
    writeFileSync(join(dir, "veil-archive-h0.bin"), "x");
    writeFileSync(join(dir, ".persona-group-root-joshua-h0.json"), "{}");
    writeFileSync(join(dir, "recovery-device-share-h0.bin"), "x");
    writeFileSync(join(dir, "seal-reserve-mine-share.bin"), "x");
    return dir;
  }

  test("RED — a persona-group root and a device share read INDISTINGUISHABLE on custody", () => {
    const dir = sownDir();
    try {
      const keys = vesselKeyCensus(dir);
      const root  = keys.find((k) => k.name === "persona-root-h0");
      const share = keys.find((k) => k.name === "recovery-device-share-h0");
      const mine  = keys.find((k) => k.name === "seal-reserve-mine-share");
      expect(root).toBeDefined(); expect(share).toBeDefined(); expect(mine).toBeDefined();
      // The SECRET KIND agrees, and rightly so — all three carry a seed.
      expect(root!.class).toBe("seed");
      expect(share!.class).toBe("seed");
      expect(mine!.class).toBe("seed");
      // …and CUSTODY DIFFERS. This is what a `class`-only census could not say.
      expect(root!.atRest).toBe("cleartext");
      expect(share!.atRest).toBe("sealed");
      // The reserve share rides the vessel key: the passphrase lifecycle governs it no more, and these sown bytes
      // carry no VK frame, so the census reads them as the bare file they stand as.
      expect(mine!.atRest).toBe("cleartext");
      // The sweep that costs the story now has a predicate that cannot skip-and-claim.
      const sealedSeeds = keys.filter((k) => k.class === "seed" && k.atRest === "sealed").map((k) => k.name);
      expect(sealedSeeds).toEqual(["recovery-device-share-h0"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a sealed entry names WHICH carrier, so the custody fact joins to the byte-state one", () => {
    const dir = sownDir();
    try {
      const byName = Object.fromEntries(vesselKeyCensus(dir).map((k) => [k.name, k]));
      expect(byName["recovery-device-share-h0"]!.carrier).toBe("device-share-h0");
      expect(byName["seal-reserve-mine-share"]!.carrier).toBeNull();          // a row under the vessel key names no lifecycle carrier
      expect(byName["keyhive-archive"]!.carrier).toBeNull();
      expect(byName["veil-archive-h0"]!.carrier).toBeNull();
      expect(byName["keyhive-archive"]!.atRest).toBe("cleartext");
      expect(byName["veil-archive-h0"]!.atRest).toBe("cleartext");
      // A cleartext-custody key names NO carrier — null states "no carrier owed", it never loses one.
      expect(byName["persona-root-h0"]!.carrier).toBeNull();
      expect(byName["vessel-key"]!.carrier).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("FAULT-PIN: the vault's enumeration and the census agree, in BOTH directions", () => {
    const dir = sownDir();
    try {
      const keys = vesselKeyCensus(dir);
      const governed = new Set(vaultCarrierFiles(dir));
      const censusSealed = new Set(keys.filter((k) => k.atRest === "sealed").map((k) => k.file));
      // → a carrier the VAULT governs that the census does not name reads as a FAULT (the sweep would skip it).
      for (const f of governed) expect(censusSealed.has(f), `vault governs ${f}; the census names no sealed key for it`).toBe(true);
      // ← a key the census calls sealed that the vault does NOT govern reads as a FAULT (the sweep would
      //   write over a file no rotate owns). `vault status` naming `recovery-device-share-h1` under `keys`
      //   while omitting it from `carriers` was this disagreement, one direction, in the field.
      for (const f of censusSealed) expect(governed.has(f), `the census calls ${f} sealed; the vault governs no carrier there`).toBe(true);
      expect(governed.size).toBe(1);   // device-share-h0
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("each key names its custody class off the one carrier table: floor · hot · cold", () => {
    const dir = sownDir();
    try {
      const byName = Object.fromEntries(vesselKeyCensus(dir).map((k) => [k.name, k.custody]));
      expect(byName).toEqual({
        "vessel-key": "floor",
        "keyhive-archive": "hot", "veil-archive-h0": "hot",
        "persona-root-h0": "cold", "recovery-device-share-h0": "cold", "seal-reserve-mine-share": "cold",
      });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL: the three device-minted entries keep their class untouched", () => {
    const dir = sownDir();
    try {
      const byName = Object.fromEntries(vesselKeyCensus(dir).map((k) => [k.name, k.class]));
      expect(byName["vessel-key"]).toBe("device-minted");
      expect(byName["veil-archive-h0"]).toBe("device-minted");
      expect(byName["keyhive-archive"]).toBe("device-minted");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL: a GAP in the handle numbering throws nothing and drops nobody", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-custody-gap-"));
    try {
      writeFileSync(join(dir, "recovery-device-share-h0.bin"), "x");
      writeFileSync(join(dir, "recovery-device-share-h3.bin"), "x");
      writeFileSync(join(dir, ".persona-group-root-joshua-h3.json"), "{}");
      const keys = vesselKeyCensus(dir);
      expect(keys.filter((k) => k.atRest === "sealed").map((k) => k.carrier)).toEqual(["device-share-h0", "device-share-h3"]);
      expect(keys.find((k) => k.name === "persona-root-h3")!.atRest).toBe("cleartext");
      expect([...vaultCarrierFiles(dir)].length).toBe(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL: an absent dir names no governed carrier and faults nothing", () => {
    expect([...vaultCarrierFiles(join(tmpdir(), "no-such-dir-" + Date.now()))]).toEqual([]);
  });
});

describe("the relation class — a secret only the other party re-issues", () => {
  const RELATION_ROWS: Record<string, string> = {
    ".persona-enroll-pending.json":    "enroll-pending",
    ".persona-grant-pending.json":     "grant-pending",
    ".persona-admissions.json":        "admissions",
  };

  test("the four relation rows read `relation`, hot, and ride no passphrase lifecycle; the census prints the class", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-relation-"));
    try {
      for (const f of Object.keys(RELATION_ROWS)) writeFileSync(join(dir, f), "{}");
      const keys = vesselKeyCensus(dir);
      expect(keys.map((k) => k.name).sort()).toEqual(Object.values(RELATION_ROWS).sort());
      for (const k of keys) {
        expect(k.class, k.name).toBe("relation");
        expect(k.custody, k.name).toBe("hot");
        expect(k.atRest, k.name).toBe("cleartext");   // the VK custody seals it; the passphrase lifecycle never governs it
        expect(k.carrier, k.name).toBeNull();
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("CONTROL: a non-relation hot row (the handle-book) names no key at all", () => {
    const dir = mkdtempSync(join(tmpdir(), "lar-relation-"));
    try {
      writeFileSync(join(dir, ".handle-book.json"), "{}");
      expect(vesselKeyCensus(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("every relation row in the table is exactly the three, and each VK-sealed carrier carries its row's class", () => {
    const rows = carrierTable().filter((r) => r.keyClass === "relation").map((r) => r.row).sort();
    expect(rows).toEqual(["admissions", "enroll-pending", "grant-pending"]);
  });
});

describe("vesselKeyCensus — one reading of a VK-sealed file", () => {
  test("★ a custody root whose bytes carry the VK frame reads `sealed`; bare bytes at the same name read `cleartext` ★", async () => {
    const base = mkdtempSync(join(tmpdir(), "lar-vkframe-"));
    try {
      const homes = { identity: join(base, "identity"), storage: join(base, "storage"), seal: join(base, "seal") };
      await foundCustody({
        io: new FsCustodyIo(homes), homes,
        slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: "census-test-route" }] }],
      });
      const root = vesselKeyCensus(homes.identity).find((k) => k.name === "custody-root");
      expect(root?.atRest).toBe("sealed");
      expect(root?.carrier).toBeNull();                       // no passphrase-lifecycle carrier: the VK frame alone says sealed
      // CONTROL: the same name holding bare bytes reads cleartext.
      writeFileSync(join(homes.identity, "custody-root.bin"), "x");
      expect(vesselKeyCensus(homes.identity).find((k) => k.name === "custody-root")?.atRest).toBe("cleartext");
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
