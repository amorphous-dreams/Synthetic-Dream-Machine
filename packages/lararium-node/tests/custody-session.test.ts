/**
 * custody-session.test — a founding seals custody from birth, on real files through the production port.
 *
 * Every proof carries a CONTROL (the same act without the fault) and a MUTATION (the fault moved by one byte):
 *   · found with no slot refuses by name and writes nothing; with a slot it stands (tree + sealed custody root);
 *   · found over today's cleartext founding output refuses `OldShapeRefusal`, the directory hash unchanged;
 *   · found, drop the process, unlock from disk: the custody root opens and derives the same veil;
 *   · a wrong passphrase reads `no-slot-opens` and destroys nothing (a one-byte tamper of the tree reads the same);
 *   · unbind of the last route refuses; a bind then an unbind returns the rotation offer untouched;
 *   · a rotation moves the VK: the old credential's VK opens nothing, the new tree opens the custody root;
 *   · status opens nothing, names the tree's slots, and reads an unconverted row `bare`;
 *   · `runInit` itself: no route refuses before the first byte, a route leaves `vk-slots.bin` and a sealed root.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CensusRefusal, OldShapeRefusal, VK_SEAL_MAGIC, encodeIndexRow, readIndexRow, restDigest, writeSealedCarrier } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { custodyRootPath, custodyVeil, openCustodyRootCarrier, custodyRootFromBytes } from "../src/custody-root.js";
import {
  bindCustodySlot, custodyStatus, CustodyFoundingRefused, foundCustody, rotateCustody, unbindCustodySlot, unlockCustody,
} from "../src/custody-session.js";
import { vkSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { larIdentityDir, larSealHome } from "../src/vessel-paths.js";
import { runInit } from "../src/commands/init.js";
import { ownedStore } from "../src/owned-store.js";
import { TEST_CUSTODY, TEST_PASSPHRASE, TEST_SLOT, foundDirect } from "./found-route.js";

let root: string;
let homes: CustodyHomes;
let io: FsCustodyIo;
const passphrase = (p: string) => ({ kind: "passphrase" as const, passphrase: p });
const slotOf = (p: string) => ({ t: 1, pins: [passphrase(p)] });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-custody-session-"));
  homes = { identity: join(root, "identity"), storage: join(root, "vessel"), seal: join(root, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  io = new FsCustodyIo(homes);
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** Every file under `dir`, by relative path, to its sha256 — the directory as bytes. */
function hashes(dir: string, base = dir): Record<string, string> {
  if (!existsSync(dir)) return {};
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) Object.assign(out, hashes(p, base));
    else if (statSync(p).isFile()) out[p.slice(base.length)] = createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  return out;
}

describe("foundCustody", () => {
  test("RED: no slot refuses by name and writes nothing — CONTROL: one slot founds", async () => {
    const before = hashes(root);
    await expect(foundCustody({ io, homes, slots: [] })).rejects.toBeInstanceOf(CustodyFoundingRefused);
    expect(hashes(root)).toEqual(before);
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(false);

    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(true);
    const sealed = readFileSync(custodyRootPath(homes.identity));
    expect(Array.from(sealed.subarray(0, VK_SEAL_MAGIC.length))).toEqual(Array.from(VK_SEAL_MAGIC));
    expect(f.tree.slots).toHaveLength(1);
  });

  test("RED: over today's cleartext founding output it refuses OldShapeRefusal, the directory hash unchanged — CONTROL: a clean home founds", async () => {
    writeFileSync(join(homes.identity, "anchors-h0.json"), '{"personaGroupId":"00"}', { mode: 0o600 });
    const before = hashes(root);
    await expect(foundCustody({ io, homes, slots: [TEST_SLOT] })).rejects.toBeInstanceOf(OldShapeRefusal);
    expect(hashes(root)).toEqual(before);
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(false);

    rmSync(join(homes.identity, "anchors-h0.json"));
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(true);
  });
});

