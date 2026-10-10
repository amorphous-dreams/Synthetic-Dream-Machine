/**
 * keyslot.test — the VK rests only inside slots, each an `sss{t, pins}` over human routes; a slot opens only under
 * pins that unwrap, a paper pin binds only after its sheet reads back, and an unbind always offers the rotation.
 */
import { describe, test, expect } from "vitest";
import {
  bindSlot, unbindSlot, openVk, encodeSlotTree, decodeSlotTree, draftPaperPin, confirmPaperPin, confirmHeldPaper,
  VK_ROTATION_OFFER, type SlotTree, type PinSpec,
} from "../src/keyslot.js";
import { mintVk, vkEquals } from "../src/vk.js";

const right = { kind: "passphrase", passphrase: "correct horse battery staple" } as const;
const wrong = { kind: "passphrase", passphrase: "correct horse battery stapler" } as const;

function confirmedPaper(threshold = 1, count = 1) {
  const draft = draftPaperPin({ threshold, count });
  return { draft, confirmed: confirmPaperPin(draft, draft.sheets) };
}

describe("open", () => {
  test("CONTROL: a two-slot tree opens under either slot, and both yield the one VK", () => {
    const vk = mintVk();
    const { draft, confirmed } = confirmedPaper();
    let tree = bindSlot(null, vk, { t: 1, pins: [right] });
    tree = bindSlot(tree, vk, { t: 1, pins: [{ kind: "paper", confirmed }] });
    expect(tree.slots.length).toBe(2);

    const byPass = openVk(tree, [right]);
    const byPaper = openVk(tree, [{ kind: "paper", sheets: draft.sheets }]);
    expect(byPass.reading).toBe("opens");
    expect(byPaper.reading).toBe("opens");
    expect(byPass.reading === "opens" && vkEquals(byPass.vk, vk)).toBe(true);
    expect(byPaper.reading === "opens" && vkEquals(byPaper.vk, vk)).toBe(true);
    expect(byPass.reading === "opens" && byPaper.reading === "opens" && byPass.slot !== byPaper.slot).toBe(true);
  });

  test("a wrong passphrase opens no slot, and the reading names no torn tree", () => {
    const tree = bindSlot(null, mintVk(), { t: 1, pins: [right] });
    expect(openVk(tree, [wrong]).reading).toBe("no-slot-opens");
    expect(openVk(tree, []).reading).toBe("no-slot-opens");
  });

  test("a 2-of-2 slot (passphrase and paper) opens with both pins and refuses either alone", () => {
    const vk = mintVk();
    const { draft, confirmed } = confirmedPaper();
    const tree = bindSlot(null, vk, { t: 2, pins: [right, { kind: "paper", confirmed }] });
    const paper = { kind: "paper", sheets: draft.sheets } as const;
    const both = openVk(tree, [right, paper]);
    expect(both.reading === "opens" && vkEquals(both.vk, vk)).toBe(true);
    expect(openVk(tree, [right]).reading).toBe("no-slot-opens");
    expect(openVk(tree, [paper]).reading).toBe("no-slot-opens");
  });

  test("a 2-of-3 paper pin opens from any two sheets read back", () => {
    const vk = mintVk();
    const { draft, confirmed } = confirmedPaper(2, 3);
    const tree = bindSlot(null, vk, { t: 1, pins: [{ kind: "paper", confirmed }] });
    const o = openVk(tree, [{ kind: "paper", sheets: [draft.sheets[0]!, draft.sheets[2]!] }]);
    expect(o.reading === "opens" && vkEquals(o.vk, vk)).toBe(true);
  });

  test("a mis-copied paper word opens nothing and the note names the sheet refusal", () => {
    const { draft, confirmed } = confirmedPaper();
    const tree = bindSlot(null, mintVk(), { t: 1, pins: [{ kind: "paper", confirmed }] });
    const words = draft.sheets[0]!.split(" ");
    words[6] = words[6] === "academic" ? "acid" : "academic";
    const o = openVk(tree, [{ kind: "paper", sheets: [words.join(" ")] }]);
    expect(o.reading).toBe("no-slot-opens");
    expect(o.reading === "no-slot-opens" && o.notes.some((n) => /checksum/.test(n))).toBe(true);
  });
});

