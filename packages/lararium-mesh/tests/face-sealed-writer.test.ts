import { describe, expect, test } from "vitest";
import { bindSlot, decodeSlotTree } from "../src/keyslot.js";
import { mintFck, sealUnderFck, type FaceCarrier } from "../src/fck.js";
import { mintVk, sealUnderVk } from "../src/vk.js";
import { writeSealedCarrier, commitSlotTree, writeFaceCarrier, updateFaceCarrier, removeFaceCarrier, openFaceCarrier,
  rotateFck, settleFaceRotation, commitFaceTree, assertNoOldFaceShape, CensusRefusal, OldShapeRefusal,
  ROTATING_SUFFIX, SEALING_SUFFIX, type CustodyIo } from "../src/sealed-writer.js";

const text = (s: string) => new TextEncoder().encode(s);
const pin = { t: 1, pins: [{ kind: "passphrase", passphrase: "face route" }] } as const;
const a: FaceCarrier = { name: "root", path: "/faces/a/root", kind: "cold", ref: "root/a", owner: "group-a", store: "vessel" };
const b: FaceCarrier = { name: "root", path: "/faces/b/root", kind: "cold", ref: "root/b", owner: "group-b", store: "vessel" };

class MemoryIo implements CustodyIo {
  files = new Map<string, Uint8Array>();
  log: string[] = [];
  corrupt = false;
  failAt: string | null = null;
  crashed = false;
  revive() { this.failAt = null; this.crashed = false; }
  private fault(op: string, path: string) { if (this.crashed || this.failAt === `${op} ${path}`) { this.crashed = true; throw Error("injected fault"); } }
  async read(path: string) { this.fault("read", path); return this.files.has(path) ? Uint8Array.from(this.files.get(path)!) : null; }
  async write(path: string, bytes: Uint8Array) {
    this.fault("write", path); this.log.push(`write ${path}`);
    const copy = Uint8Array.from(bytes); if (this.corrupt) copy[copy.length - 1] ^= 1;
    this.files.set(path, copy);
  }
  async rename(from: string, to: string) { this.fault("rename", from); this.log.push(`rename ${from}`); this.files.set(to, this.files.get(from)!); this.files.delete(from); }
  async remove(path: string) { this.fault("remove", path); this.log.push(`remove ${path}`); this.files.delete(path); }
  async list() { return [...this.files.keys()]; }
  private chain: Promise<unknown> = Promise.resolve();
  exclusive<T>(fn: () => Promise<T>): Promise<T> { const run = this.chain.then(fn, fn); this.chain = run.catch(() => undefined); return run; }
  snapshot() { return new Map([...this.files].map(([k, v]) => [k, Buffer.from(v).toString("hex")])); }
}

async function found() {
  const io = new MemoryIo(), ak = mintFck(), bk = mintFck();
  for (const [key, c, treePath] of [[ak, a, "/faces/a/tree"], [bk, b, "/faces/b/tree"]] as const) {
    await commitFaceTree({ io, path: treePath, expected: null, key, tree: bindSlot(null, key, pin), carriers: [c] });
    await writeFaceCarrier({ io, key, treePath, carrier: c, plaintext: text(c.owner) });
  }
  io.log = [];
  return { io, ak, bk };
}

