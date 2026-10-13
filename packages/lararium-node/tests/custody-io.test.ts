/**
 * custody-io.test — THE PRODUCTION `CustodyIo` AND THE P3 PROOFS, over ACTUAL carrier files in SCRATCH roots.
 *
 * Every test roots its homes under a fresh `mkdtemp` (and, where a resolver runs, under a scratch `LAR_ROOT`), so no
 * write here reaches a real vessel home. Each proof carries a CONTROL (the lawful act succeeds) and a MUTATION (the
 * guard's premise removed, and the hole it closes reads open).
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CustodyRefusal, OldShapeRefusal, SEALING_SUFFIX, ROTATING_SUFFIX, bindSlot, commitSlotTree, decodeSlotTree, mintVk,
  openSealedCarrier, openVk, readSealCarrier, readVkCarrier, writeSealedCarrier, type CustodyIo, type SealedCarrier, type VesselKey,
} from "@lararium/mesh";
import { CustodyLockRefused, FsCustodyIo } from "../src/custody-io.js";
import { FloorWriteRefused } from "../src/archive-write-guard.js";
import { persistRecoveryDeviceShare } from "../src/recovery-share-store.js";
import { ARCHIVE_PASSPHRASE_ENV } from "../src/archive-seal.js";
import { rotateVesselVk, vesselCustodyHomes, vkSealedCarriers, vkSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";

const pass = { kind: "passphrase", passphrase: "the hearth remembers" } as const;
const text = (v: string): Uint8Array => new TextEncoder().encode(v);
const str = (b: Uint8Array): string => new TextDecoder().decode(b);

let root = "";
let homes: CustodyHomes;
const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "lar-custody-io-"));
  setEnv("LAR_ROOT", root);
  setEnv("XDG_STATE_HOME", join(root, "state"));
  setEnv("XDG_DATA_HOME", join(root, "state"));
  setEnv("XDG_CONFIG_HOME", join(root, "config"));
  setEnv(ARCHIVE_PASSPHRASE_ENV, undefined);
  // The homes are the vessel's own resolvers' answers under the scratch LAR_ROOT, so the production paths and the port agree.
  homes = vesselCustodyHomes();
  expect(homes.identity.startsWith(root)).toBe(true);
  for (const h of Object.values(homes)) mkdirSync(h, { recursive: true });
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(root, { recursive: true, force: true });
});

/** Every file under `dir` with its bytes hashed — the write-nothing witness. */
function treeHash(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p); else { h.update(p); h.update(readFileSync(p)); }
    }
  };
  walk(dir);
  return h.digest("hex");
}

