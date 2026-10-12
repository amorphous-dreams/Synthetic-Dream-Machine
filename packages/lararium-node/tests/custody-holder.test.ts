import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TreeVkRefusal, type Credential } from "@lararium/mesh";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody } from "../src/custody-session.js";
import { makeCustodyHolder, CustodyLocked, CustodyRowUnknown } from "../src/custody-holder.js";
import { vkSlotsPath, type CustodyHomes } from "../src/vault-carriers.js";

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
beforeEach(() => { const s = stage("main"); root = s.root; homes = s.homes; io = s.io; });
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

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
    const target = vkSlotsPath(homes.identity);
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

  test("H3 a tree for another VK refuses without changing the row or leaving a sidecar", async () => {
    const h = await found();
    const b = stage("h3-b");
    await foundCustody({ io: b.io, homes: b.homes, slots: [{ t: 1, pins: [pass(RIGHT)] }] });
    await h.unlock([pass(RIGHT)]);
    const file = ".circles-follow.json";
    const first = new TextEncoder().encode('{"first":true}');
    await h.writeRow("identity", file, first);
    const path = join(homes.identity, file);
    const kept = readFileSync(path);
    const tree = readFileSync(vkSlotsPath(homes.identity));
    writeFileSync(vkSlotsPath(homes.identity), readFileSync(vkSlotsPath(b.homes.identity)));
    await expect(h.writeRow("identity", file, new TextEncoder().encode('{"second":true}'))).rejects.toBeInstanceOf(TreeVkRefusal);
    expect(readFileSync(path).equals(kept)).toBe(true);
    expect(existsSync(`${path}.vk-sealing`)).toBe(false);
    writeFileSync(vkSlotsPath(homes.identity), tree);
    const fresh = makeCustodyHolder({ io, homes });
    await fresh.unlock([pass(RIGHT)]);
    const got = await fresh.readRow("identity", file);
    expect(got.reading).toBe("opens");
    if (got.reading === "opens") expect(got.plaintext).toEqual(first);
  });

  test("H4 bare, absent and truncated rows keep distinct readings", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]);
    const file = "anchors-h0.json";
    writeFileSync(join(homes.identity, file), '{"bare":true}');
    expect(await h.readRow("identity", file)).toEqual({ reading: "unavailable", why: "bare" });
    expect(await h.readRow("identity", "anchors-h1.json")).toEqual({ reading: "absent" });
    // A sealed row cut short: it bears the seal and no longer opens. It reads unavailable by the reader's own
    // name for it, never `opens` and never `absent`.
    await h.writeRow("identity", "anchors-h2.json", new TextEncoder().encode('{"whole":true}'));
    const whole = readFileSync(join(homes.identity, "anchors-h2.json"));
    writeFileSync(join(homes.identity, "anchors-h2.json"), whole.subarray(0, whole.length - 5));
    const cut = await h.readRow("identity", "anchors-h2.json");
    expect(cut.reading).toBe("unavailable");
    expect(["torn", "key-fails", "unopenable"]).toContain((cut as { why: string }).why);
  });

  test("H5 lock drops access and permits another successful unlock", async () => {
    const h = await found(); await h.unlock([pass(RIGHT)]); await h.lock();
    expect(await h.readRow("identity", ".circles-follow.json")).toEqual({ reading: "locked" });
    await expect(h.writeRow("identity", ".circles-follow.json", new Uint8Array())).rejects.toBeInstanceOf(CustodyLocked);
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
});
