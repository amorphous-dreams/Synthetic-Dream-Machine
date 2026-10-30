import { describe, expect, test } from "vitest";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bindSlot, decodeSlotTree, encodeSlotTree, mintPasskeySalt, openPasskeyPin, openTreeKey, PIN_KINDS, type PinSpec, type SlotTree } from "../src/keyslot.js";
import { mintTreeKey, treeKeyEquals } from "../src/tree-key.js";

const output = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const id = Uint8Array.of  (3, 8, 13, 21, 34, 55);
const salt = Uint8Array.from({ length: 32 }, (_, i) => 255 - i);
const passphrase = { kind: "passphrase", passphrase: "a route held beside" } as const;
const passkey = (credentialId = id, prfOutput = output, prfSalt = salt): PinSpec => ({ kind: "passkey", credentialId, prfOutput, prfSalt });
const credential = (prfOutput = output) => ({ kind: "passkey" as const, credentialId: id, prfOutput });
const bind = () => { const key = mintTreeKey(); return { key, tree: bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }) }; };
const opens = (tree: SlotTree, key: ReturnType<typeof mintTreeKey>, credentials: Parameters<typeof openTreeKey>[1]) => {
  const result = openTreeKey(tree, credentials); return result.reading === "opens" && treeKeyEquals(result.treeKey, key);
};

describe("passkey pins", () => {
  test("keyslot-passkey-pin-opens", () => {
    // CONTROL: the former closed union refuses a declared kind without a builder (keyslot.ts:9-11).
    expect(PIN_KINDS).toContain("passkey");
    const { tree, key } = bind();
    expect(opens(tree, key, [credential()])).toBe(true);
    const back = decodeSlotTree(encodeSlotTree(tree));
    expect(back.reading === "readable" && opens(back.tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-wrong-output-refuses", () => {
    const { tree, key } = bind(); const wrong = output.slice(); wrong[0] ^= 1;
    expect(openPasskeyPin(tree.slots[0]!, 1, wrong).reading).toBe("slot-refused");
    expect(openPasskeyPin(tree.slots[0]!, 1, output).reading).toBe("opens");
    expect(openTreeKey(tree, [credential(wrong)]).reading).toBe("no-slot-opens");
    expect(opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-beside-passphrase", () => {
    const { tree, key } = bind();
    expect(opens(tree, key, [passphrase])).toBe(true);
    expect(opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-duplicate-route-refuses", () => {
    const key = mintTreeKey();
    expect(() => bindSlot(null, key, { t: 1, pins: [passphrase, passkey(), passkey()] })).toThrow(/duplicate-route/);
    expect(bindSlot(null, key, { t: 1, pins: [passphrase, passkey(), passkey(Uint8Array.of(99))] }).slots[0]!.pins).toHaveLength(3);
  });
  test("keyslot-passkey-alone-refuses", () => {
    const key = mintTreeKey();
    expect(() => bindSlot(null, key, { t: 1, pins: [passkey()] })).toThrow(/passkey-alone-refused/);
    expect(bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] }).slots).toHaveLength(1);
  });
  test("keyslot-passkey-moved-share-does-not-open", () => {
    const { tree, key } = bind(); const slot = tree.slots[0]!; const pin = slot.pins[1]!;
    const moved = { ...tree, slots: [{ ...slot, pins: [slot.pins[0]!, slot.pins[0]!, pin] }] };
    expect(opens(moved, key, [credential()])).toBe(false);
    const other = bindSlot(null, key, { t: 1, pins: [passphrase, passkey()] });
    const transplanted = { ...other, slots: [{ ...other.slots[0]!, pins: [other.slots[0]!.pins[0]!, pin] }] };
    expect(opens(transplanted, key, [credential()])).toBe(false);
    expect(opens(tree, key, [credential()])).toBe(true);
  });
  test("keyslot-passkey-record-holds-no-output", () => {
    const { tree } = bind();
    const bytes = JSON.stringify((JSON.parse(new TextDecoder().decode(encodeSlotTree(tree))) as { slots: { pins: unknown[] }[] }).slots[0]!.pins[1]); const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
    const slotId = Buffer.from(tree.slots[0]!.id, "hex");
    const info = Buffer.concat([Buffer.from("pin"), slotId, Buffer.of(1), Buffer.from("passkey")]);
    const kek = hkdf(sha256, output, slotId, info, 32);
    expect(bytes).not.toContain(hex(output)); expect(bytes).not.toContain(hex(kek));
    expect(bytes).toContain(hex(id)); expect(bytes).toContain(hex(salt));
    expect(mintPasskeySalt()).toHaveLength(32);
  });
});