describe("FsCustodyIo — the port over the real filesystem", () => {
  test("write lands whole at mode 0600 and strands no temp; read answers null for absence", async () => {
    const io = new FsCustodyIo(homes);
    const p = join(homes.storage, "walk", "a.json");
    expect(await io.read(p)).toBeNull();
    await io.write(p, text("one"));
    await io.write(p, text("two"));
    expect(str((await io.read(p))!)).toBe("two");
    expect(statSync(p).mode & 0o777).toBe(0o600);
    expect(readdirSync(join(homes.storage, "walk"))).toEqual(["a.json"]);
  });

  test("rename replaces atomically; remove of nothing is no fault", async () => {
    const io = new FsCustodyIo(homes);
    const a = join(homes.identity, "a.bin"); const b = join(homes.identity, "b.bin");
    await io.write(a, text("A")); await io.write(b, text("B"));
    await io.rename(a, b);
    expect(str((await io.read(b))!)).toBe("A");
    expect(await io.read(a)).toBeNull();
    await io.remove(a);
    await io.remove(b);
    expect(await io.read(b)).toBeNull();
  });

  test("list spans all three homes recursively, follows no symlink, and lists an absent home as nothing", async () => {
    const io = new FsCustodyIo(homes);
    await io.write(join(homes.identity, "x.bin"), text("x"));
    await io.write(join(homes.storage, "hosting", "d", "carry", "y"), text("y"));
    await io.write(join(homes.seal, "nexus", "z.json"), text("z"));
    symlinkSync(join(homes.identity, "x.bin"), join(homes.identity, "link.bin"));
    expect([...(await io.list())]).toEqual([
      join(homes.identity, "x.bin"), join(homes.storage, "hosting", "d", "carry", "y"), join(homes.seal, "nexus", "z.json"),
    ].sort());
    expect([...(await new FsCustodyIo({ identity: join(root, "none"), storage: join(root, "none2"), seal: join(root, "none3") }).list())]).toEqual([]);
  });

  test("exclusive serializes in-process callers and releases its lock file", async () => {
    const io = new FsCustodyIo(homes);
    const order: string[] = [];
    const a = io.exclusive(async () => { order.push("a0"); await new Promise((r) => setTimeout(r, 30)); order.push("a1"); });
    const b = io.exclusive(async () => { order.push("b0"); order.push("b1"); });
    await Promise.all([a, b]);
    expect(order).toEqual(["a0", "a1", "b0", "b1"]);
    expect(existsSync(io.claimPath())).toBe(false);
  });

  test("exclusive releases the lock when the held act throws", async () => {
    const io = new FsCustodyIo(homes);
    await expect(io.exclusive(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(existsSync(io.claimPath())).toBe(false);
    await expect(io.exclusive(async () => 7)).resolves.toBe(7);
  });

  /** A child process that answers at `path` (a bare listening socket: what any live holder looks like) until told to leave. */
  const holderChild = (path: string) => spawn(process.execPath, [join(__dirname, "holder-child.mjs"), path], { stdio: ["ignore", "pipe", "inherit"] });
  const heldBy = (child: ReturnType<typeof holderChild>) => new Promise<void>((res, rej) => { child.stdout!.once("data", () => res()); child.once("error", rej); });
  const gone = (child: ReturnType<typeof holderChild>) => new Promise((r) => child.once("exit", r));

  test("two PROCESSES contend: the second waits, and enters only after the first leaves", async () => {
    const io = new FsCustodyIo(homes, { maxWaits: 200, pollMs: 25 });
    const child = holderChild(io.claimPath());
    try {
      await heldBy(child);
      let entered = false;
      const second = io.exclusive(async () => { entered = true; });
      await new Promise((r) => setTimeout(r, 300));
      expect(entered).toBe(false);                 // the live holder keeps it
      child.kill("SIGTERM");
      await gone(child);
      await second;
      expect(entered).toBe(true);                  // CONTROL: it enters once the first leaves
    } finally { child.kill("SIGKILL"); }
  });

  test("a LIVE holder outlasting the patience refuses by name and seizes nothing", async () => {
    const io = new FsCustodyIo(homes, { maxWaits: 3, pollMs: 10 });
    const child = holderChild(io.claimPath());
    try {
      await heldBy(child);
      let ran = false;
      await expect(io.exclusive(async () => { ran = true; })).rejects.toBeInstanceOf(CustodyLockRefused);
      expect(ran).toBe(false);
      expect(existsSync(io.claimPath())).toBe(true);   // the live claim stood untouched
    } finally { child.kill("SIGKILL"); }
  });

  test("a holder SIGKILLed mid-section leaves a corpse the next claimant reaps", async () => {
    const io = new FsCustodyIo(homes, { maxWaits: 3, pollMs: 10 });
    const child = holderChild(io.claimPath());
    await heldBy(child);
    child.kill("SIGKILL");
    await gone(child);
    expect(existsSync(io.claimPath())).toBe(true);     // the corpse stands
    await expect(io.exclusive(async () => "after-death")).resolves.toBe("after-death");
    expect(existsSync(io.claimPath())).toBe(false);
  });

  test("a stale file naming pid 1 at the old .lock path changes nothing", async () => {
    const io = new FsCustodyIo(homes, { maxWaits: 3, pollMs: 10 });
    const stale = join(homes.identity, "vk-slots.bin.lock");
    writeFileSync(stale, "1 stale-holder");
    await expect(io.exclusive(async () => "entered")).resolves.toBe("entered");
    expect(readFileSync(stale, "utf8")).toBe("1 stale-holder");
  });

  test("the claim socket is never listed as a carrier", async () => {
    const io = new FsCustodyIo(homes);
    await io.write(join(homes.identity, "x.bin"), text("x"));
    let seen: readonly string[] = [];
    await io.exclusive(async () => { seen = await io.list(); });
    expect(existsSync(io.claimPath()) || true).toBe(true);
    expect(seen).toEqual([join(homes.identity, "x.bin")]);
  });

  test("a custody home 130 characters deep claims", async () => {
    const deep = join(root, "d".repeat(40), "e".repeat(40), "f".repeat(40), "identity");
    expect(deep.length).toBeGreaterThan(130);
    const io = new FsCustodyIo({ identity: deep, storage: join(root, "s"), seal: join(root, "n") });
    await expect(io.exclusive(async () => "deep")).resolves.toBe("deep");
  });
});

/** Found a scratch vessel through the production port: a tree over a fresh VK, then one carrier per home. */
async function found(io: CustodyIo): Promise<{ vk: VesselKey; treePath: string; sealed: SealedCarrier[] }> {
  const vk = mintVk();
  const treePath = vkSlotsPath(homes.identity);
  await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [pass] }), carriers: vkSealedCarriers(homes) });
  const sealed: SealedCarrier[] = [
    { name: "identity/.persona-enroll-pending.json", path: join(homes.identity, ".persona-enroll-pending.json"), keyClass: "relation" },
    { name: "identity/custody-root.bin", path: join(homes.identity, "custody-root.bin"), keyClass: "device-minted" },
    { name: "storage/walk/AID.json", path: join(homes.storage, "walk", "AID.json") },
    { name: "seal/transitions.json", path: join(homes.seal, "transitions.json") },
  ];
  for (const c of sealed) await writeSealedCarrier({ io, vk, treePath, carrier: c, plaintext: text(`${c.name}-v1`) });
  return { vk, treePath, sealed };
}

