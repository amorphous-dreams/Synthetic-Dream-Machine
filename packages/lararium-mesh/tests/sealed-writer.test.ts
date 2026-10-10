/**
 * sealed-writer.test — THE one writer of VK-sealed carriers: a write lands only over bytes the current VK opens,
 * through a sidecar it reads back and compares before the rename, and a VK rotation opens every carrier before it
 * writes a single temp.
 *
 * The scenario this answers (`project_sealed_archive_write_holes`): a stand under a mistyped passphrase exported an
 * empty keyhive and SEALED it over the real archive, so no cleartext test caught it. Here a wrong passphrase opens no
 * VK, a VK that did not seal the bytes replaces nothing, and every reading a writer meets stays named.
 */
import { describe, test, expect } from "vitest";
import {
  writeSealedCarrier, openSealedCarrier, commitSlotTree, rotateVk, settleRotation, CustodyRefusal,
  SEALING_SUFFIX, ROTATING_SUFFIX, type CustodyIo, type SealedCarrier,
} from "../src/sealed-writer.js";
import { bindSlot, openVk, encodeSlotTree, decodeSlotTree, type SlotTree } from "../src/keyslot.js";
import { mintVk, vkEquals, type VesselKey } from "../src/vk.js";
import { encodeEnvelope } from "../src/archive-envelope.js";

const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const str = (b: Uint8Array): string => new TextDecoder().decode(b);
const right = { kind: "passphrase", passphrase: "the hearth remembers" } as const;
const wrong = { kind: "passphrase", passphrase: "the hearth remembered" } as const;

/** An in-memory store that records every mutating call. `failWhen` models a CRASH: the matching call faults, and
 *  every call after it faults too until the test revives the store, so no cleanup runs after the fault. */
class MemoryIo implements CustodyIo {
  readonly files = new Map<string, Uint8Array>();
  readonly log: string[] = [];
  failWhen: ((op: string, path: string) => boolean) | null = null;
  crashed = false;
  corruptWrites = false;

  revive(): void { this.failWhen = null; this.crashed = false; }
  private fault(op: string, path: string): void {
    if (this.crashed || this.failWhen?.(op, path)) { this.crashed = true; throw new Error(`injected ${op} fault at ${path}`); }
  }
  async read(path: string): Promise<Uint8Array | null> {
    this.fault("read", path);
    const b = this.files.get(path);
    return b === undefined ? null : Uint8Array.from(b);
  }
  async write(path: string, bytes: Uint8Array): Promise<void> {
    this.fault("write", path);
    this.log.push(`write ${path}`);
    const copy = Uint8Array.from(bytes);
    if (this.corruptWrites) copy[copy.length - 1] ^= 0xff;
    this.files.set(path, copy);
  }
  async rename(from: string, to: string): Promise<void> {
    this.fault("rename", from);
    this.log.push(`rename ${from} -> ${to}`);
    const b = this.files.get(from);
    if (b === undefined) throw new Error(`no file at ${from}`);
    this.files.set(to, b);
    this.files.delete(from);
  }
  async remove(path: string): Promise<void> {
    this.fault("remove", path);
    this.log.push(`remove ${path}`);
    this.files.delete(path);
  }
  snapshot(): Map<string, string> {
    return new Map([...this.files].map(([k, v]) => [k, Buffer.from(v).toString("hex")]));
  }
}

const TREE = "/id/vk-slots.json";
const CARRIERS: SealedCarrier[] = [
  { name: "keyring", path: "/id/keyring.sealed" },
  { name: "walk", path: "/store/walk.sealed" },
  { name: "vessel-next", path: "/id/vessel-next.sealed" },
];

/** Found a scratch vessel: a passphrase slot over a fresh VK, and every carrier written through the writer. */
async function found(): Promise<{ io: MemoryIo; vk: VesselKey; tree: SlotTree }> {
  const io = new MemoryIo();
  const vk = mintVk();
  const tree = bindSlot(null, vk, { t: 1, pins: [right] });
  await commitSlotTree({ io, path: TREE, expected: null, tree });
  for (const c of CARRIERS) await writeSealedCarrier({ io, vk, carrier: c, plaintext: text(`${c.name}-v1`) });
  io.log.length = 0;
  return { io, vk, tree };
}