describe("unlockCustody", () => {
  test("found, drop the process, unlock from disk: the custody root opens and derives the same veil", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const veil = await custodyVeil(f.root, "group-tag");

    const fresh = new FsCustodyIo(homes);                       // nothing carried over but the disk
    const u = await unlockCustody({ io: fresh, homes, credentials: [passphrase(TEST_PASSPHRASE)] });
    expect(u.reading).toBe("opens");
    if (u.reading !== "opens") throw new Error("unreachable");
    const opened = await openCustodyRootCarrier({ io: fresh, vk: u.vk, identityDir: homes.identity });
    expect(opened.reading).toBe("opens");
    if (opened.reading !== "opens") throw new Error("unreachable");
    expect(await custodyVeil(custodyRootFromBytes(opened.opened), "group-tag")).toEqual(veil);
  });

  test("RED: a wrong passphrase reads no-slot-opens and destroys nothing — CONTROL: the right one opens; MUTATION: a tampered tree reads the same", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const before = hashes(root);

    const wrong = await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE + "x")] });
    expect(wrong.reading).toBe("no-slot-opens");
    expect(hashes(root)).toEqual(before);

    expect((await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] })).reading).toBe("opens");
    expect(hashes(root)).toEqual(before);

    // MUTATION: the right passphrase over a tree whose wrapped VK moved by one byte opens nothing — and still destroys nothing.
    const path = vkSlotsPath(homes.identity);
    const tree = JSON.parse(readFileSync(path, "utf8")) as { slots: { wrappedVk: string }[] };
    const w = tree.slots[0]!.wrappedVk;
    tree.slots[0]!.wrappedVk = (w[0] === "0" ? "1" : "0") + w.slice(1);
    writeFileSync(path, JSON.stringify(tree));
    const tampered = hashes(root);
    expect((await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] })).reading).toBe("no-slot-opens");
    expect(hashes(root)).toEqual(tampered);
  });

  test("an absent tree and an unreadable tree read by name", async () => {
    expect(await unlockCustody({ io, homes, credentials: [passphrase("a")] })).toEqual({ reading: "tree-absent" });
    writeFileSync(vkSlotsPath(homes.identity), "not a tree");
    const u = await unlockCustody({ io, homes, credentials: [passphrase("a")] });
    expect(u.reading).toBe("tree-unreadable");
  });
});

describe("bind, unbind", () => {
  test("RED: unbinding the last route refuses — CONTROL: bind a second slot, then the first unbinds and the offer comes back untouched", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const only = f.tree.slots[0]!.id;
    const before = hashes(root);
    await expect(unbindCustodySlot({ io, homes, vk: f.vk, slotId: only })).rejects.toThrow(/last slot/);
    expect(hashes(root)).toEqual(before);

    const bound = await bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("second route") });
    expect(bound.tree.slots).toHaveLength(2);
    const out = await unbindCustodySlot({ io, homes, vk: f.vk, slotId: only });
    expect(out.rotationOffer).toMatch(/rotat/i);
    expect(out.tree.slots.map((s) => s.id)).toEqual([bound.slotId]);
    expect((await unlockCustody({ io, homes, credentials: [passphrase("second route")] })).reading).toBe("opens");
    expect((await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] })).reading).toBe("no-slot-opens");
  });

  test("bind refuses a VK the tree does not commit to", async () => {
    const a = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const other = new FsCustodyIo({ identity: join(root, "i2"), storage: join(root, "v2"), seal: join(root, "n2") });
    mkdirSync(join(root, "i2"), { recursive: true });
    const b = await foundCustody({ io: other, homes: { identity: join(root, "i2"), storage: join(root, "v2"), seal: join(root, "n2") }, slots: [TEST_SLOT] });
    expect(b.vk).not.toEqual(a.vk);
    await expect(bindCustodySlot({ io, homes, vk: b.vk, spec: slotOf("x") })).rejects.toThrow();
  });
});

