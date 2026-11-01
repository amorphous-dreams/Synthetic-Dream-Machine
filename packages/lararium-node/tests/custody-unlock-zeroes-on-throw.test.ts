/**
 * custody-unlock-zeroes-on-throw.test — a node key the unlock already opened never outlives a refusal that follows it.
 *
 * `unlockCustody` opens the node key's tree, then the serving key's tree under the same credentials. The second open
 * derives again, and a KDF that refuses there throws `kdf-refused`. The caller never receives the node key then, so
 * nobody else could zero it: the unlock must zero it before the refusal leaves.
 *
 * The seam: `unlockCustody` takes its two openers as a dependency (the vessel passes none and gets the real pair), so
 * this suite wraps the real node opener to hold the key it opened, and runs the real serving opener under a port that
 * refuses.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Credential, TreeKey } from "@lararium/mesh";
import { mintKdfPort } from "@lararium/mesh/keyslot";
import { FsCustodyIo } from "../src/custody-io.js";
import { foundCustody, openCustodyNodeKey, openServingTree, unlockCustody } from "../src/custody-session.js";

vi.setConfig({ testTimeout: 180_000 });

const pass = (passphrase: string): Credential => ({ kind: "passphrase", passphrase });
const refusing = mintKdfPort(async () => { throw new Error("ERR_CRYPTO_INVALID_SCRYPT_PARAMS"); });
const roots: string[] = [];
function stage() {
  const dir = mkdtempSync(join(tmpdir(), "lar-zero-"));
  roots.push(dir);
  const homes = { identity: join(dir, "identity"), storage: join(dir, "vessel"), seal: join(dir, "nexus") };
  mkdirSync(homes.identity, { recursive: true });
  return { homes, io: new FsCustodyIo(homes) };
}
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

/** The real openers, the node one holding what it opened; the serving one under `servingKdf` when given. */
function openers(held: TreeKey[], servingKdf?: ReturnType<typeof mintKdfPort>) {
  return {
    node: async (a: Parameters<typeof openCustodyNodeKey>[0]) => {
      const o = await openCustodyNodeKey(a);
      if (o.reading === "opens") held.push(o.treeKey);
      return o;
    },
    serving: (a: Parameters<typeof openServingTree>[0]) => openServingTree(servingKdf ? { ...a, kdf: servingKdf } : a),
  };
}

describe("a refusal after the node key opened", () => {
  test("the serving tree's KDF refusal zeroes the node key before the unlock rejects", async () => {
    const target = stage();
    await foundCustody({ ...target, slots: [{ t: 1, pins: [pass("zero-route")] }] });
    const held: TreeKey[] = [];
    await expect(unlockCustody({ ...target, credentials: [pass("zero-route")] }, openers(held, refusing))).rejects.toThrow(/kdf-refused/);
    expect(held.length).toBe(1);
    expect(held[0]!.every((b) => b === 0)).toBe(true);
  });

  test("CONTROL: an unlock that meets no refusal hands the node key over whole, and zeroes nothing early", async () => {
    const target = stage();
    await foundCustody({ ...target, slots: [{ t: 1, pins: [pass("zero-route")] }] });
    const held: TreeKey[] = [];
    const u = await unlockCustody({ ...target, credentials: [pass("zero-route")] }, openers(held));
    expect(u.reading).toBe("opens");
    expect(held.length).toBe(1);
    expect(u.reading === "opens" && u.treeKey === held[0]).toBe(true);
    expect(held[0]!.some((b) => b !== 0)).toBe(true);
  });
});
