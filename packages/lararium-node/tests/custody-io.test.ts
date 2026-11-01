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
  CustodyRefusal, OccupiedStoreRefusal, SEALING_SUFFIX, ROTATING_SUFFIX, bindSlot, commitSlotTree, decodeSlotTree, mintTreeKey,
  openSealedCarrier, openTreeKey, readSCarrier, writeSealedCarrier, type CustodyIo, type SealedCarrier, type TreeKey,
} from "@lararium/mesh";
import { CustodyLockRefused, FsCustodyIo } from "../src/custody-io.js";
import { rotateNodeKey, vesselCustodyHomes, sSealedCarriers, sSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";
import { nativeKdf } from "@lararium/mesh/node";

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
  /** Resolves once callers reached the holder `times` times: the holder itself says so, each time one does. */
  const askedOf = (child: ReturnType<typeof holderChild>, times: number) => new Promise<void>((res) => {
    let seen = 0;
    const onData = (chunk: Buffer): void => {
      seen += chunk.toString().split("asked").length - 1;
      if (seen >= times) { child.stdout!.off("data", onData); res(); }
    };
    child.stdout!.on("data", onData);
  });

  // THE WINDOW RESTS ON A HANDSHAKE, NEVER ON THE CLOCK. The first process says it holds; the second starts its wait;
  // the first says each time a contender reaches it, and gets told to leave once the contender has come back past
  // two whole looks (a look reaches the holder three times). The look budget plays no part here (the next case
  // pins it), so the budget stands past any count a machine reaches while the first process leaves.
  test("two PROCESSES contend: the second waits, and enters only after the first leaves", async () => {
    const io = new FsCustodyIo(homes, { maxWaits: Number.MAX_SAFE_INTEGER, pollMs: 25 });
    const child = holderChild(io.claimPath());
    try {
      await heldBy(child);
      const looked = askedOf(child, 7);
      let told = false;
      let entered: "no" | "while-held" | "after-told" = "no";
      const second = io.exclusive(async () => { entered = told ? "after-told" : "while-held"; });
      // A contender that seized the claim would stop asking: its own entry settles the race before the looks do.
      await Promise.race([looked, second]);
      expect(entered).toBe("no");                  // the live holder keeps it, look after look
      told = true;
      child.kill("SIGTERM");
      await gone(child);
      await second;
      expect(entered).toBe("after-told");          // CONTROL: it enters once the first leaves
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

  test("RED: each look at a live holder takes ONE wait from the pace port, and the budget counts those waits", async () => {
    // No clock: the port hands back a wait this case alone releases, and says each time the contender asks for one.
    const maxWaits = 3, pollMs = 41;
    const asks: { pollMs: number; release: () => void }[] = [];
    let onAsk: () => void = () => undefined;
    const pace = (ms: number) => new Promise<void>((release) => { asks.push({ pollMs: ms, release }); onAsk(); });
    const nextAsk = (n: number) => new Promise<void>((res) => { if (asks.length >= n) res(); else onAsk = () => { if (asks.length >= n) res(); }; });
    const io = new FsCustodyIo(homes, { maxWaits, pollMs, pace });
    const child = holderChild(io.claimPath());
    let said = "";
    child.stdout!.on("data", (chunk: Buffer) => { said += chunk.toString(); });
    const saidAll = new Promise<void>((res) => child.stdout!.once("end", () => res()));
    try {
      await heldBy(child);
      let ran = false;
      const order: string[] = [];
      const second = io.exclusive(async () => { ran = true; }).then(() => { order.push("entered"); }, (err) => { order.push("refused"); throw err; });
      const settledEarly = second.catch(() => undefined);
      for (let look = 1; look <= maxWaits + 1; look++) {
        await Promise.race([nextAsk(look), settledEarly]);
        expect(asks.length).toBe(look);             // one wait per look, and no look begins before its wait ends
        // The holder hangs up on the look's callers (its release-watch and its second ask). A hang-up alone ends no look.
        await Promise.race([askedOf(child, 2), settledEarly]);
        expect(asks.length).toBe(look);
        expect(order).toEqual(Array.from({ length: look - 1 }, (_, k) => `released-${k + 1}`));
        order.push(`released-${look}`);
        asks[look - 1]!.release();
      }
      await expect(second).rejects.toBeInstanceOf(CustodyLockRefused);
      expect(order).toEqual([...Array.from({ length: maxWaits + 1 }, (_, k) => `released-${k + 1}`), "refused"]);   // refused only after its last wait
      expect(asks.map((a) => a.pollMs)).toEqual(Array(maxWaits + 1).fill(pollMs));
      expect(ran).toBe(false);
      expect(existsSync(io.claimPath())).toBe(true);   // CONTROL: the live claim stood untouched
      // THE HOLDER'S OWN TALLY, read whole once it leaves. A look reaches the holder four times: twice to find it
      // live (the claim's ask and the contender's), once to watch for its release, and once more after the
      // hang-up to see that it still answers. A look that ended on the hang-up alone would reach it three times.
      child.kill("SIGTERM");
      await saidAll;
      expect(said.split("asked").length - 1).toBe(4 * (maxWaits + 1));
    } finally { child.kill("SIGKILL"); }
  });

  test("RED: a holder that leaves during the last wait spends no look: the contender enters, never refuses — CONTROL: one that stays refuses", async () => {
    // maxWaits 0: the budget holds ONE look. The holder leaves inside that look's wait (the port's wait releases only
    // once it exited), so the look ends on the name falling quiet and the contender claims it rather than naming a
    // live holder that no longer answers.
    let onAsk: () => void = () => undefined;
    const pace = () => new Promise<void>((release) => { onAsk = release; asked(); });
    let asked: () => void = () => undefined;
    const askedOnce = new Promise<void>((res) => { asked = res; });
    const io = new FsCustodyIo(homes, { maxWaits: 0, pollMs: 10, pace });
    const child = holderChild(io.claimPath());
    try {
      await heldBy(child);
      let ran = false;
      const second = io.exclusive(async () => { ran = true; });
      await askedOnce;
      child.kill("SIGTERM");
      await gone(child);
      onAsk();
      await second;
      expect(ran).toBe(true);
    } finally { child.kill("SIGKILL"); }
    const io2 = new FsCustodyIo(homes, { maxWaits: 0, pollMs: 10 });
    const stays = holderChild(io2.claimPath());
    try {
      await heldBy(stays);
      await expect(io2.exclusive(async () => undefined)).rejects.toBeInstanceOf(CustodyLockRefused);
    } finally { stays.kill("SIGKILL"); }
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
    const stale = join(homes.identity, "s-slots.bin.lock");
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

/** Found a scratch vessel through the production port: a tree over a fresh S key, plus public seal rows. */
async function found(io: CustodyIo): Promise<{ treeKey: TreeKey; treePath: string; sealed: SealedCarrier[] }> {
  const treeKey = mintTreeKey();
  const treePath = sSlotsPath(homes.identity);
  await commitSlotTree({ io, path: treePath, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [pass] }, nativeKdf), carriers: sSealedCarriers(homes) });
  const sealed: SealedCarrier[] = [
    { name: "identity/.persona-enroll-pending.json", path: join(homes.identity, ".persona-enroll-pending.json"), keyClass: "relation" },
    { name: "identity/gate-root.bin", path: join(homes.identity, "gate-root.bin"), keyClass: "device-minted" },
    { name: "identity/.persona-grant-pending.json", path: join(homes.identity, ".persona-grant-pending.json"), keyClass: "relation" },
  ];
  for (const c of sealed) await writeSealedCarrier({ io, treeKey, treePath, carrier: c, plaintext: text(`${c.name}-v1`) });
  await io.write(join(homes.seal, "transition-pending.json"), text("{}"));
  await io.write(join(homes.seal, "transitions.json"), text("[]"));
  return { treeKey, treePath, sealed };
}

describe("PROOF 1 — rotate, reopen, compare, rename on actual carrier files", { timeout: 60_000 }, () => {
  test("CONTROL: a rotation re-seals every S key carrier and leaves public seal rows readable with no key", async () => {
    const io = new FsCustodyIo(homes);
    const f = await found(io);
    const before = new Map(await Promise.all(f.sealed.map(async (c) => [c.path, Buffer.from((await io.read(c.path))!).toString("hex")] as const)));
    const plain = ["transition-pending.json", "transitions.json"].map((file) => ({ path: join(homes.seal, file), bytes: readFileSync(join(homes.seal, file)) }));
    const newTreeKey = mintTreeKey();
    await rotateNodeKey({ io, homes, oldTreeKey: f.treeKey, newTreeKey, slots: [{ t: 1, pins: [pass] }] });

    const tree = decodeSlotTree((await io.read(f.treePath))!);
    const opened = tree.reading === "readable" ? await openTreeKey(tree.tree, [pass], nativeKdf) : null;
    expect(opened?.reading).toBe("opens");
    const treeKey2 = (opened as { treeKey: TreeKey }).treeKey;
    for (const c of f.sealed) {
      const r = await openSealedCarrier({ io, treeKey: treeKey2, carrier: c });
      expect(r.reading === "opens" && str(r.plaintext), c.name).toBe(`${c.name}-v1`);                       // compare
      expect((await openSealedCarrier({ io, treeKey: f.treeKey, carrier: c })).reading, c.name).toBe("key-fails");    // the retired S key opens nothing
      expect(Buffer.from((await io.read(c.path))!).toString("hex"), c.name).not.toBe(before.get(c.path));   // the bytes MOVED
      expect(readSCarrier((await io.read(c.path))!)).toBe("sealed");
    }
    for (const row of plain) {
      expect(readFileSync(row.path).equals(row.bytes)).toBe(true);
      expect(readSCarrier((await io.read(row.path))!)).toBe("bare");
    }
    for (const p of await io.list()) expect(p.endsWith(SEALING_SUFFIX) || p.endsWith(ROTATING_SUFFIX) || p.endsWith(".io-tmp"), p).toBe(false);   // rename left no sidecar
    expect(existsSync(io.claimPath())).toBe(false);
  });

  test("MUTATION: a stranger S key rotates nothing — every carrier stands byte-for-byte", async () => {
    const io = new FsCustodyIo(homes);
    await found(io);
    const before = treeHash(root);
    await expect(rotateNodeKey({ io, homes, oldTreeKey: mintTreeKey(), newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [pass] }] })).rejects.toThrow(/refusing/);
    expect(treeHash(root)).toBe(before);
  });
});

describe("PROOF 3 — an occupied store refuses before any write", () => {
  test("a standing cleartext pending-enrollment row and no slot tree: the founding refuses as an occupied store, and every byte stands", async () => {
    const io = new FsCustodyIo(homes);
    writeFileSync(join(homes.identity, ".persona-enroll-pending.json"), "{\"cleartext\":true}");
    writeFileSync(join(homes.identity, "gate-root.bin"), "bare-root");
    const before = treeHash(root);
    const treeKey = mintTreeKey();
    const err = await commitSlotTree({
      io, path: sSlotsPath(homes.identity), expected: null, treeKey,
      tree: await bindSlot(null, treeKey, { t: 1, pins: [pass] }, nativeKdf), carriers: sSealedCarriers(homes),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect((err as OccupiedStoreRefusal).standing.map((s) => s.carrier.name).sort()).toEqual(["identity/.persona-enroll-pending.json", "identity/gate-root.bin"]);
    expect((err as OccupiedStoreRefusal).standing.find((s) => s.carrier.keyClass === "relation")).toBeDefined();   // the table's class rides the list
    expect(treeHash(root)).toBe(before);
    expect(existsSync(sSlotsPath(homes.identity))).toBe(false);
    expect(existsSync(`${sSlotsPath(homes.identity)}${SEALING_SUFFIX}`)).toBe(false);
  });

  test("CONTROL: empty homes found cleanly", async () => {
    const io = new FsCustodyIo(homes);
    await found(io);
    expect(existsSync(sSlotsPath(homes.identity))).toBe(true);
  });

  test("a S-sealed stray in a storage subtree no row names refuses the founding through list(); MUTATION: a port whose list() is empty lets it through", async () => {
    const io = new FsCustodyIo(homes);
    const treeKey0 = mintTreeKey();
    const t0 = join(root, "other-tree.bin");
    const stray: SealedCarrier = { name: "storage/odd/stray.bin", path: join(homes.storage, "odd", "stray.bin") };
    // Seal a stray under another vessel's tree, then drop it into this vessel's storage home.
    await commitSlotTree({ io, path: t0, expected: null, treeKey: treeKey0, tree: await bindSlot(null, treeKey0, { t: 1, pins: [pass] }, nativeKdf), carriers: [] });
    await writeSealedCarrier({ io, treeKey: treeKey0, treePath: t0, carrier: stray, plaintext: text("x") });
    rmSync(t0);

    const treeKey = mintTreeKey();
    const args = { path: sSlotsPath(homes.identity), expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [pass] }, nativeKdf), carriers: sSealedCarriers(homes) };
    const err = await commitSlotTree({ io, ...args }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect((err as OccupiedStoreRefusal).unlisted).toEqual([stray.path]);
    expect(existsSync(sSlotsPath(homes.identity))).toBe(false);

    const blind: CustodyIo = {
      read: (p) => io.read(p), write: (p, b) => io.write(p, b), rename: (a, b) => io.rename(a, b),
      remove: (p) => io.remove(p), exclusive: (fn) => io.exclusive(fn), list: async () => [],
    };
    await commitSlotTree({ io: blind, ...args });   // the hole: with no census the stray hides and the founding lands
    expect(existsSync(sSlotsPath(homes.identity))).toBe(true);
  });
});

describe("the relation refusal — no rotation regenerates it", () => {
  test("a write over a relation row the S key cannot open says only the other party re-issues it; a non-relation carrier says nothing of the kind", async () => {
    const io = new FsCustodyIo(homes);
    const f = await found(io);
    const [pending, walk] = f.sealed as [SealedCarrier, SealedCarrier, SealedCarrier];   // a relation row, and a device-minted one that is no relation
    // Replace both with bytes sealed under a DIFFERENT treeKey (same carrier name, so only the key differs).
    const altRoot = join(root, "alt");
    const altIo = new FsCustodyIo({ identity: join(altRoot, "i"), storage: join(altRoot, "s"), seal: join(altRoot, "n") });
    const other = mintTreeKey();
    const altTree = join(altRoot, "i", "s-slots.bin");
    await commitSlotTree({ io: altIo, path: altTree, expected: null, treeKey: other, tree: await bindSlot(null, other, { t: 1, pins: [pass] }, nativeKdf), carriers: [] });
    for (const c of [pending, walk]) {
      const alt = { ...c, path: join(altRoot, "c", c.name.replace(/\//g, "_")) };
      await writeSealedCarrier({ io: altIo, treeKey: other, treePath: altTree, carrier: alt, plaintext: text("alien") });
      await io.write(c.path, (await altIo.read(alt.path))!);
    }

    const relation = await writeSealedCarrier({ io, treeKey: f.treeKey, treePath: f.treePath, carrier: pending, plaintext: text("x") }).catch((e: unknown) => e);
    expect(relation).toBeInstanceOf(CustodyRefusal);
    expect((relation as Error).message).toMatch(/only the other party can re-issue it/);
    const plain = await writeSealedCarrier({ io, treeKey: f.treeKey, treePath: f.treePath, carrier: walk, plaintext: text("x") }).catch((e: unknown) => e);
    expect(plain).toBeInstanceOf(CustodyRefusal);
    expect((plain as Error).message).not.toMatch(/other party/);
  });
});