describe("an unbind that rotates runs as ONE act", () => {
  const text = (v: string): Uint8Array => new TextEncoder().encode(v);

  test("CONTROL: the removed route opens nothing, the staying route opens the same custody root under a new VK", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const veil = await custodyVeil(f.root, "group-tag");
    const bound = await bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("second route") });
    const out = await unbindCustodySlot({ io, homes, vk: f.vk, slotId: bound.slotId, rotate: [TEST_SLOT] });
    expect(out.rotated).toBe(true);
    expect(out.tree.slots).toHaveLength(1);
    expect(out.vk).not.toEqual(f.vk);
    expect((await unlockCustody({ io, homes, credentials: [passphrase("second route")] })).reading).toBe("no-slot-opens");
    const u = await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] });
    if (u.reading !== "opens") throw new Error(`the staying route reads ${u.reading}`);
    expect(u.vk).toEqual(out.vk);
    const opened = await openCustodyRootCarrier({ io, vk: u.vk, identityDir: homes.identity });
    if (opened.reading !== "opens") throw new Error(`custody root reads ${opened.reading}`);
    expect(await custodyVeil(custodyRootFromBytes(opened.opened), "group-tag")).toEqual(veil);
    expect((await openCustodyRootCarrier({ io, vk: f.vk, identityDir: homes.identity })).reading).not.toBe("opens");
  });

  test("RED: a sealed file no row names refuses the rotation BEFORE the unbind, so the slot stays bound and no byte moved", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const bound = await bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("second route") });
    await writeSealedCarrier({ io, vk: f.vk, treePath: vkSlotsPath(homes.identity), carrier: { name: "storage/stray.bin", path: join(homes.storage, "stray.bin") }, plaintext: text("x") });
    const before = hashes(root);
    const err = await unbindCustodySlot({ io, homes, vk: f.vk, slotId: bound.slotId, rotate: [TEST_SLOT] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CensusRefusal);
    expect(hashes(root)).toEqual(before);
    expect((await unlockCustody({ io, homes, credentials: [passphrase("second route")] })).reading).toBe("opens");
    expect((await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] })).reading).toBe("opens");
    // CONTROL: the same unbind with no rotation never asks the census, and removes the slot.
    const plain = await unbindCustodySlot({ io, homes, vk: f.vk, slotId: bound.slotId });
    expect(plain.rotated).toBe(false);
    expect(plain.tree.slots).toHaveLength(1);
  });

  test("RED: a rotation that re-binds fewer slots than stay refuses by name before any byte moves", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const second = await bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("second route") });
    await bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("third route") });
    const before = hashes(root);
    await expect(unbindCustodySlot({ io, homes, vk: f.vk, slotId: second.slotId, rotate: [TEST_SLOT] })).rejects.toThrow(/2 slot\(s\) stay/);
    await expect(unbindCustodySlot({ io, homes, vk: f.vk, slotId: "no-such-slot", rotate: [TEST_SLOT, slotOf("third route")] })).rejects.toThrow(/no slot/);
    expect(hashes(root)).toEqual(before);
  });
});

describe("rotateCustody", () => {
  test("a rotation moves the VK: the old passphrase reads no-slot-opens, the new route opens the same custody root", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const veil = await custodyVeil(f.root, "group-tag");
    const r = await rotateCustody({ io, homes, oldVk: f.vk, slots: [slotOf("rotated")] });
    expect(r.vk).not.toEqual(f.vk);

    expect((await unlockCustody({ io, homes, credentials: [passphrase(TEST_PASSPHRASE)] })).reading).toBe("no-slot-opens");
    const u = await unlockCustody({ io, homes, credentials: [passphrase("rotated")] });
    expect(u.reading).toBe("opens");
    if (u.reading !== "opens") throw new Error("unreachable");
    const opened = await openCustodyRootCarrier({ io, vk: u.vk, identityDir: homes.identity });
    if (opened.reading !== "opens") throw new Error(`custody root reads ${opened.reading}`);
    expect(await custodyVeil(custodyRootFromBytes(opened.opened), "group-tag")).toEqual(veil);
    // CONTROL: the old VK opens nothing now.
    expect((await openCustodyRootCarrier({ io, vk: f.vk, identityDir: homes.identity })).reading).not.toBe("opens");
  });
});