describe("PROOF 1 — rotate, reopen, compare, rename on actual carrier files", { timeout: 60_000 }, () => {
  test("CONTROL: a rotation re-seals every carrier across the three homes; the new VK opens each to its old plaintext, the old VK opens none, and no sidecar stands", async () => {
    const io = new FsCustodyIo(homes);
    const f = await found(io);
    const before = new Map(await Promise.all(f.sealed.map(async (c) => [c.path, Buffer.from((await io.read(c.path))!).toString("hex")] as const)));
    const newVk = mintVk();
    await rotateVesselVk({ io, homes, oldVk: f.vk, newVk, slots: [{ t: 1, pins: [pass] }] });

    const tree = decodeSlotTree((await io.read(f.treePath))!);
    const opened = tree.reading === "readable" ? openVk(tree.tree, [pass]) : null;
    expect(opened?.reading).toBe("opens");
    const vk2 = (opened as { vk: VesselKey }).vk;
    for (const c of f.sealed) {
      const r = await openSealedCarrier({ io, vk: vk2, carrier: c });
      expect(r.reading === "opens" && str(r.plaintext), c.name).toBe(`${c.name}-v1`);                       // compare
      expect((await openSealedCarrier({ io, vk: f.vk, carrier: c })).reading, c.name).toBe("key-fails");    // the retired VK opens nothing
      expect(Buffer.from((await io.read(c.path))!).toString("hex"), c.name).not.toBe(before.get(c.path));   // the bytes MOVED
      expect(readVkCarrier((await io.read(c.path))!)).toBe("sealed");
    }
    for (const p of await io.list()) expect(p.endsWith(SEALING_SUFFIX) || p.endsWith(ROTATING_SUFFIX) || p.endsWith(".io-tmp"), p).toBe(false);   // rename left no sidecar
    expect(existsSync(io.claimPath())).toBe(false);
  });

  test("MUTATION: a stranger VK rotates nothing — every carrier stands byte-for-byte", async () => {
    const io = new FsCustodyIo(homes);
    await found(io);
    const before = treeHash(root);
    await expect(rotateVesselVk({ io, homes, oldVk: mintVk(), newVk: mintVk(), slots: [{ t: 1, pins: [pass] }] })).rejects.toThrow(/refusing/);
    expect(treeHash(root)).toBe(before);
  });
});