async function openedTree(io: MemoryIo): Promise<SlotTree> {
  const r = decodeSlotTree(await io.read(TREE));
  if (r.reading !== "readable") throw new Error(`tree reads ${r.reading}`);
  return r.tree;
}

describe("write", () => {
  test("CONTROL: a founded carrier opens under its VK, and a second write under that VK replaces it", async () => {
    const { io, vk } = await found();
    const o = await openSealedCarrier({ io, vk, carrier: CARRIERS[0]! });
    expect(o.reading === "opens" && str(o.plaintext)).toBe("keyring-v1");
    await writeSealedCarrier({ io, vk, carrier: CARRIERS[0]!, plaintext: text("keyring-v2") });
    const o2 = await openSealedCarrier({ io, vk, carrier: CARRIERS[0]! });
    expect(o2.reading === "opens" && str(o2.plaintext)).toBe("keyring-v2");
    expect(io.log).toEqual([
      `write ${CARRIERS[0]!.path}${SEALING_SUFFIX}`,
      `rename ${CARRIERS[0]!.path}${SEALING_SUFFIX} -> ${CARRIERS[0]!.path}`,
    ]);
  });

  test("RED: a wrong passphrase opens no VK, and a VK that did not seal the carriers replaces none of them", async () => {
    const { io } = await found();
    const before = io.snapshot();
    expect(openVk(await openedTree(io), [wrong]).reading).toBe("no-slot-opens");
    // The floor's confusion, made concrete: a vessel holding the wrong VK tries to write its fresh state.
    const stray = mintVk();
    for (const c of CARRIERS) {
      await expect(writeSealedCarrier({ io, vk: stray, carrier: c, plaintext: text("empty") }))
        .rejects.toMatchObject({ reading: "key-fails" });
    }
    expect(io.snapshot()).toEqual(before);
    expect(io.log).toEqual([]);
  });

  test("RED: a carrier whose magic took a flipped byte reads unopenable and the write refuses", async () => {
    const { io, vk } = await found();
    const path = CARRIERS[1]!.path;
    const bytes = (await io.read(path))!;
    bytes[2] ^= 0x20;
    io.files.set(path, bytes);
    const before = io.snapshot();
    await expect(writeSealedCarrier({ io, vk, carrier: CARRIERS[1]!, plaintext: text("x") }))
      .rejects.toMatchObject({ reading: "unopenable" });
    expect(io.snapshot()).toEqual(before);
  });

  test("an old-shape (LARK) carrier, a torn one and a bare one each refuse, named apart", async () => {
    const { io, vk } = await found();
    const lark = encodeEnvelope({ mode: "passphrase", salt: new Uint8Array(16), iv: new Uint8Array(12), tag: new Uint8Array(16), ciphertext: text("ct") });
    const cases: [Uint8Array, string, RegExp][] = [
      [lark, "old-shape", /fresh-start/],
      [(await io.read(CARRIERS[0]!.path))!.subarray(0, 20), "torn", /backup/],
      [text('{"signingKey":"00"}'), "bare", /cleartext/],
    ];
    for (const [bytes, reading, says] of cases) {
      io.files.set(CARRIERS[0]!.path, bytes);
      const err = await writeSealedCarrier({ io, vk, carrier: CARRIERS[0]!, plaintext: text("x") }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(CustodyRefusal);
      expect((err as CustodyRefusal).reading).toBe(reading);
      expect((err as Error).message).toMatch(says);
      expect(Buffer.from((await io.read(CARRIERS[0]!.path))!).equals(Buffer.from(bytes))).toBe(true);
    }
  });

  test("a sidecar that does not read back as written refuses, leaves the carrier standing and removes the sidecar", async () => {
    const { io, vk } = await found();
    const before = io.snapshot();
    io.corruptWrites = true;
    await expect(writeSealedCarrier({ io, vk, carrier: CARRIERS[0]!, plaintext: text("v2") }))
      .rejects.toThrow(/read back/);
    expect(io.snapshot()).toEqual(before);
  });
});

describe("the slot tree", () => {
  test("a tree commit refuses when the standing tree moved since the caller read it", async () => {
    const { io, vk, tree } = await found();
    const grown = bindSlot(tree, vk, { t: 1, pins: [right] });
    await expect(commitSlotTree({ io, path: TREE, expected: text("not what stands"), tree: grown })).rejects.toThrow(/moved/);
    await commitSlotTree({ io, path: TREE, expected: await io.read(TREE), tree: grown });
    expect((await openedTree(io)).slots.length).toBe(2);
  });
});

describe("rotation", () => {
  test("RED: a rotation whose third carrier does not open under the old VK writes no temp at all", async () => {
    const { io, vk } = await found();
    const third = CARRIERS[2]!.path;
    const b = (await io.read(third))!;
    b[b.length - 1] ^= 0x01;                                  // the AEAD refuses it under the old VK
    io.files.set(third, b);
    const before = io.snapshot();
    await expect(rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk: mintVk(), slots: [{ t: 1, pins: [right] }] }))
      .rejects.toMatchObject({ reading: "key-fails" });
    expect(io.log).toEqual([]);
    expect(io.snapshot()).toEqual(before);
  });

  test("CONTROL: a rotation re-seals every carrier under the new VK and binds the new tree; the old VK opens nothing", async () => {
    const { io, vk } = await found();
    const newVk = mintVk();
    await rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk, slots: [{ t: 1, pins: [right] }] });
    const o = openVk(await openedTree(io), [right]);
    expect(o.reading === "opens" && vkEquals(o.vk, newVk)).toBe(true);
    for (const c of CARRIERS) {
      const n = await openSealedCarrier({ io, vk: newVk, carrier: c });
      expect(n.reading === "opens" && str(n.plaintext)).toBe(`${c.name}-v1`);
      expect((await openSealedCarrier({ io, vk, carrier: c })).reading).toBe("key-fails");
    }
    expect([...io.files.keys()].filter((k) => k.endsWith(SEALING_SUFFIX) || k.endsWith(ROTATING_SUFFIX))).toEqual([]);
    // The tree commits LAST: its rotating sidecar marks every carrier sidecar written and read back.
    expect(io.log.at(-1)).toBe(`rename ${TREE}${ROTATING_SUFFIX} -> ${TREE}`);
  });

  test("a crash inside the commit phase settles forward: every carrier and the tree land under the new VK", async () => {
    const { io, vk } = await found();
    const newVk = mintVk();
    io.failWhen = (op, path) => op === "rename" && path === `${CARRIERS[1]!.path}${ROTATING_SUFFIX}`;
    await expect(rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk, slots: [{ t: 1, pins: [right] }] })).rejects.toThrow(/injected/);
    io.revive();
    expect(await settleRotation({ io, treePath: TREE, carriers: CARRIERS })).toBe("completed");
    const o = openVk(await openedTree(io), [right]);
    expect(o.reading === "opens" && vkEquals(o.vk, newVk)).toBe(true);
    for (const c of CARRIERS) expect((await openSealedCarrier({ io, vk: newVk, carrier: c })).reading).toBe("opens");
  });

  test("a crash before the tree's sidecar stands settles back: every sidecar goes and the old VK still opens all", async () => {
    const { io, vk } = await found();
    const before = io.snapshot();
    io.failWhen = (op, path) => op === "write" && path === `${TREE}${ROTATING_SUFFIX}`;
    await expect(rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk: mintVk(), slots: [{ t: 1, pins: [right] }] })).rejects.toThrow(/injected/);
    io.revive();
    expect(await settleRotation({ io, treePath: TREE, carriers: CARRIERS })).toBe("discarded");
    expect(io.snapshot()).toEqual(before);
    expect(await settleRotation({ io, treePath: TREE, carriers: CARRIERS })).toBe("clean");
  });

  test("a rotation refuses while an unsettled one stands", async () => {
    const { io, vk } = await found();
    io.files.set(`${TREE}${ROTATING_SUFFIX}`, encodeSlotTree(bindSlot(null, mintVk(), { t: 1, pins: [right] })));
    await expect(rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk: mintVk(), slots: [{ t: 1, pins: [right] }] }))
      .rejects.toThrow(/settle/);
  });

  test("a rotation with no slot to bind refuses before it writes", async () => {
    const { io, vk } = await found();
    await expect(rotateVk({ io, treePath: TREE, carriers: CARRIERS, oldVk: vk, newVk: mintVk(), slots: [] })).rejects.toThrow(/human route/);
    expect(io.log).toEqual([]);
  });
});
