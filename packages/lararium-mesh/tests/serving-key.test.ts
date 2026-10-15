/**
 * serving-key.test — the serving tree commits to its one SK and opens only under the VK whose entry wraps it
 * (lar:///ha.ka.ba/lararium/mesh/ember#/the-serving-key).
 *
 *   K1 · the tree opens SK under its VK (CONTROL), and under another VK reads `vk-entry-refuses`.
 *   K2 · an entry spliced in from another tree, under the same VK, reads `vk-entry-refuses` (the AAD binds the check),
 *        and a check swapped with the entry left whole reads the same; a one-byte tamper of the wrap reads the same.
 *   K3 · the tree at rest decodes back whole (CONTROL); a tree with no VK entry, a field this build writes nothing
 *        into, and a torn check each read `unreadable` by name; absent bytes read `absent`.
 *   K4 · SK and the check differ across founds; the check names SK and never carries it.
 */
import { describe, expect, test } from "vitest";
import { mintVk } from "../src/vk.js";
import {
  decodeServingTree, encodeServingTree, foundServingTree, mintServingKey, openServingKey, skCheckOf, type ServingTree,
} from "../src/serving-key.js";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
const flip = (h: string, at: number): string => h.slice(0, at) + (h[at] === "0" ? "1" : "0") + h.slice(at + 1);

describe("the serving tree opens under its VK alone", () => {
  test("K1 — its VK opens SK — CONTROL; another VK reads vk-entry-refuses", () => {
    const vk = mintVk();
    const sk = mintServingKey();
    const tree = foundServingTree(sk, vk);
    const o = openServingKey(tree, vk);
    expect(o.reading).toBe("opens");
    if (o.reading === "opens") expect(hex(o.sk)).toBe(hex(sk));
    expect(openServingKey(tree, mintVk()).reading).toBe("vk-entry-refuses");
  });

  test("K2 — a spliced entry, a swapped check and a tampered wrap each open nothing", () => {
    const vk = mintVk();
    const a = foundServingTree(mintServingKey(), vk);
    const b = foundServingTree(mintServingKey(), vk);
    expect(openServingKey({ skCheck: a.skCheck, vkEntry: b.vkEntry }, vk).reading).toBe("vk-entry-refuses");
    expect(openServingKey({ skCheck: b.skCheck, vkEntry: a.vkEntry }, vk).reading).toBe("vk-entry-refuses");
    const tampered: ServingTree = { skCheck: a.skCheck, vkEntry: { ...a.vkEntry, wrapped: flip(a.vkEntry.wrapped, 4) } };
    expect(tampered.vkEntry.wrapped).not.toBe(a.vkEntry.wrapped);
    expect(openServingKey(tampered, vk).reading).toBe("vk-entry-refuses");
    expect(openServingKey(a, vk).reading).toBe("opens");                                  // CONTROL
  });
});

describe("the serving tree at rest", () => {
  test("K3 — it decodes whole, and every shape fault reads unreadable by name", () => {
    const tree = foundServingTree(mintServingKey(), mintVk());
    const bytes = encodeServingTree(tree);
    expect(decodeServingTree(bytes)).toEqual({ reading: "readable", tree });              // CONTROL
    expect(decodeServingTree(null)).toEqual({ reading: "absent" });
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
    const noEntry = decodeServingTree(enc({ skCheck: raw.skCheck }));
    expect(noEntry).toMatchObject({ reading: "unreadable", why: expect.stringMatching(/no VK entry/) });
    const ember = decodeServingTree(enc({ ...raw, embers: [] }));
    expect(ember).toMatchObject({ reading: "unreadable", why: expect.stringMatching(/"embers"/) });
    const torn = decodeServingTree(enc({ ...raw, skCheck: "00" }));
    expect(torn).toMatchObject({ reading: "unreadable", why: expect.stringMatching(/SK check/) });
    expect(decodeServingTree(new TextEncoder().encode("not json")).reading).toBe("unreadable");
  });

  test("K4 — two founds differ, and the check names SK without carrying it", () => {
    const vk = mintVk();
    const one = mintServingKey();
    const two = mintServingKey();
    expect(hex(one)).not.toBe(hex(two));
    expect(skCheckOf(one)).not.toBe(skCheckOf(two));
    expect(skCheckOf(one)).toBe(skCheckOf(Uint8Array.from(one) as typeof one));
    expect(skCheckOf(one)).not.toContain(hex(one));
    expect(foundServingTree(one, vk).skCheck).toBe(skCheckOf(one));
  });
});