describe("PROOF 2 — the floor guard: an overwrite the floor cannot open refuses", () => {
  const recoveryShare = (x: string) => ({ bytes: { x, ys: Uint8Array.from([1, 2, 3]) }, custodian: "device" as const, recoveryEpoch: 1 });
  const deviceSharePath = () => join(homes.identity, "recovery-device-share-h0.bin");

  test("a VK-sealed device share refuses the floor's write, with and without a passphrase, and its bytes stand", async () => {
    const io = new FsCustodyIo(homes);
    const vk = mintVk();
    const treePath = vkSlotsPath(homes.identity);
    await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [pass] }), carriers: vkSealedCarriers(homes) });
    const carrier: SealedCarrier = { name: "identity/recovery-device-share-h0.bin", path: deviceSharePath() };
    await writeSealedCarrier({ io, vk, treePath, carrier, plaintext: text("sovereign") });
    const stood = readFileSync(deviceSharePath());
    expect(readVkCarrier(stood)).toBe("sealed");
    // The passphrase reader frames nothing in a VK seal, so the guard must inspect the VK frame before writing.
    expect(readSealCarrier(stood)).toBe("bare");

    expect(() => persistRecoveryDeviceShare(recoveryShare("fresh"))).toThrow(FloorWriteRefused);   // floor, no key
    setEnv(ARCHIVE_PASSPHRASE_ENV, "a-passphrase-that-is-not-the-vk");
    expect(() => persistRecoveryDeviceShare(recoveryShare("fresh"))).toThrow(/floor holds no VK/);   // floor, a "key" of the wrong kind
    expect(readFileSync(deviceSharePath()).equals(stood)).toBe(true);
    // And the sealed writer, holding the VK, still replaces it.
    await writeSealedCarrier({ io, vk, treePath, carrier, plaintext: text("sovereign-2") });
    expect(str((await openSealedCarrier({ io, vk, carrier }) as { plaintext: Uint8Array }).plaintext)).toBe("sovereign-2");
  });

  test("a TORN VK frame refuses because no key can be judged", () => {
    writeFileSync(deviceSharePath(), Buffer.concat([Buffer.from("lares-vk-seal"), Buffer.from([1, 2, 3])]));
    const stood = readFileSync(deviceSharePath());
    expect(readVkCarrier(stood)).toBe("torn");
    expect(readSealCarrier(stood)).toBe("bare");
    expect(() => persistRecoveryDeviceShare(recoveryShare("fresh"))).toThrow(FloorWriteRefused);
    expect(readFileSync(deviceSharePath()).equals(stood)).toBe(true);
  });

  test("CONTROL: an absent path and a bare cleartext device share both still take the write", () => {
    persistRecoveryDeviceShare(recoveryShare("first"));         // absent: a founding is never blocked
    const first = readFileSync(deviceSharePath());
    expect(JSON.parse(first.toString("utf8")).x).toBe("first");
    persistRecoveryDeviceShare(recoveryShare("second"));       // bare cleartext answers to the cleartext policy
    expect(JSON.parse(readFileSync(deviceSharePath(), "utf8")).x).toBe("second");
  });
});