describe("custodyStatus", () => {
  test("opens nothing: names the slots and pin kinds, reads the sealed root `sealed` and an unconverted row `bare`", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    writeFileSync(join(homes.identity, "anchors-h0.json"), '{"a":1}', { mode: 0o600 });
    const before = hashes(root);
    const s = await custodyStatus({ io, homes });
    expect(hashes(root)).toEqual(before);
    expect(s.tree.reading).toBe("readable");
    if (s.tree.reading !== "readable") throw new Error("unreachable");
    expect(s.tree.slots.map((x) => x.pins)).toEqual([["passphrase"]]);
    const byRow = new Map(s.rows.map((r) => [r.row, r]));
    expect(byRow.get("custody-root")?.reading).toBe("sealed");
    expect(byRow.get("anchors")?.reading).toBe("bare");
    expect(byRow.get("anchors")?.custody).toBe("hot");
  });
  test("RED: one reading of one file: a floor row names the law it rests bare under, a bare hot row reads as a fault, and a private file no row names reads outside", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    writeFileSync(join(homes.identity, ".vessel-key.json"), "{}", { mode: 0o600 });
    writeFileSync(join(homes.identity, "anchors-h0.json"), '{"a":1}', { mode: 0o600 });
    writeFileSync(join(homes.identity, "side-key.json"), "{}", { mode: 0o600 });
    const s = await custodyStatus({ io, homes });
    const byRow = new Map(s.rows.map((r) => [r.row, r]));
    expect(byRow.get("vessel-key")).toMatchObject({ reading: "bare", custody: "floor", fault: false });
    expect(byRow.get("vessel-key")?.bare).toMatch(/floor/);
    expect(byRow.get("vk-slots")).toMatchObject({ reading: "bare", fault: false });
    expect(byRow.get("custody-root")).toMatchObject({ reading: "sealed", bare: null, fault: false });
    expect(byRow.get("anchors")).toMatchObject({ reading: "bare", bare: null, fault: true });
    expect(s.outside.map((o) => [o.home, o.file, o.why])).toEqual([["identity", "side-key.json", "owner-only"]]);
    expect(new Set(s.rows.map((r) => `${r.home}/${r.file}`)).size).toBe(s.rows.length);
  });
  test("RED: a file spelled like a plain row answers to that row's law: a rest name its bytes fail, bytes of no rest kind, and a seal no rotation re-seals, each read as a fault", async () => {
    const f = await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const hex32 = (byte: string) => byte.repeat(32);
    const row = encodeIndexRow({ bag: hex32("a1"), keyVersion: hex32("b2"), role: "blob", address: `blake3:${hex32("c3")}`, locator: hex32("d4"), parents: [], manifest: hex32("e5") } as never);
    expect(readIndexRow(row)).not.toBeNull();                                                               // the fixture reads as a real index row
    const key = new TextEncoder().encode("a private key a hand dropped here");
    const index = join(homes.storage, "sealed", "index");
    mkdirSync(index, { recursive: true });
    mkdirSync(join(homes.seal, "nexus", "carriage-consent"), { recursive: true });
    writeFileSync(join(index, `aa.bb.${restDigest(row)}`), row, { mode: 0o600 });                           // CONTROL: a real row under its own name
    writeFileSync(join(index, `aa.cc.${restDigest(row)}`), key, { mode: 0o600 });                           // a name its bytes fail
    writeFileSync(join(index, `aa.dd.${restDigest(key)}`), key, { mode: 0o600 });                           // a clear key named by its own digest
    writeFileSync(join(index, `aa.ee.${restDigest(key)}`), row, { mode: 0o600 });                           // a real row under a name it does not hold
    writeFileSync(join(homes.seal, "nexus", "carriage-consent", "plain.json"), "{}");                       // CONTROL: plain bytes at a plain row
    await writeSealedCarrier({ io, vk: f.vk, treePath: vkSlotsPath(homes.identity), carrier: { name: "seal/x", path: join(homes.seal, "nexus", "carriage-consent", "sealed.json") }, plaintext: key });
    const s = await custodyStatus({ io, homes });
    const at = (file: string) => s.rows.find((r) => r.file === file);
    expect(at(`sealed/index/aa.bb.${restDigest(row)}`)).toMatchObject({ row: "sealed-rest", reading: "bare", fault: false });
    expect(at(`sealed/index/aa.cc.${restDigest(row)}`)).toMatchObject({ row: "sealed-rest", reading: "bare", fault: true });
    expect(at(`sealed/index/aa.dd.${restDigest(key)}`)).toMatchObject({ row: "sealed-rest", reading: "bare", fault: true });
    expect(at(`sealed/index/aa.ee.${restDigest(key)}`)).toMatchObject({ row: "sealed-rest", reading: "bare", fault: true });
    expect(at("nexus/carriage-consent/plain.json")).toMatchObject({ row: "carriage-consent", reading: "bare", fault: false });
    expect(at("nexus/carriage-consent/sealed.json")).toMatchObject({ row: "carriage-consent", reading: "sealed", fault: true });
    expect(s.outside).toEqual([]);
  });
  test("RED: a floor row whose file stops inside the seal's magic reads torn and a fault, never bare — CONTROL: its cleartext reads bare", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const cut = VK_SEAL_MAGIC.subarray(0, 8);
    writeFileSync(join(homes.identity, ".vessel-key.json"), cut, { mode: 0o600 });
    expect(Array.from(readFileSync(join(homes.identity, ".vessel-key.json")))).toEqual(Array.from(cut));
    const s = await custodyStatus({ io, homes });
    expect(s.rows.find((r) => r.row === "vessel-key")).toMatchObject({ reading: "torn", custody: "floor", fault: true });
    writeFileSync(join(homes.identity, ".vessel-key.json"), "{}", { mode: 0o600 });
    const control = await custodyStatus({ io, homes });
    expect(control.rows.find((r) => r.row === "vessel-key")).toMatchObject({ reading: "bare", custody: "floor", fault: false });
  });
  test("RED (sweep): a floor row whose file holds any seal reading — another house seal, a LARK frame — reads as a fault", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const file = join(homes.identity, ".vessel-key.json");
    writeFileSync(file, new TextEncoder().encode("lares-xy-seal\u0001"), { mode: 0o600 });
    expect((await custodyStatus({ io, homes })).rows.find((r) => r.row === "vessel-key")).toMatchObject({ reading: "unopenable", fault: true });
    writeFileSync(file, Uint8Array.from([0x4c, 0x41, 0x52, 0x4b, 1, 1, ...new Array(60).fill(7)]), { mode: 0o600 });
    expect((await custodyStatus({ io, homes })).rows.find((r) => r.row === "vessel-key")).toMatchObject({ reading: "old-shape", fault: true });
  });
  test("RED (sweep cure): the sealed store's opaque shelves read their own law, never a seal reading — a note or a chunk that opens with seal-like bytes stands clean", async () => {
    await foundCustody({ io, homes, slots: [TEST_SLOT] });
    const own = join(homes.storage, "sealed", "own");
    const chunks = join(homes.storage, "sealed", "keyhive-chunks", "ab", "cd");
    mkdirSync(own, { recursive: true });
    mkdirSync(join(homes.storage, "sealed", "keyhive-chunks", "ab"), { recursive: true });
    const note = Uint8Array.from([0x4c, 0x41, 0x52, 0x4b, 9]);
    writeFileSync(join(own, `aa.bb.${restDigest(note)}`), note, { mode: 0o600 });
    writeFileSync(chunks, VK_SEAL_MAGIC.subarray(0, 5), { mode: 0o600 });
    const s = await custodyStatus({ io, homes });
    const at = (row: string) => s.rows.find((r) => r.row === row);
    expect(at("sealed-own"), "a LARK-led note stands clean").toMatchObject({ reading: "old-shape", fault: false });
    expect(at("sealed-chunk"), "a chunk led by seal-like bytes stands clean").toMatchObject({ reading: "torn", fault: false });
  });
  test("an unfounded home reads the tree absent", async () => {
    expect((await custodyStatus({ io, homes })).tree).toEqual({ reading: "absent" });
  });
});

