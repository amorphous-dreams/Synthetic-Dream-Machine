/**
 * face-key-independence — ONE PASSPHRASE NEVER YIELDS EQUAL OR RELATED FACE KEYS (the lit set's ease of use: one passphrase
 * may open every face through `vault unlock --all`, and that ease buys no link between the faces' keys).
 *
 * Read off the code (2026-11-10): no face key derives from a passphrase. Each face's custody key (FCK, `mintFck`), its
 * address secret (`mintFaceAddressSecret`), its atom seed (`mintFaceAtomSeed`) and its per-Nexus proof key
 * (`face-key-custody`) mint at random. A passphrase only WRAPS a face's FCK inside that face's own slot tree, and each pin
 * derives its wrap key by scrypt under a fresh random salt, then HKDF under the slot's random id (`keyslot.bindSlot`). So
 * two faces bound under one passphrase hold unrelated keys, unrelated salts and unrelated wraps: no per-face salt needed
 * beyond what stands.
 *
 *   K1 — two face trees, one passphrase: each opens to its own FCK, and the two FCKs differ
 *   K2 — their pins carry different salts, slot ids and wraps; neither tree's record opens the other's FCK
 *   K3 — atom seeds and FCKs mint fresh each time (no derivation input names a face)
 *
 * Written beside the reading (written, unrun here; CI runs it).
 */
import { describe, expect, test } from "vitest";
import { bindSlot, openTreeKey, nobleKdf } from "../src/keyslot.js";
import { mintFck } from "../src/fck.js";
import { mintFaceAtomSeed } from "../src/face-atom.js";

const PASSPHRASE = "one passphrase for every face";
const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");

describe("one passphrase, unrelated face keys", () => {
  test("K1 + K2 — two faces under one passphrase open to different FCKs through different salts, ids and wraps", async () => {
    const fck0 = mintFck(), fck1 = mintFck();
    const tree0 = await bindSlot(null, fck0, { t: 1, pins: [{ kind: "passphrase", passphrase: PASSPHRASE }] }, nobleKdf);
    const tree1 = await bindSlot(null, fck1, { t: 1, pins: [{ kind: "passphrase", passphrase: PASSPHRASE }] }, nobleKdf);
    const open0 = await openTreeKey(tree0, [{ kind: "passphrase", passphrase: PASSPHRASE }], nobleKdf);
    const open1 = await openTreeKey(tree1, [{ kind: "passphrase", passphrase: PASSPHRASE }], nobleKdf);
    expect(open0.reading).toBe("opens");
    expect(open1.reading).toBe("opens");
    if (open0.reading !== "opens" || open1.reading !== "opens") return;
    expect(hex(open0.treeKey)).toBe(hex(fck0));
    expect(hex(open1.treeKey)).toBe(hex(fck1));
    expect(hex(open0.treeKey)).not.toBe(hex(open1.treeKey));
    const pin0 = tree0.slots[0]!.pins[0]!, pin1 = tree1.slots[0]!.pins[0]!;
    expect(pin0.kind).toBe("passphrase");
    expect(pin1.kind).toBe("passphrase");
    if (pin0.kind !== "passphrase" || pin1.kind !== "passphrase") return;
    expect(pin0.salt).not.toBe(pin1.salt);
    expect(tree0.slots[0]!.id).not.toBe(tree1.slots[0]!.id);
    expect(pin0.wrapped).not.toBe(pin1.wrapped);
    // A tree commits to its own key: face 1's tree refuses face 0's FCK as its tree key.
    await expect(bindSlot(tree1, fck0, { t: 1, pins: [{ kind: "passphrase", passphrase: "another" }] }, nobleKdf)).rejects.toThrow(/not the tree key this tree commits to/);
  }, 30_000);

  test("K3 — face keys mint fresh: no two atom seeds or FCKs repeat, and none equals another face's", () => {
    const seeds = new Set(Array.from({ length: 8 }, () => hex(mintFaceAtomSeed())));
    const fcks = new Set(Array.from({ length: 8 }, () => hex(mintFck())));
    expect(seeds.size).toBe(8);
    expect(fcks.size).toBe(8);
  });
});
