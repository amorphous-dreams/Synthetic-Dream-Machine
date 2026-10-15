/**
 * serving-key.test — the serving key (SK) mints at the founding, rests in the serving tree under the VK's entry, and
 * opens at a human unlock (lar:///ha.ka.ba/lararium/mesh/ember#/the-serving-key).
 *
 *   S1 · a founding leaves `sk-slots.bin` beside `vk-slots.bin`, and the census reads it as the `floor` row `sk-slots`
 *        (CONTROL: the slot tree's own row reads beside it; the class list names `serving`).
 *   S2 · an unlock opens the VK, then SK, and two unlocks of one vessel open the same SK (CONTROL: two vessels' SKs differ).
 *   S3 · a serving tree copied from another vessel opens nothing under this VK: the unlock reads `serving-unopenable`
 *        and hands back no key (CONTROL: the vessel's own tree put back opens again).
 *   S4 · a serving tree with its VK entry stripped refuses by name (the human-route law), as does a torn or absent one.
 *   S5 · a VK rotation re-wraps the VK entry and keeps the SK: the staying route opens the same SK under the new VK.
 *   S6 · a rotation's re-wrap that committed beside an old tree settles at the next unlock; one that never committed leaves.
 *   S7 · status reads the serving tree bare by law and faults nothing.
 *   S8 · a rotation over a serving tree its VK cannot open refuses by name before any byte moves.
 *   S9 · a rotation holds ONE claim across its writes, so no opening settles its re-wrap away mid-act.
 *  S10 · a fault between the serving tree and the slot tree strands no SK: the next founding stands whole.
 *  S11 · a second founding over a standing slot tree refuses before it touches the serving tree.
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FsCustodyIo } from "../src/custody-io.js";
import * as session from "../src/custody-session.js";
import * as carriers from "../src/vault-carriers.js";
import type { CustodyHomes } from "../src/vault-carriers.js";

let root: string;
let homes: CustodyHomes;
let io: FsCustodyIo;
const PW = "a-serving-test-route";
const passphrase = (p: string) => ({ kind: "passphrase" as const, passphrase: p });
const slotOf = (p: string) => ({ t: 1, pins: [passphrase(p)] });
const skTree = (h: CustodyHomes): string => join(h.identity, "sk-slots.bin");
const hex = (b: Uint8Array | undefined): string => (b ? Buffer.from(b).toString("hex") : "none");

function homesAt(name: string): { homes: CustodyHomes; io: FsCustodyIo } {
  const h = { identity: join(root, name, "identity"), storage: join(root, name, "vessel"), seal: join(root, name, "nexus") };
  mkdirSync(h.identity, { recursive: true });
  return { homes: h, io: new FsCustodyIo(h) };
}

async function unlockSk(h: CustodyHomes, i: FsCustodyIo, p = PW): Promise<{ reading: string; sk?: Uint8Array }> {
  const u = await session.unlockCustody({ io: i, homes: h, credentials: [passphrase(p)] }) as { reading: string; sk?: Uint8Array };
  return u;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-serving-key-"));
  ({ homes, io } = homesAt("a"));
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe("the serving key at the founding", () => {
  test("S1 — a founding leaves the serving tree, and the census reads it as a floor row — CONTROL: the slot tree reads beside it", async () => {
    await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    expect(existsSync(join(homes.identity, "vk-slots.bin"))).toBe(true);           // CONTROL
    expect(existsSync(skTree(homes))).toBe(true);
    expect([...carriers.CUSTODY_CLASSES]).toEqual(["floor", "floor-plain", "serving", "hot", "cold"]);
    const census = carriers.carrierCensus(homes);
    expect(census.find((e) => e.row === "vk-slots")?.custody).toBe("floor");        // CONTROL
    const row = census.find((e) => e.row === "sk-slots");
    expect(row?.custody).toBe("floor");
    expect(row?.bare).toMatch(/serving tree/);
    expect(carriers.outsideTheTable(homes)).toEqual([]);
  });

  test("S2 — an unlock opens SK beside the VK, the same SK each time — CONTROL: another vessel's SK differs", async () => {
    const f = await session.foundCustody({ io, homes, slots: [slotOf(PW)] }) as { sk?: Uint8Array };
    const first = await unlockSk(homes, new FsCustodyIo(homes));
    const second = await unlockSk(homes, new FsCustodyIo(homes));
    expect(first.reading).toBe("opens");
    expect(first.sk?.length).toBe(32);
    expect(hex(first.sk)).toBe(hex(second.sk));
    expect(hex(first.sk)).toBe(hex(f.sk));
    const b = homesAt("b");
    await session.foundCustody({ io: b.io, homes: b.homes, slots: [slotOf(PW)] });
    expect(hex((await unlockSk(b.homes, b.io)).sk)).not.toBe(hex(first.sk));         // CONTROL
  });
});

describe("the serving tree refuses what it does not commit to", () => {
  test("S3 — a serving tree copied from another vessel opens nothing — CONTROL: the vessel's own tree opens again", async () => {
    await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const b = homesAt("b");
    await session.foundCustody({ io: b.io, homes: b.homes, slots: [slotOf(PW)] });
    const mine = readFileSync(skTree(homes));
    writeFileSync(skTree(homes), readFileSync(skTree(b.homes)));
    const u = await unlockSk(homes, io);
    expect(u.reading).toBe("serving-unopenable");
    expect(u.sk).toBeUndefined();
    expect((u as { why?: string }).why).toMatch(/vk-entry-refuses/);
    writeFileSync(skTree(homes), mine);
    expect((await unlockSk(homes, io)).reading).toBe("opens");                        // CONTROL
  });

  test("S4 — a tree with no VK entry refuses by name, as does a torn tree and an absent one — CONTROL: the whole tree opens", async () => {
    await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const whole = readFileSync(skTree(homes));
    const parsed = JSON.parse(whole.toString("utf8")) as Record<string, unknown>;
    const { vkEntry: _dropped, ...stripped } = parsed;
    expect(Object.keys(parsed)).toContain("vkEntry");                                   // the tamper moved decoded bytes
    writeFileSync(skTree(homes), JSON.stringify(stripped));
    const noEntry = await unlockSk(homes, io);
    expect(noEntry.reading).toBe("serving-unopenable");
    expect((noEntry as { why?: string }).why).toMatch(/no VK entry/);
    writeFileSync(skTree(homes), "not a tree");
    expect((await unlockSk(homes, io)).reading).toBe("serving-unopenable");
    rmSync(skTree(homes));
    const absent = await unlockSk(homes, io);
    expect(absent.reading).toBe("serving-unopenable");
    expect((absent as { why?: string }).why).toMatch(/serving-tree-absent/);
    writeFileSync(skTree(homes), whole);
    expect((await unlockSk(homes, io)).reading).toBe("opens");                        // CONTROL
  });
});

describe("a VK rotation re-wraps the VK entry and keeps SK", () => {
  test("S5 — the staying route opens the same SK under the new VK — CONTROL: the removed route opens nothing", async () => {
    const f = await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const before = await unlockSk(homes, io);
    const treeBefore = readFileSync(skTree(homes));
    const bound = await session.bindCustodySlot({ io, homes, vk: f.vk, spec: slotOf("staying route") });
    await session.unbindCustodySlot({ io, homes, vk: f.vk, slotId: f.tree.slots[0]!.id, rotate: [slotOf("staying route")] });
    expect(bound.tree.slots).toHaveLength(2);
    expect((await unlockSk(homes, io)).reading).toBe("no-slot-opens");                // CONTROL
    const after = await unlockSk(homes, io, "staying route");
    expect(after.reading).toBe("opens");
    expect(hex(after.sk)).toBe(hex(before.sk));
    expect(readFileSync(skTree(homes)).equals(treeBefore)).toBe(false);               // the entry re-wrapped
    expect(existsSync(`${skTree(homes)}.sk-rewrap`)).toBe(false);
  });

  test("S6 — a committed re-wrap beside an old tree settles at the next unlock; an uncommitted one leaves — CONTROL: a clean tree opens", async () => {
    const f = await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const old = readFileSync(skTree(homes));
    const sk = hex((await unlockSk(homes, io)).sk);
    await session.rotateCustody({ io, homes, oldVk: f.vk, slots: [slotOf("rotated route")] });
    const rewrapped = readFileSync(skTree(homes));
    // The fault: the rotation committed, and the re-wrap never took the tree's place.
    writeFileSync(skTree(homes), old);
    writeFileSync(`${skTree(homes)}.sk-rewrap`, rewrapped);
    const settled = await unlockSk(homes, io, "rotated route");
    expect(settled.reading).toBe("opens");
    expect(hex(settled.sk)).toBe(sk);
    expect(readFileSync(skTree(homes)).equals(rewrapped)).toBe(true);
    expect(existsSync(`${skTree(homes)}.sk-rewrap`)).toBe(false);
    // The fault: a re-wrap that never committed (its rotation stopped before the slot tree moved).
    writeFileSync(`${skTree(homes)}.sk-rewrap`, old);
    expect((await unlockSk(homes, io, "rotated route")).reading).toBe("opens");     // CONTROL
    expect(existsSync(`${skTree(homes)}.sk-rewrap`)).toBe(false);
    expect(readFileSync(skTree(homes)).equals(rewrapped)).toBe(true);
  });
});

describe("a rotation that reaches no SK", () => {
  test("S8 — a rotation over a serving tree its VK cannot open refuses by name and moves no byte — CONTROL: put back, it rotates", async () => {
    const f = await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const tree = readFileSync(skTree(homes));
    const slots = readFileSync(join(homes.identity, "vk-slots.bin"));
    rmSync(skTree(homes));
    await expect(session.rotateCustody({ io, homes, oldVk: f.vk, slots: [slotOf("rotated")] }))
      .rejects.toThrow(/re-wraps the serving key under the new vessel key, and none opens \(serving-tree-absent/);
    expect(readFileSync(join(homes.identity, "vk-slots.bin")).equals(slots)).toBe(true);
    writeFileSync(skTree(homes), tree);
    await session.rotateCustody({ io, homes, oldVk: f.vk, slots: [slotOf("rotated")] });              // CONTROL
    expect((await unlockSk(homes, io, "rotated")).reading).toBe("opens");
  });
});

describe("status", () => {
  test("S7 — status reads the serving tree bare by law and faults nothing", async () => {
    await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const status = await session.custodyStatus({ io, homes });
    const row = status.rows.find((r) => r.row === "sk-slots");
    expect(row).toMatchObject({ custody: "floor", reading: "bare", fault: false });
    expect(status.rows.find((r) => r.row === "vk-slots")).toMatchObject({ reading: "bare", fault: false });
    expect(status.outside).toEqual([]);
  });
});

describe("one claim spans each act that writes twice", () => {
  /** The port, counting its claims and the writes that land outside any claim. */
  function spyIo(inner: FsCustodyIo, failOn?: RegExp) {
    let depth = 0;
    const seen = { claims: 0, writesOutside: 0 };
    const io = {
      read: (p: string) => inner.read(p),
      write: async (p: string, b: Uint8Array) => {
        if (depth === 0) seen.writesOutside++;
        if (failOn?.test(p)) throw new Error(`the disk faulted writing ${p}`);
        return inner.write(p, b);
      },
      rename: (f: string, t: string) => inner.rename(f, t),
      remove: (p: string) => inner.remove(p),
      list: () => inner.list(),
      exclusive: <T,>(fn: () => Promise<T>) => { seen.claims++; return inner.exclusive(async () => { depth++; try { return await fn(); } finally { depth--; } }); },
    };
    return { io, seen };
  }

  test("S9 — a rotation takes ONE claim and writes nothing outside it — CONTROL: it rotates", async () => {
    const f = await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const spy = spyIo(io);
    await session.rotateCustody({ io: spy.io, homes, oldVk: f.vk, slots: [slotOf("rotated")] });
    expect(spy.seen).toEqual({ claims: 1, writesOutside: 0 });
    expect((await unlockSk(homes, io, "rotated")).reading).toBe("opens");                             // CONTROL
  });

  test("S10 — a fault between the serving tree and the slot tree strands no SK: the next founding stands whole — CONTROL: a whole founding opens", async () => {
    const faulty = spyIo(io, /vk-slots\.bin/);
    await expect(session.foundCustody({ io: faulty.io, homes, slots: [slotOf(PW)] })).rejects.toThrow(/the disk faulted/);
    expect(existsSync(skTree(homes))).toBe(true);
    expect(existsSync(join(homes.identity, "vk-slots.bin"))).toBe(false);
    expect(faulty.seen.writesOutside).toBe(0);
    const whole = spyIo(io);
    await session.foundCustody({ io: whole.io, homes, slots: [slotOf(PW)] });
    expect(whole.seen.writesOutside).toBe(0);
    expect((await unlockSk(homes, io)).reading).toBe("opens");                                         // CONTROL
  });
});

describe("a founding over a standing custody", () => {
  test("S11 — a second founding over a standing slot tree refuses and leaves the serving tree whole — CONTROL: the first SK still opens", async () => {
    await session.foundCustody({ io, homes, slots: [slotOf(PW)] });
    const sk = hex((await unlockSk(homes, io)).sk);
    const tree = readFileSync(skTree(homes));
    await expect(session.foundCustody({ io, homes, slots: [slotOf("another route")] })).rejects.toThrow(/a slot tree already stands/);
    expect(readFileSync(skTree(homes)).equals(tree)).toBe(true);
    expect(hex((await unlockSk(homes, io)).sk)).toBe(sk);                                               // CONTROL
  });
});