describe("runInit seals custody from birth", () => {
  const GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
  test("RED: no route refuses before the first byte — CONTROL: a route leaves vk-slots.bin and a sealed custody root; MUTATION: the old shape refuses", async () => {
    if (!existsSync(join(GENESIS, "seed.json"))) throw new Error("no built genesis — run `pnpm --filter @lararium/node build:genesis`");
    const r = mkdtempSync(join(tmpdir(), "lar-found-seals-"));
    try {
      const storage = join(r, "data", "lares", "vessel");
      const genesis = join(r, "genesis");
      cpSync(GENESIS, genesis, { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
      mkdirSync(storage, { recursive: true });

      const noRoute = await withLarRoot(r, async () => {
        const before = hashes(larIdentityDir());
        let refused: unknown = null;
        try { await ownedStore(storage, (repo) => runInit({ repo, storageDir: storage, genesisDir: genesis, custody: { slots: [] } })); }
        catch (e) { refused = e; }
        return { refused, same: JSON.stringify(hashes(larIdentityDir())) === JSON.stringify(before) && !existsSync(join(storage, "social-bootstrap.json")), idHome: larIdentityDir() };
      });
      expect(noRoute.refused).toBeInstanceOf(CustodyFoundingRefused);
      expect(noRoute.same).toBe(true);
      expect(existsSync(join(noRoute.idHome, "vk-slots.bin"))).toBe(false);

      const idHome = await withLarRoot(r, async () => {
        await foundDirect({ storageDir: storage, genesisDir: genesis });
        return larIdentityDir();
      });
      expect(existsSync(join(idHome, "vk-slots.bin"))).toBe(true);
      const sealed = readFileSync(join(idHome, "custody-root.bin"));
      expect(Array.from(sealed.subarray(0, VK_SEAL_MAGIC.length))).toEqual(Array.from(VK_SEAL_MAGIC));

      const live = await withLarRoot(r, async () => {
        const h = { identity: larIdentityDir(), storage, seal: larSealHome() };
        const c = new FsCustodyIo(h);
        const right = await unlockCustody({ io: c, homes: h, credentials: [passphrase(TEST_PASSPHRASE)] });
        const snapshot = hashes(r);
        const wrong = await unlockCustody({ io: c, homes: h, credentials: [passphrase("not the route")] });
        return { right: right.reading, wrong: wrong.reading, intact: JSON.stringify(hashes(r)) === JSON.stringify(snapshot) };
      });
      expect(live).toEqual({ right: "opens", wrong: "no-slot-opens", intact: true });

      // A tree already standing needs no new route: a re-seed with none runs and leaves the tree's bytes alone.
      const treeBefore = readFileSync(join(idHome, "vk-slots.bin"));
      await withLarRoot(r, () => ownedStore(storage, (repo) =>
        runInit({ repo, storageDir: storage, genesisDir: genesis, force: true, custody: { slots: [] } })));
      expect(readFileSync(join(idHome, "vk-slots.bin")).equals(treeBefore)).toBe(true);

      // MUTATION: a founding over cleartext identity output with no tree (the old shape) refuses and moves no byte.
      const old = mkdtempSync(join(tmpdir(), "lar-found-old-"));
      try {
        const oStorage = join(old, "data", "lares", "vessel");
        const oGenesis = join(old, "genesis");
        cpSync(genesis, oGenesis, { recursive: true });
        mkdirSync(oStorage, { recursive: true });
        const oldHome = await withLarRoot(old, async () => larIdentityDir());
        mkdirSync(oldHome, { recursive: true });
        writeFileSync(join(oldHome, "anchors-h0.json"), '{"personaGroupId":"00"}', { mode: 0o600 });
        const before = hashes(oldHome);
        const err = await withLarRoot(old, async () => {
          try { await foundDirect({ storageDir: oStorage, genesisDir: oGenesis }); return null; } catch (e) { return e; }
        });
        expect(err).toBeInstanceOf(OldShapeRefusal);
        expect(hashes(oldHome)).toEqual(before);   // the store's own adapter-id marker aside, no identity byte moved
      } finally { rmSync(old, { recursive: true, force: true }); }
    } finally { rmSync(r, { recursive: true, force: true }); }
  }, 60_000);
});
