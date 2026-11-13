/**
 * keyslot-lazy-open.test — an open derives a passphrase only when a pin actually tries it.
 *
 * The count rides a counting port (no clock): every derivation the open asks for passes through it once. A right
 * route offered first costs one derivation, whatever else rides beside it; a route that already opened one pin of a
 * slot never derives again for another pin of that slot (ONE ROUTE, ONE PIN: it cannot open a second). A wrong list
 * still costs what it costs today, and every reading stays as it was.
 */
import { describe, test, expect, vi } from "vitest";

vi.setConfig({ testTimeout: 120_000 });
import { bindSlot, openTreeKey, mintKdfPort, draftPaperPin, confirmPaperPin, type KdfPort } from "../src/keyslot.js";
import { nativeKdf } from "../src/node.js";
import { mintTreeKey, treeKeyEquals } from "../src/tree-key.js";

const pass = (passphrase: string) => ({ kind: "passphrase", passphrase }) as const;
const A = pass("lazy-open passphrase A");
const B = pass("lazy-open passphrase B");
const W1 = pass("lazy-open wrong one");
const W2 = pass("lazy-open wrong two");

// The counting port derives through the native port's own bytes, so the count measures and changes nothing.
function counting(): { readonly kdf: KdfPort; readonly count: () => number } {
  let n = 0;
  const inner = nativeKdfDerive();
  return { kdf: mintKdfPort(async (pw, salt, cost) => { n++; return inner(pw, salt, cost); }), count: () => n };
}
import { scrypt as nodeScrypt } from "node:crypto";
function nativeKdfDerive() {
  return (pw: Uint8Array, salt: Uint8Array, cost: { readonly N: number; readonly r: number; readonly p: number; readonly dkLen: number }) =>
    new Promise<Uint8Array>((res, rej) => nodeScrypt(pw, salt, cost.dkLen, { N: cost.N, r: cost.r, p: cost.p, maxmem: 2 * 128 * cost.N * cost.r * cost.p }, (e, k) => (e ? rej(e) : res(new Uint8Array(k)))));
}

describe("the lazy open", () => {
  test("a right route offered first derives once, whatever rides beside it", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [A] }, nativeKdf);
    const c = counting();
    const opened = await openTreeKey(tree, [A, W1, W2], c.kdf);
    expect(opened.reading === "opens" && treeKeyEquals(opened.treeKey, treeKey)).toBe(true);
    expect(c.count()).toBe(1);
  });

  test("a right route offered second derives twice", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [A] }, nativeKdf);
    const c = counting();
    expect((await openTreeKey(tree, [W1, A, W2], c.kdf)).reading).toBe("opens");
    expect(c.count()).toBe(2);
  });

  test("a route that opened one pin of a 2-of-2 slot never derives for the other pin", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 2, pins: [A, B] }, nativeKdf);
    const c = counting();
    const opened = await openTreeKey(tree, [A, B], c.kdf);
    expect(opened.reading === "opens" && treeKeyEquals(opened.treeKey, treeKey)).toBe(true);
    expect(c.count()).toBe(2);
  });

  test("CONTROL: a wrong list costs one derivation per passphrase per pin, and opens nothing", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [A] }, nativeKdf);
    const c = counting();
    expect((await openTreeKey(tree, [W1, W2], c.kdf)).reading).toBe("no-slot-opens");
    expect(c.count()).toBe(2);
  });

  test("CONTROL: a paper slot derives nothing for the passphrases offered beside its sheets", async () => {
    const draft = draftPaperPin();
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "paper", confirmed: confirmPaperPin(draft, draft.sheets) }] }, nativeKdf);
    const c = counting();
    const opened = await openTreeKey(tree, [W1, { kind: "paper", sheets: draft.sheets }], c.kdf);
    expect(opened.reading === "opens" && treeKeyEquals(opened.treeKey, treeKey)).toBe(true);
    expect(c.count()).toBe(0);
  });
});
