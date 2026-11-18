/**
 * custody-holder-charge-first.test — an offering pays its attempts BEFORE the open runs and earns them back only when a
 * route opens; and a face founding that fails zeroes the face key it minted.
 *
 * Charged after the open, a throw partway (a KDF refusal mid-way through the lazy open, a read fault, a refusal on the
 * serving tree after the node tree opened) tested passphrases for nothing, and a serving-tree refusal told the caller
 * that a right passphrase rode in the offering, at no cost. Charged first, a throw keeps the charge; an open refunds it,
 * and a tree-level reading that ran no derivation (absent, unreadable) refunds it too.
 *
 * Seams: the holder takes its io (a wrapper here throws on one path) and an optional face-key minter (a wrapper here
 * holds each key it mints). The vessel passes neither wrapper.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mintFck, type Credential, type FaceCustodyKey } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder } from "../src/custody-holder.js";
import { sSlotsPath, skSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";

vi.setConfig({ testTimeout: 180_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const RIGHT = "charge-first-passphrase";
const roots: string[] = [];

/** An io that throws on every read of `failing` once `armed` reads true. */
class FaultingIo extends FsCustodyIo {
  armed = false;
  constructor(homes: CustodyHomes, private readonly failing: () => string) { super(homes); }
  override async read(path: string): Promise<Uint8Array | null> {
    if (this.armed && path === this.failing()) throw new Error("EIO: the disk refused the read");
    return super.read(path);
  }
}
function stage(failing: (h: CustodyHomes) => string) {
  const dir = mkdtempSync(join(tmpdir(), "lar-charge-"));
  roots.push(dir);
  const homes = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  return { homes, io: new FaultingIo(homes, () => failing(homes)) };
}
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

describe("charge before the open, refund on an open", () => {
  test("a fault partway through the node open keeps the offering's charge", async () => {
    const t = stage((h) => sSlotsPath(h.identity));
    await foundCustody({ ...t, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    const h = makeCustodyHolder(t);
    t.io.armed = true;
    await expect(h.unlock([pass("wrong-1"), pass("wrong-2")])).rejects.toThrow(/EIO/);
    expect(h.attemptsLeft()).toBe(1);
  });

  test("a refusal on the serving tree after the node tree opened keeps the charge: the right route earns no free signal", async () => {
    const t = stage((h) => skSlotsPath(h.identity));
    await foundCustody({ ...t, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    const h = makeCustodyHolder(t);
    t.io.armed = true;
    await expect(h.unlock([pass(RIGHT)])).rejects.toThrow(/EIO/);
    expect(h.attemptsLeft()).toBe(2);
    expect(h.isUnlocked()).toBe(false);
  });

  test("CONTROL: an open refunds the charge, and a miss keeps it", async () => {
    const t = stage(() => "");
    await foundCustody({ ...t, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    const h = makeCustodyHolder(t);
    expect(await h.unlock([pass("wrong-1")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
    expect((await h.unlock([pass("wrong-2"), pass(RIGHT)])).reading).toBe("opens");
    expect(h.attemptsLeft()).toBe(2);
  });
});

describe("a face founding that fails zeroes its key", () => {
  test("a slot that refuses to bind zeroes the face key minted for it", async () => {
    const t = stage(() => "");
    await foundCustody({ ...t, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    const minted: FaceCustodyKey[] = [];
    const h = makeCustodyHolder({ ...t, mintFck: () => { const k = mintFck(); minted.push(k); return k; } });
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    await expect(h.foundFace({ ordinal: 0, slots: [{ t: 1, pins: [pass("")] }] })).rejects.toThrow(/empty passphrase/);
    expect(minted.length).toBe(1);
    expect(minted[0]!.every((b) => b === 0)).toBe(true);
  });

  test("CONTROL: a founding that lands keeps its face key whole", async () => {
    const t = stage(() => "");
    await foundCustody({ ...t, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    const minted: FaceCustodyKey[] = [];
    const h = makeCustodyHolder({ ...t, mintFck: () => { const k = mintFck(); minted.push(k); return k; } });
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    await h.foundFace({ ordinal: 0, slots: [{ t: 1, pins: [pass("face-route")] }] });
    expect(minted.length).toBe(1);
    expect(minted[0]!.some((b) => b !== 0)).toBe(true);
  });
});
