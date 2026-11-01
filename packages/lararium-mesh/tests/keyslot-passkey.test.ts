import { describe, expect, test } from "vitest";
import { hkdf } from "@noble/hashes/hkdf.js";
import { nativeKdf } from "../src/node.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bindSlot, decodeSlotTree, encodeSlotTree, mintPasskeySalt, openPasskeyPin, openTreeKey, PIN_KINDS, type PinSpec, type SlotTree } from "../src/keyslot.js";
import { mintTreeKey, treeKeyEquals } from "../src/tree-key.js";

const output = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const id = Uint8Array.of  (3, 8, 13, 21, 34, 55);
const salt = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
const passphrase = { kind: "passphrase", passphrase: "a route held beside" } as const;
const passkey = (credentialId = id, prfOutput = output, prfSalt = salt): PinSpec => ({ kind: "passkey", credentialId, prfOutput, prfSalt });
const credential = (prfOutput = output) => ({ kind: "passkey" as const, credentialId: id, prfOutput });
const bind = async () => { const key = mintTreeKey(); return { key, tree: await bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }, nativeKdf) }; };
const opens = async (tree: SlotTree, key: ReturnType<typeof mintTreeKey>, credentials: Parameters<typeof openTreeKey>[1]) => {
  const result = await openTreeKey(tree, credentials, nativeKdf); return result.reading === "opens" && treeKeyEquals(result.treeKey, key);
};

describe("passkey pins", () => {
  test("keyslot-passkey-pin-opens", async () => {
    // CONTROL: the former closed union refuses a declared kind without a builder (keyslot.ts:9-11).
    expect(PIN_KINDS).toContain("passkey");
    const { tree, key } = await bind();
    expect(await opens(tree, key, [credential()])).toBe(true);
    const back = decodeSlotTree(encodeSlotTree(tree));
    expect(back.reading === "readable" && await opens(back.tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-wrong-output-refuses", async () => {
    const { tree, key } = await bind(); const wrong = output.slice(); wrong[0] ^= 1;
    expect(openPasskeyPin(tree.slots[0]!, 1, wrong).reading).toBe("slot-refused");
    expect(openPasskeyPin(tree.slots[0]!, 1, output).reading).toBe("opens");
    expect((await openTreeKey(tree, [credential(wrong)], nativeKdf)).reading).toBe("no-slot-opens");
    expect(await opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-beside-passphrase", async () => {
    const { tree, key } = await bind();
    expect(await opens(tree, key, [passphrase])).toBe(true);
    expect(await opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-duplicate-route-refuses", async () => {
    const key = mintTreeKey();
    await expect(bindSlot(null, key, { t: 1, pins: [passphrase, passkey(), passkey()] }, nativeKdf)).rejects.toThrow(/duplicate-route/);
    expect((await bindSlot(null, key, { t: 1, pins: [passphrase, passkey(), passkey(Uint8Array.of(99))] }, nativeKdf)).slots[0]!.pins).toHaveLength(3);
  });
  test("keyslot-passkey-alone-refuses: the TREE never holds a passkey as its only route", async () => {
    const key = mintTreeKey();
    await expect(bindSlot(null, key, { t: 1, pins: [passkey()] }, nativeKdf)).rejects.toThrow(/passkey-alone-refused/);
    // CONTROL: a passkey slot of its own binds beside a standing passphrase slot (the daily route beside the recovery route).
    const withPassphrase = await bindSlot(null, key, { t: 1, pins: [passphrase] }, nativeKdf);
    const both = await bindSlot(withPassphrase, key, { t: 1, pins: [passkey()] }, nativeKdf);
    expect(both.slots).toHaveLength(2);
    expect(await opens(both, key, [credential()])).toBe(true);
    expect(await opens(both, key, [passphrase])).toBe(true);
    // CONTROL: the two routes in one slot bind too.
    expect((await bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }, nativeKdf)).slots).toHaveLength(1);
  });
  test("keyslot-passkey-known-answer: a fixed output, salt, slot id, nonce and tree key wrap to one fixed ciphertext", async () => {
    // A deterministic rng stands for the slot id, the pin nonces and the tree key; the wrapped share is then a known answer.
    let counter = 0;
    const rng = { getRandomValues: <T extends ArrayBufferView>(view: T): T => { const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength); for (let i = 0; i < bytes.length; i++) bytes[i] = (counter++ * 7 + 3) & 255; return view; } };
    const key = mintTreeKey(rng);
    const tree = await bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }, nativeKdf, rng);
    const pin = tree.slots[0]!.pins[1]! as { kind: "passkey"; nonce: string; wrapped: string };
    expect(pin.kind).toBe("passkey");
    expect(`${tree.slots[0]!.id}:${pin.nonce}:${pin.wrapped}`).toMatchInlineSnapshot(`"e3eaf1f8ff060d141b222930373e454c:4b525960676e757c838a91989fa6adb4bbc2c9d0d7dee5ec:decd493dfd957508207d639dcbaec839e8d476b62743b97fd00cfd16e0969e3e6816b47a7110587c42e641104a6f1a71a8"`);
    expect(await opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-moved-share-does-not-open", async () => {
    const { tree, key } = await bind(); const slot = tree.slots[0]!; const pin = slot.pins[1]!;
    const moved = { ...tree, slots: [{ ...slot, pins: [slot.pins[0]!, slot.pins[0]!, pin] }] };
    expect(await opens(moved, key, [credential()])).toBe(false);
    const other = await bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }, nativeKdf);
    const transplanted = { ...other, slots: [{ ...other.slots[0]!, pins: [other.slots[0]!.pins[0]!, pin] }] };
    expect(await opens(transplanted, key, [credential()])).toBe(false);
    expect(await opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-record-holds-no-output", async () => {
    const { tree } = await bind();
    const bytes = JSON.stringify((JSON.parse(new TextDecoder().decode(encodeSlotTree(tree))) as { slots: { pins: unknown[] }[] }).slots[0]!.pins[1]); const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
    const slotId = Buffer.from(tree.slots[0]!.id, "hex");
    const info = Buffer.concat([Buffer.from("pin"), slotId, Buffer.of(1), Buffer.from("passkey")]);
    const kek = hkdf(sha256, output, slotId, info, 32);
    expect(bytes).not.toContain(hex(output)); expect(bytes).not.toContain(hex(kek));
    expect(bytes).toContain(hex(id)); expect(bytes).toContain(hex(salt));
    expect(mintPasskeySalt()).toHaveLength(32);
  });
});