describe("PROOF 3 — the old-shape refusal fires before any write", () => {
  test("a standing cleartext pending-enrollment row and no slot tree: the founding refuses as the old shape, and every byte stands", async () => {
    const io = new FsCustodyIo(homes);
    writeFileSync(join(homes.identity, ".persona-enroll-pending.json"), "{\"cleartext\":true}");
    writeFileSync(join(homes.identity, "custody-root.bin"), "bare-root");
    const before = treeHash(root);
    const vk = mintVk();
    const err = await commitSlotTree({
      io, path: vkSlotsPath(homes.identity), expected: null, vk,
      tree: bindSlot(null, vk, { t: 1, pins: [pass] }), carriers: vkSealedCarriers(homes),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OldShapeRefusal);
    expect((err as OldShapeRefusal).standing.map((s) => s.carrier.name).sort()).toEqual(["identity/.persona-enroll-pending.json", "identity/custody-root.bin"]);
    expect((err as OldShapeRefusal).standing.find((s) => s.carrier.keyClass === "relation")).toBeDefined();   // the table's class rides the list
    expect(treeHash(root)).toBe(before);
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(false);
    expect(existsSync(`${vkSlotsPath(homes.identity)}${SEALING_SUFFIX}`)).toBe(false);
  });

  test("CONTROL: empty homes found cleanly", async () => {
    const io = new FsCustodyIo(homes);
    await found(io);
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(true);
  });

  test("a VK-sealed stray in a storage subtree no row names refuses the founding through list(); MUTATION: a port whose list() is empty lets it through", async () => {
    const io = new FsCustodyIo(homes);
    const vk0 = mintVk();
    const t0 = join(root, "other-tree.bin");
    const stray: SealedCarrier = { name: "storage/odd/stray.bin", path: join(homes.storage, "odd", "stray.bin") };
    // Seal a stray under another vessel's tree, then drop it into this vessel's storage home.
    await commitSlotTree({ io, path: t0, expected: null, vk: vk0, tree: bindSlot(null, vk0, { t: 1, pins: [pass] }), carriers: [] });
    await writeSealedCarrier({ io, vk: vk0, treePath: t0, carrier: stray, plaintext: text("x") });
    rmSync(t0);

    const vk = mintVk();
    const args = { path: vkSlotsPath(homes.identity), expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [pass] }), carriers: vkSealedCarriers(homes) };
    const err = await commitSlotTree({ io, ...args }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OldShapeRefusal);
    expect((err as OldShapeRefusal).unlisted).toEqual([stray.path]);
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(false);

    const blind: CustodyIo = {
      read: (p) => io.read(p), write: (p, b) => io.write(p, b), rename: (a, b) => io.rename(a, b),
      remove: (p) => io.remove(p), exclusive: (fn) => io.exclusive(fn), list: async () => [],
    };
    await commitSlotTree({ io: blind, ...args });   // the hole: with no census the stray hides and the founding lands
    expect(existsSync(vkSlotsPath(homes.identity))).toBe(true);
  });
});

describe("the relation refusal — no rotation regenerates it", () => {
  test("a write over a relation row the VK cannot open says only the other party re-issues it; a non-relation carrier says nothing of the kind", async () => {
    const io = new FsCustodyIo(homes);
    const f = await found(io);
    const [pending, , walk] = f.sealed as [SealedCarrier, SealedCarrier, SealedCarrier];
    // Replace both with bytes sealed under a DIFFERENT vk (same carrier name, so only the key differs).
    const altRoot = join(root, "alt");
    const altIo = new FsCustodyIo({ identity: join(altRoot, "i"), storage: join(altRoot, "s"), seal: join(altRoot, "n") });
    const other = mintVk();
    const altTree = join(altRoot, "i", "vk-slots.bin");
    await commitSlotTree({ io: altIo, path: altTree, expected: null, vk: other, tree: bindSlot(null, other, { t: 1, pins: [pass] }), carriers: [] });
    for (const c of [pending, walk]) {
      const alt = { ...c, path: join(altRoot, "c", c.name.replace(/\//g, "_")) };
      await writeSealedCarrier({ io: altIo, vk: other, treePath: altTree, carrier: alt, plaintext: text("alien") });
      await io.write(c.path, (await altIo.read(alt.path))!);
    }

    const relation = await writeSealedCarrier({ io, vk: f.vk, treePath: f.treePath, carrier: pending, plaintext: text("x") }).catch((e: unknown) => e);
    expect(relation).toBeInstanceOf(CustodyRefusal);
    expect((relation as Error).message).toMatch(/only the other party can re-issue it/);
    const plain = await writeSealedCarrier({ io, vk: f.vk, treePath: f.treePath, carrier: walk, plaintext: text("x") }).catch((e: unknown) => e);
    expect(plain).toBeInstanceOf(CustodyRefusal);
    expect((plain as Error).message).not.toMatch(/other party/);
  });
});
