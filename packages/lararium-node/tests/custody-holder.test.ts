import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TreeKeyRefusal, type Credential } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, seatFaceAutoFounder, CustodyLocked, CustodyRowUnknown } from "../src/custody-holder.js";
import { sSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";
import { handleRowPathIn } from "./face-paths.js";

// Every unlock runs the slot's own key derivation, priced to cost a guesser; the suite waits it out.
vi.setConfig({ testTimeout: 180_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const RIGHT = "holder-test-passphrase-A";
let root: string;
let homes: CustodyHomes;
let io: FsCustodyIo;
const roots: string[] = [];

function stage(label: string) {
  const dir = mkdtempSync(join(tmpdir(), `lar-holder-${label}-`));
  roots.push(dir);
  const h = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(h.identity, { recursive: true });
  const c = new FsCustodyIo(h);
  return { root: dir, homes: h, io: c };
}
async function found(target = { homes, io }) {
  await foundCustody({ ...target, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
  return makeCustodyHolder(target);
}
function hashes(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) Object.assign(out, hashes(p));
    else out[p.slice(dir.length)] = createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  return out;
}
beforeEach(() => {
  seatFaceAutoFounder(() => [{ t: 1, pins: [pass(RIGHT)] }]);
  const s = stage("main"); root = s.root; homes = s.homes; io = s.io;
});
afterEach(() => {
  seatFaceAutoFounder(null);
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("CustodyHolder", () => {
  test("H1 wrong route holds nothing and changes no file; right route opens", async () => {
    const h = await found();
    const before = hashes(root);
    const wrong = await h.unlock([pass("holder-test-passphrase-wrong")]);
    expect(wrong).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
    expect(h.isUnlocked()).toBe(false);
    expect(hashes(root)).toEqual(before);
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    expect(h.isUnlocked()).toBe(true);
  });

  test("H2 the fourth guess does not read the slot tree; two misses still permit success", async () => {
    const h = await found();
    const target = sSlotsPath(homes.identity);
    let reads = 0;
    const read = io.read.bind(io);
    io.read = async (path) => { if (path === target) reads++; return read(path); };
    for (let i = 0; i < 3; i++) await h.unlock([pass(`holder-wrong-${i}`)]);
    const before = reads;
    expect(await h.unlock([pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
    expect(reads).toBe(before);
    const control = await found(stage("h2-control"));
    await control.unlock([pass("holder-wrong-a")]);
    await control.unlock([pass("holder-wrong-b")]);
    expect((await control.unlock([pass(RIGHT)])).reading).toBe("opens");
  });

  test("H3 a tree for another S key refuses without changing the row or leaving a sidecar", async () => {
    const h = await found();
    const b = stage("h3-b");
    await foundCustody({ io: b.io, homes: b.homes, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    await h.unlock([pass(RIGHT)]);
    const file = ".persona-admissions.json";
    const first = new TextEncoder().encode('{"first":true}');
    await h.writeRow("identity", file, first);
    const path = join(homes.identity, file);
    const kept = readFileSync(path);
    const tree = readFileSync(sSlotsPath(homes.identity));
    writeFileSync(sSlotsPath(homes.identity), readFileSync(sSlotsPath(b.homes.identity)));
    await expect(h.writeRow("identity", file, new TextEncoder().encode('{"second":true}'))).rejects.toBeInstanceOf(TreeKeyRefusal);
    expect(readFileSync(path).equals(kept)).toBe(true);
    expect(existsSync(`${path}.s-sealing`)).toBe(false);
    writeFileSync(sSlotsPath(homes.identity), tree);
    const fresh = makeCustodyHolder({ io, homes });
    await fresh.unlock([pass(RIGHT)]);
    const got = await fresh.readRow("identity", file);
    expect(got.reading).toBe("opens");
    if (got.reading === "opens") expect(got.plaintext).toEqual(first);
  });

  test("H4 bare, absent and truncated rows keep distinct readings", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    const file = "anchors-h0.json";
    await h.writeRow("identity", file, new TextEncoder().encode('{"whole":true}'));
    writeFileSync(handleRowPathIn(homes.identity, file), '{"bare":true}');
    expect(await h.readRow("identity", file)).toEqual({ reading: "unavailable", why: "bare" });
    await h.writeRow("identity", "guardian-set-h1.json", new TextEncoder().encode('{"whole":true}'));
    expect(await h.readRow("identity", "anchors-h1.json")).toEqual({ reading: "absent" });
    // A sealed row cut short: it bears the seal and no longer opens. It reads unavailable by the reader's own
    // name for it, never `opens` and never `absent`.
    await h.writeRow("identity", "anchors-h2.json", new TextEncoder().encode('{"whole":true}'));
    const whole = readFileSync(handleRowPathIn(homes.identity, "anchors-h2.json"));
    writeFileSync(handleRowPathIn(homes.identity, "anchors-h2.json"), whole.subarray(0, whole.length - 5));
    const cut = await h.readRow("identity", "anchors-h2.json");
    expect(cut.reading).toBe("unavailable");
    expect(["torn", "key-fails", "unopenable"]).toContain((cut as { why: string }).why);
  });

  test("H5 lock drops access and permits another successful unlock", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]); await h.lock();
    expect(await h.readRow("identity", ".persona-admissions.json")).toEqual({ reading: "locked" });
    await expect(h.writeRow("identity", ".persona-admissions.json", new Uint8Array())).rejects.toBeInstanceOf(CustodyLocked);
    await expect(h.updateRow("identity", ".persona-admissions.json", () => ({ plaintext: new Uint8Array(), value: 1 }))).rejects.toBeInstanceOf(CustodyLocked);
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
  });

  test("H6 concurrent successful unlocks serialize", async () => {
    const h = await found();
    const out = await Promise.all([h.unlock([pass(RIGHT)]), h.unlock([pass(RIGHT)])]);
    expect(out.map((x) => x.reading).sort()).toEqual(["already-unlocked", "opens"]);
  });

  test("H7 cold plaintext is scoped to the act and zeroed afterward", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    const file = ".persona-group-root-h0.json";
    const plain = new TextEncoder().encode('{"secret":"synthetic"}');
    await h.writeRow("identity", file, plain);
    let handed!: Uint8Array;
    await h.openColdRow("identity", file, (bytes) => { handed = bytes; expect(bytes).toEqual(plain); });
    expect(handed.every((n) => n === 0)).toBe(true);
    await expect(h.readRow("identity", file)).rejects.toBeInstanceOf(CustodyRowUnknown);
  });

  test("H8 unknown addresses refuse on reads and writes", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    await expect(h.readRow("identity", "not-a-row.bin")).rejects.toBeInstanceOf(CustodyRowUnknown);
    await expect(h.writeRow("identity", "not-a-row.bin", new Uint8Array())).rejects.toBeInstanceOf(CustodyRowUnknown);
  });

  test("H9 holder diagnostics and readings do not contain the credential", async () => {
    const h = await found();
    const results = [await h.unlock([pass("holder-wrong-H9")]), await h.unlock([pass(RIGHT)])];
    const { inspect } = await import("node:util");
    const text = JSON.stringify(h) + inspect(h, { showHidden: true }) + JSON.stringify(results);
    expect(text).not.toContain(RIGHT);
  });

  test("H10 a lock sent while an unlock derives leaves nothing held", async () => {
    const h = await found();
    const opening = h.unlock([pass(RIGHT)]);       // inside its key derivation
    const locking = h.lock();                       // takes its turn behind it
    expect((await opening).reading).toBe("opens");
    await locking;
    expect(h.isUnlocked(), "no key lands after the lock that meant to drop it").toBe(false);
    expect((await h.unlock([pass(RIGHT)])).reading, "CONTROL: the holder opens again afterward").toBe("opens");
  });
});

describe("CustodyHolder.proves — a person stands at an unlocked vessel", () => {
  test("P1 the vessel's own route proves, opens nothing new and spends no attempt", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    const before = hashes(root);
    expect(await h.proves([pass(RIGHT)])).toEqual({ reading: "proves" });
    expect(h.attemptsLeft()).toBe(3);
    expect(h.isUnlocked()).toBe(true);
    expect(hashes(root)).toEqual(before);
  });

  test("P2 a route that opens no slot spends one of the boot's attempts, and spent attempts refuse before any derivation", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    expect(await h.proves([pass("holder-wrong-P2-a")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
    expect(await h.proves([pass("holder-wrong-P2-b")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 1 });
    expect(await h.proves([pass("holder-wrong-P2-c")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 0 });
    const target = sSlotsPath(homes.identity);
    let reads = 0;
    const read = io.read.bind(io);
    io.read = async (path) => { if (path === target) reads++; return read(path); };
    // The right route, after the attempts stand spent: refused, and the tree never gets read.
    expect(await h.proves([pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
    expect(reads).toBe(0);
    expect(h.isUnlocked(), "a spent proof drops nothing the vessel holds").toBe(true);
  });

  test("P3 a proof and an unlock share the one bound", async () => {
    const h = await found();
    await h.unlock([pass("holder-wrong-P3-a")]);
    await h.unlock([pass("holder-wrong-P3-b")]);
    expect((await h.unlock([pass(RIGHT)])).reading).toBe("opens");
    expect(await h.proves([pass("holder-wrong-P3-c")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 0 });
    expect(await h.proves([pass(RIGHT)])).toEqual({ reading: "attempts-spent" });
  });

  test("P4 a locked holder proves nothing and spends nothing", async () => {
    const h = await found();
    expect(await h.proves([pass(RIGHT)])).toEqual({ reading: "locked" });
    expect(h.attemptsLeft()).toBe(3);
    expect(h.isUnlocked(), "a proof never opens the key").toBe(false);
  });

  test("P5 a route that opens ANOTHER vessel's tree proves nothing here and spends an attempt", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    // Another vessel's tree, founded under another route, laid over this vessel's tree file.
    const other = stage("p5-other");
    await foundCustody({ ...other, slots: [{ t: 1, pins: [pass("the-other-vessels-route")] }] });
    const mine = readFileSync(sSlotsPath(homes.identity));
    writeFileSync(sSlotsPath(homes.identity), readFileSync(sSlotsPath(other.homes.identity)));
    // THE BYTES MOVED: the tree at this vessel's path now reads as the other vessel's.
    expect(readFileSync(sSlotsPath(homes.identity)).equals(mine)).toBe(false);
    expect(await h.proves([pass("the-other-vessels-route")])).toEqual({ reading: "no-slot-opens", attemptsLeft: 2 });
    // CONTROL: with its own tree back, its own route proves.
    writeFileSync(sSlotsPath(homes.identity), mine);
    expect(await h.proves([pass(RIGHT)])).toEqual({ reading: "proves" });
  });

  test("P6 a proof's answer carries no credential", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    const text = JSON.stringify([await h.proves([pass(RIGHT)]), await h.proves([pass("holder-wrong-P6")])]);
    expect(text).not.toContain(RIGHT);
    expect(text).not.toContain("holder-wrong-P6");
  });
});

describe("CustodyHolder.removeColdRow — an act removes the cold row it committed", () => {
  const COLD = ".persona-group-root-h0.json";
  const HOT = ".persona-admissions.json";
  test("C1 a cold row leaves, and a second removal answers that none stood", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    await h.writeRow("identity", COLD, new TextEncoder().encode('{"pending":"synthetic"}'));
    expect(existsSync(handleRowPathIn(homes.identity, COLD))).toBe(true);
    expect(await h.removeColdRow("identity", COLD)).toBe(true);
    expect(existsSync(handleRowPathIn(homes.identity, COLD))).toBe(false);
    expect(await h.removeColdRow("identity", COLD)).toBe(false);
  });

  test("C2 a hot row refuses the cold removal and stays; an unknown address refuses", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    await h.writeRow("identity", HOT, new TextEncoder().encode('{"roots":[]}'));
    await expect(h.removeColdRow("identity", HOT)).rejects.toBeInstanceOf(CustodyRowUnknown);
    expect(existsSync(join(homes.identity, HOT))).toBe(true);
    await expect(h.removeColdRow("identity", "not-a-row.bin")).rejects.toBeInstanceOf(CustodyRowUnknown);
  });

  test("C3 a locked holder removes nothing", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    await h.writeRow("identity", COLD, new TextEncoder().encode('{"pending":"synthetic"}'));
    await h.lock();
    await expect(h.removeColdRow("identity", COLD)).rejects.toBeInstanceOf(CustodyLocked);
    expect(existsSync(handleRowPathIn(homes.identity, COLD))).toBe(true);
  });

  test("C4 a cold row another vessel's key sealed stays, and the removal refuses by name", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    await h.writeRow("identity", COLD, new TextEncoder().encode('{"pending":"of this vessel"}'));
    const other = stage("c4-other");
    const o = await found(other); await o.unlock([pass(RIGHT)]);
    await o.writeRow("identity", COLD, new TextEncoder().encode('{"pending":"of another vessel"}'));
    const ownPath = handleRowPathIn(homes.identity, COLD);
    writeFileSync(ownPath, readFileSync(handleRowPathIn(other.homes.identity, COLD)));
    const before = readFileSync(ownPath);
    await expect(h.removeColdRow("identity", COLD)).rejects.toThrow(/custody row identity\/\.persona-group-root-h0\.json reads/);
    expect(readFileSync(ownPath).equals(before)).toBe(true);
  });
});