describe("the tree at rest", () => {
  test("encode → decode round-trips, and the record carries no version, counter or clock field", () => {
    const vk = mintVk();
    const tree = bindSlot(null, vk, { t: 1, pins: [right] });
    const bytes = encodeSlotTree(tree);
    const back = decodeSlotTree(bytes);
    expect(back.reading).toBe("readable");
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { slots: Record<string, unknown>[] };
    expect(Object.keys(json)).toEqual(["slots"]);
    expect(Object.keys(json.slots[0]!).sort()).toEqual(["id", "nonce", "pins", "t", "wrappedVk"]);
    expect(Object.keys((json.slots[0]!.pins as Record<string, unknown>[])[0]!).sort()).toEqual(["kind", "nonce", "salt", "wrapped"]);
    expect(new TextDecoder().decode(bytes)).not.toMatch(/"v"|version|created|seq|\d{4}-\d{2}-\d{2}T/);
    const o = openVk((back as { tree: SlotTree }).tree, [right]);
    expect(o.reading === "opens" && vkEquals(o.vk, vk)).toBe(true);
  });

  test("a torn tree reads unreadable, never a wrong passphrase; nothing standing reads absent", () => {
    const bytes = encodeSlotTree(bindSlot(null, mintVk(), { t: 1, pins: [right] }));
    expect(decodeSlotTree(bytes.subarray(0, bytes.length - 9)).reading).toBe("unreadable");
    expect(decodeSlotTree(null).reading).toBe("absent");
  });

  test("RED: a stored pin of a kind this build does not build (`tpm`) reads unreadable, naming the kind", () => {
    const bytes = encodeSlotTree(bindSlot(null, mintVk(), { t: 1, pins: [right] }));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { slots: { pins: { kind: string }[] }[] };
    json.slots[0]!.pins[0]!.kind = "tpm";
    const r = decodeSlotTree(new TextEncoder().encode(JSON.stringify(json)));
    expect(r.reading).toBe("unreadable");
    expect(r.reading === "unreadable" && r.why).toMatch(/tpm/);
  });
});

describe("bind", () => {
  test("RED: a slot with no human route refuses to bind — no pins, a threshold above the pins, a threshold below one", () => {
    const vk = mintVk();
    expect(() => bindSlot(null, vk, { t: 1, pins: [] })).toThrow(/human route/);
    expect(() => bindSlot(null, vk, { t: 2, pins: [right] })).toThrow(/threshold/);
    expect(() => bindSlot(null, vk, { t: 0, pins: [right] })).toThrow(/threshold/);
  });

  test("RED: a pin kind outside the built union (`ember`, `tpm`) refuses to bind", () => {
    const vk = mintVk();
    for (const kind of ["ember", "tpm"]) {
      expect(() => bindSlot(null, vk, { t: 1, pins: [{ kind } as unknown as PinSpec] })).toThrow(new RegExp(kind));
    }
  });

  test("an empty passphrase refuses to bind", () => {
    expect(() => bindSlot(null, mintVk(), { t: 1, pins: [{ kind: "passphrase", passphrase: "" }] })).toThrow(/passphrase/);
  });

  test("RED: a paper sheet that does not read back refuses, naming the first departing word", () => {
    const draft = draftPaperPin({ threshold: 1, count: 1 });
    const words = draft.sheets[0]!.split(" ");
    const typed = [...words];
    typed[11] = typed[11] === "academic" ? "acid" : "academic";
    expect(() => confirmPaperPin(draft, [typed.join(" ")])).toThrow(/sheet 1, word 12/);
    expect(() => confirmPaperPin(draft, [])).toThrow(/every sheet/);
  });

  test("RED: a paper pin that never passed read-back refuses to bind", () => {
    const forged = { kind: "paper", confirmed: {} } as unknown as PinSpec;
    expect(() => bindSlot(null, mintVk(), { t: 1, pins: [forged] })).toThrow(/reads back/);
  });

  test("held sheets typed back seat a paper pin (a rotation keeps the operator's sheet)", () => {
    const vk = mintVk();
    const { draft } = confirmedPaper();
    const tree = bindSlot(null, vk, { t: 1, pins: [{ kind: "paper", confirmed: confirmHeldPaper(draft.sheets) }] });
    const o = openVk(tree, [{ kind: "paper", sheets: draft.sheets }]);
    expect(o.reading === "opens" && vkEquals(o.vk, vk)).toBe(true);
    expect(() => confirmHeldPaper(["not a sheet"])).toThrow(/slip39/);
  });
});

describe("unbind", () => {
  test("RED: every unbind returns the VK-rotation offer", () => {
    const vk = mintVk();
    let tree = bindSlot(null, vk, { t: 1, pins: [right] });
    tree = bindSlot(tree, vk, { t: 1, pins: [right] });
    tree = bindSlot(tree, vk, { t: 1, pins: [right] });
    const first = unbindSlot(tree, tree.slots[0]!.id);
    const second = unbindSlot(first.tree, first.tree.slots[0]!.id);
    expect(first.rotationOffer).toBe(VK_ROTATION_OFFER);
    expect(second.rotationOffer).toBe(VK_ROTATION_OFFER);
    expect(VK_ROTATION_OFFER).toMatch(/Rotate the VK/);
    expect(second.tree.slots.length).toBe(1);
  });

  test("the last slot refuses to unbind (the VK would keep no human route); an unknown slot refuses", () => {
    const tree = bindSlot(null, mintVk(), { t: 1, pins: [right] });
    expect(() => unbindSlot(tree, tree.slots[0]!.id)).toThrow(/human route/);
    expect(() => unbindSlot(tree, "00".repeat(16))).toThrow(/no slot/);
  });
});
