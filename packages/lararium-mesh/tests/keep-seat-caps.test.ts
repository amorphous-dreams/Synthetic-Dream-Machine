/**
 * keep-seat-caps — a slot tree read off disk or a remote holds a bounded count of slots and pins, so a crafted tree spends no
 * open past what the house itself binds.
 *
 * Each passphrase pin costs a derivation at custody's cost, and a keep seat rides a remote anyone may write: a seat crafted with
 * thousands of pins would make one restore grind for hours.
 *
 *   KC1  RED: a tree of more slots than any bind makes reads `unreadable`, named. CONTROL: a real tree reads.
 *   KC2  RED: a keep seat holding more slots or pins than a keep binds reads `unreadable`, named.
 */
import { describe, expect, test, vi } from "vitest";
import { bindSlot, decodeSlotTree, encodeSlotTree, nobleKdf } from "../src/keyslot.js";
import { mintTreeKey } from "../src/tree-key.js";

vi.setConfig({ testTimeout: 120_000 });

describe("a tree read off disk holds bounded slots and pins", () => {
  test("KC1 RED: a tree of more slots than any bind makes reads unreadable", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [{ kind: "passphrase", passphrase: "one route" }] }, nobleKdf);
    const raw = JSON.parse(new TextDecoder().decode(encodeSlotTree(tree))) as { slots: unknown[] };
    expect(decodeSlotTree(encodeSlotTree(tree)).reading, "CONTROL: a real tree reads").toBe("readable");
    const many = { ...raw, slots: Array.from({ length: 65 }, () => raw.slots[0]) };
    const read = decodeSlotTree(new TextEncoder().encode(JSON.stringify(many)));
    expect(read.reading).toBe("unreadable");
    expect((read as { why: string }).why).toMatch(/slots/);
  });

  test("KC2 RED: a keep seat holding more slots or pins than a keep binds reads unreadable", async () => {
    const { mintKeepSeat, encodeKeepSeat, decodeKeepSeat } = await import("../src/keep-seat.js");
    const { seat } = await mintKeepSeat({ t: 1, pins: [{ kind: "passphrase", passphrase: "the steward's long words" }] }, nobleKdf);
    const raw = JSON.parse(encodeKeepSeat(seat)) as { slots: { slots: unknown[] } };
    expect(decodeKeepSeat(encodeKeepSeat(seat)).reading, "CONTROL: a real seat reads").toBe("readable");
    const crowded = { ...raw, slots: { ...raw.slots, slots: Array.from({ length: 9 }, () => raw.slots.slots[0]) } };
    expect(decodeKeepSeat(JSON.stringify(crowded)).reading).toBe("unreadable");
  });
});
