import { describe, expect, test } from "vitest";
import { settleRotation, SEALING_SUFFIX, ROTATING_SUFFIX, type CustodyIo, type SealedCarrier } from "../src/sealed-writer.js";
import { bindSlot, encodeSlotTree } from "../src/keyslot.js";
import { mintVk } from "../src/vk.js";

class MemoryIo implements CustodyIo {
  files = new Map<string, Uint8Array>();
  log: string[] = [];
  async read(path: string) { const b = this.files.get(path); return b ? Uint8Array.from(b) : null; }
  async write(path: string, bytes: Uint8Array) { this.files.set(path, Uint8Array.from(bytes)); this.log.push(`write ${path}`); }
  async rename(from: string, to: string) { this.log.push(`rename ${from} -> ${to}`); const bytes = this.files.get(from); if (!bytes) throw new Error(`missing ${from}`); this.files.set(to, bytes); this.files.delete(from); }
  async remove(path: string) { this.log.push(`remove ${path}`); this.files.delete(path); }
  async list() { return [...this.files.keys()]; }
  async exclusive<T>(fn: () => Promise<T>) { return fn(); }
}
const tree = "/id/s-slots.bin";
const listed: SealedCarrier[] = [{ name: "y", path: "/id/y.bin" }];

describe("orphan sidecar sweep", () => {
  test("removes an unlisted first-write sidecar and leaves ordinary carriers alone", async () => {
    const io = new MemoryIo();
    io.files.set(`/id/x.bin${SEALING_SUFFIX}`, new Uint8Array([1]));
    io.files.set("/id/y.bin", new Uint8Array([2]));
    expect(await settleRotation({ io, treePath: tree, carriers: listed })).toBe("discarded");
    expect([...io.files.keys()]).toEqual(["/id/y.bin"]);
  });

  test("completes committed rotations before removing no rotating sidecar", async () => {
    const io = new MemoryIo();
    const vk = mintVk();
    const slot = bindSlot(null, vk, { t: 1, pins: [{ kind: "passphrase", passphrase: "synthetic" }] });
    io.files.set(`${tree}${ROTATING_SUFFIX}`, encodeSlotTree(slot));
    io.files.set(`/id/y.bin${ROTATING_SUFFIX}`, new Uint8Array([3]));
    const result = await settleRotation({ io, treePath: tree, carriers: listed });
    expect(result).toBe("completed");
    expect(io.files.has("/id/y.bin")).toBe(true);
    expect(io.log.findIndex((x) => x.startsWith("rename "))).toBeGreaterThanOrEqual(0);
    expect(io.log.some((x) => x.startsWith("remove /id/y.bin"))).toBe(false);
  });

  test("discards unlisted rotating sidecars when the tree commit point is absent", async () => {
    const io = new MemoryIo();
    io.files.set(`/id/orphan.bin${ROTATING_SUFFIX}`, new Uint8Array([4]));
    expect(await settleRotation({ io, treePath: tree, carriers: listed })).toBe("discarded");
    expect(await io.list()).toEqual([]);
  });

  test("a clean store stays clean", async () => {
    const io = new MemoryIo();
    io.files.set("/id/y.bin", new Uint8Array([5]));
    const before = await io.list();
    expect(await settleRotation({ io, treePath: tree, carriers: listed })).toBe("clean");
    expect(await io.list()).toEqual(before);
  });
});