describe("face sealed writer", () => {
  test("CONTROL: each face replaces and updates its own occupied row under one holder", async () => {
    const { io, ak } = await found();
    await writeFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier: a, plaintext: text("next") });
    const value = await updateFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier: a,
      decide: (standing) => ({ plaintext: standing.reading === "opens" ? text("updated") : null, value: standing.reading }) });
    expect(value).toBe("opens");
    expect(await openFaceCarrier({ io, key: ak, carrier: a })).toMatchObject({ reading: "opens", plaintext: text("updated") });
    expect(io.log).toContain(`rename ${a.path}${SEALING_SUFFIX}`);
  });
  test("CONTROL: a face removes its own row and leaves its sibling occupied", async () => {
    const { io, ak, bk } = await found(); const bBytes = await io.read(b.path);
    expect(await removeFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier: a })).toBe(true);
    expect(await io.read(a.path)).toBeNull();
    expect(await io.read(b.path)).toEqual(bBytes);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("opens");
  });
  test("RED: copied ciphertext and changed row selectors refuse without mutation", async () => {
    const { io, ak, bk } = await found();
    const copied = (await io.read(a.path))!;
    io.files.set(b.path, copied);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("key-fails");
    const before = io.snapshot();
    for (const carrier of [b, { ...a, name: "other" }, { ...a, kind: "hot" }]) {
      await expect(writeFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier, plaintext: text("x") })).rejects.toThrow();
    }
    expect(io.snapshot()).toEqual(before);
  });
  test("RED: A cannot replace, remove or rotate B; B bytes remain identical", async () => {
    const { io, ak, bk } = await found();
    const before = io.snapshot();
    await expect(writeFaceCarrier({ io, key: ak, treePath: "/faces/b/tree", carrier: b, plaintext: text("x") }))
      .rejects.toMatchObject({ reading: "vk-mismatch" });
    await expect(removeFaceCarrier({ io, key: ak, treePath: "/faces/b/tree", carrier: b })).rejects.toMatchObject({ reading: "vk-mismatch" });
    await expect(rotateFck({ io, treePath: "/faces/b/tree", carriers: [b], oldKey: ak, newKey: mintFck(), slots: [pin] }))
      .rejects.toMatchObject({ reading: "vk-mismatch" });
    expect(io.snapshot()).toEqual(before);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("opens");
  });
  test("RED: an uncommitted key cannot found even an absent face carrier", async () => {
    const { io } = await found(); const before = io.snapshot();
    const fresh = { ...a, name: "new", path: "/faces/a/new", ref: "new/a" };
    await expect(writeFaceCarrier({ io, key: mintFck(), treePath: "/faces/a/tree", carrier: fresh, plaintext: text("x") }))
      .rejects.toMatchObject({ reading: "vk-mismatch" });
    expect(io.snapshot()).toEqual(before);
  });
  test("RED: VK and FCK frames cannot overwrite one another", async () => {
    const { io, ak } = await found();
    const vk = mintVk(), vkCarrier = { name: "vk", path: a.path };
    const vkTree = "/faces/a/vk-tree";
    await commitSlotTree({ io, path: vkTree, expected: null, vk, tree: bindSlot(null, vk, pin), carriers: [] });
    const faceBytes = (await io.read(a.path))!;
    await expect(writeSealedCarrier({ io, vk, treePath: vkTree, carrier: vkCarrier, plaintext: text("x") }))
      .rejects.toMatchObject({ reading: "unopenable" });
    expect(await io.read(a.path)).toEqual(faceBytes);
    const vkBytes = sealUnderVk(vk, a.name, text("vk"));
    io.files.set(a.path, vkBytes);
    await expect(writeFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier: a, plaintext: text("x") }))
      .rejects.toMatchObject({ reading: "unopenable" });
    expect(await io.read(a.path)).toEqual(vkBytes);
  });
  test("RED: read-back mismatch refuses and preserves the occupied row", async () => {
    const { io, ak } = await found(); const before = io.snapshot(); io.corrupt = true;
    await expect(writeFaceCarrier({ io, key: ak, treePath: "/faces/a/tree", carrier: a, plaintext: text("x") })).rejects.toThrow(/read back/);
    expect(io.snapshot()).toEqual(before);
  });
  test("RED: an unlisted face frame blocks rotation without touching either face", async () => {
    const { io, ak } = await found();
    io.files.set("/faces/a/hidden", sealUnderFck(ak, { ...a, path: "/faces/a/hidden" }, text("hidden")));
    const before = io.snapshot();
    await expect(rotateFck({ io, treePath: "/faces/a/tree", carriers: [a], oldKey: ak, newKey: mintFck(), slots: [pin] }))
      .rejects.toBeInstanceOf(CensusRefusal);
    expect(io.snapshot()).toEqual(before);
  });
  test("RED: a listed carrier that fails authentication blocks rotation before a temp", async () => {
    const { io, ak } = await found();
    const bad = (await io.read(a.path))!; bad[bad.length - 1] ^= 1; io.files.set(a.path, bad);
    const before = io.snapshot();
    await expect(rotateFck({ io, treePath: "/faces/a/tree", carriers: [a], oldKey: ak, newKey: mintFck(), slots: [pin] }))
      .rejects.toMatchObject({ reading: "key-fails" });
    expect(io.snapshot()).toEqual(before);
    expect(io.log).toEqual([]);
  });
  test("CONTROL: rotation re-seals A alone and binds its new tree", async () => {
    const { io, ak, bk } = await found(); const bBytes = await io.read(b.path), next = mintFck();
    await rotateFck({ io, treePath: "/faces/a/tree", carriers: [a], oldKey: ak, newKey: next, slots: [pin] });
    expect((await openFaceCarrier({ io, key: next, carrier: a })).reading).toBe("opens");
    expect((await openFaceCarrier({ io, key: ak, carrier: a })).reading).toBe("key-fails");
    expect(await io.read(b.path)).toEqual(bBytes);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("opens");
    expect(decodeSlotTree(await io.read("/faces/a/tree")).reading).toBe("readable");
  });
  test("RED and CONTROL: a commit phase fault settles A forward without sweeping B", async () => {
    const { io, ak, bk } = await found(); const next = mintFck(), bBytes = await io.read(b.path);
    io.failAt = `rename ${a.path}${ROTATING_SUFFIX}`;
    await expect(rotateFck({ io, treePath: "/faces/a/tree", carriers: [a], oldKey: ak, newKey: next, slots: [pin] })).rejects.toThrow(/injected/);
    io.revive();
    expect(await settleFaceRotation({ io, treePath: "/faces/a/tree", carriers: [a] })).toBe("completed");
    expect((await openFaceCarrier({ io, key: next, carrier: a })).reading).toBe("opens");
    expect(await io.read(b.path)).toEqual(bBytes);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("opens");
  });
  test("RED and CONTROL: a fault before the tree sidecar settles without replacing a standing row", async () => {
    const { io, ak, bk } = await found(); const before = io.snapshot();
    io.failAt = `write /faces/a/tree${ROTATING_SUFFIX}`;
    await expect(rotateFck({ io, treePath: "/faces/a/tree", carriers: [a], oldKey: ak, newKey: mintFck(), slots: [pin] })).rejects.toThrow(/injected/);
    io.revive();
    expect(await settleFaceRotation({ io, treePath: "/faces/a/tree", carriers: [a] })).toBe("discarded");
    expect(io.snapshot()).toEqual(before);
    expect((await openFaceCarrier({ io, key: bk, carrier: b })).reading).toBe("opens");
  });
  test("RED: founding refuses a standing face row and names it", async () => {
    const io = new MemoryIo(); io.files.set(a.path, sealUnderFck(mintFck(), a, text("x")));
    await expect(assertNoOldFaceShape({ io, treePath: "/faces/a/tree", carriers: [a] })).rejects.toBeInstanceOf(OldShapeRefusal);
    await expect(commitFaceTree({ io, path: "/faces/a/tree", expected: null, key: mintFck(), tree: bindSlot(null, mintFck(), pin), carriers: [a] }))
      .rejects.toBeInstanceOf(OldShapeRefusal);
  });
});
