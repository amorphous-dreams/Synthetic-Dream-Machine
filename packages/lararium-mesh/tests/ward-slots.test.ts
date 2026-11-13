/**
 * ward-slots — the face's WARD key rests in its own slot tree, bound over human routes alone, and seals the warded rows under its
 * own frame. A passkey is a web2.5 registry route (an authenticator vendor's PRF), so the ward binds none and opens no tree that
 * carries one, even one a hand edited. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-ward
 */
import { describe, expect, test } from "vitest";
import { nativeKdf } from "../src/node.js";
import { confirmHeldPaper, decodeSlotTree, draftPaperPin, encodeSlotTree, bindSlot, type SlotTree } from "../src/keyslot.js";
import { mintTreeKey, treeKeyEquals } from "../src/tree-key.js";
import { readFckCarrier } from "../src/fck-envelope.js";
import { sealUnderFck, type FaceCarrier } from "../src/fck.js";
import {
  WARD_SEAL_MAGIC, bindWardSlot, mintWardKey, openUnderWard, openWardKey, readWardCarrier, sealUnderWard, WardRefused,
} from "../src/ward-slots.js";

const passphrase = { kind: "passphrase", passphrase: "the ward's own route" } as const;
const passkeyPin = { kind: "passkey", credentialId: Uint8Array.of(1, 2, 3), prfSalt: new Uint8Array(32).fill(7), prfOutput: new Uint8Array(32).fill(9) } as const;
const carrier: FaceCarrier = { name: "identity/.persona-group-root-h0.json", path: "/x", kind: "persona-root", ref: "identity/.persona-group-root-h0.json", owner: "ab".repeat(16), store: "lares-ward" };

describe("the ward binds human routes alone", () => {
  test("RED: a passkey pin refuses at bind by name, beside a passphrase too", async () => {
    const key = mintWardKey();
    await expect(bindWardSlot(null, key, { t: 1, pins: [passkeyPin] }, nativeKdf)).rejects.toThrow(/ward-passkey-refused/);
    await expect(bindWardSlot(null, key, { t: 1, pins: [passphrase, passkeyPin] }, nativeKdf)).rejects.toThrow(/ward-passkey-refused/);
  });

  test("RED: a hand-edited tree that carries a passkey pin opens nothing, even under the right passphrase", async () => {
    const key = mintWardKey();
    // The plain keyslot door binds a passkey beside a passphrase; a hand moves that slot into the ward tree.
    const edited: SlotTree = await bindSlot(null, key, { t: 1, pins: [passphrase, passkeyPin] }, nativeKdf);
    await expect(openWardKey(edited, [passphrase], nativeKdf)).rejects.toThrow(WardRefused);
    await expect(openWardKey(edited, [passphrase], nativeKdf)).rejects.toThrow(/ward-passkey-refused/);
    // A passkey credential offered to a clean tree refuses too: the ward reads no authenticator output.
    const clean = await bindWardSlot(null, key, { t: 1, pins: [passphrase] }, nativeKdf);
    await expect(openWardKey(clean, [{ kind: "passkey", credentialId: Uint8Array.of(1), prfOutput: new Uint8Array(32) }], nativeKdf)).rejects.toThrow(/ward-passkey-refused/);
  });

  test("CONTROL: a passphrase slot and a paper slot each open the ward key, through the tree at rest", async () => {
    const key = mintWardKey();
    const draft = draftPaperPin();
    let tree = await bindWardSlot(null, key, { t: 1, pins: [passphrase] }, nativeKdf);
    tree = await bindWardSlot(tree, key, { t: 1, pins: [{ kind: "paper", confirmed: confirmHeldPaper(draft.sheets) }] }, nativeKdf);
    const back = decodeSlotTree(encodeSlotTree(tree));
    if (back.reading !== "readable") throw new Error("the ward tree did not read back");
    const byPassphrase = await openWardKey(back.tree, [passphrase], nativeKdf);
    const byPaper = await openWardKey(back.tree, [{ kind: "paper", sheets: draft.sheets }], nativeKdf);
    expect(byPassphrase.reading === "opens" && treeKeyEquals(byPassphrase.treeKey, key)).toBe(true);
    expect(byPaper.reading === "opens" && treeKeyEquals(byPaper.treeKey, key)).toBe(true);
    expect((await openWardKey(back.tree, [{ kind: "passphrase", passphrase: "another" }], nativeKdf)).reading).toBe("no-slot-opens");
  });
});

describe("the ward seals under its own frame", () => {
  test("RED: an FCK-framed seal reads as no ward seal, and a ward seal reads as no face seal", () => {
    const key = mintTreeKey();
    const fckFramed = sealUnderFck(key, carrier, new Uint8Array([1, 2, 3]));
    expect(readWardCarrier(fckFramed)).not.toBe("sealed");
    expect(openUnderWard(key, carrier, fckFramed).reading).not.toBe("opens");
    const warded = sealUnderWard(key, carrier, new Uint8Array([1, 2, 3]));
    expect(readFckCarrier(warded)).not.toBe("sealed");
    expect(new TextDecoder().decode(warded.subarray(0, WARD_SEAL_MAGIC.length))).toBe("lares-ward-seal");
  });

  test("CONTROL: a ward seal opens under its key and its carrier alone", () => {
    const key = mintWardKey();
    const warded = sealUnderWard(key, carrier, new Uint8Array([4, 5, 6]));
    expect(readWardCarrier(warded)).toBe("sealed");
    const opened = openUnderWard(key, carrier, warded);
    expect(opened.reading === "opens" && [...opened.plaintext]).toEqual([4, 5, 6]);
    expect(openUnderWard(mintWardKey(), carrier, warded).reading).toBe("key-fails");
    expect(openUnderWard(key, { ...carrier, name: "identity/.persona-group-root-h1.json" }, warded).reading).toBe("key-fails");
  });
});
