/**
 * keyslot.test — the tree key rests only inside slots, each an `sss{t, pins}` over human routes; a slot opens only under
 * pins that unwrap, a paper pin binds only after its sheet reads back, and an unbind always offers the rotation.
 */
import { describe, test, expect, vi } from "vitest";

// The room each case takes, stated where the file loads: every bind and every open of a passphrase pin derives a key
// by scrypt, and a case here derives several. The work stays fixed; only the machine's share of a core varies, so the
// room names the derivations and no case waits on a clock.
vi.setConfig({ testTimeout: 60_000 });
import {
  bindSlot, unbindSlot, openTreeKey, encodeSlotTree, decodeSlotTree, draftPaperPin, confirmPaperPin, confirmHeldPaper,
  ROTATION_OFFER, type SlotTree, type PinSpec,
} from "../src/keyslot.js";
import { mintTreeKey, treeKeyEquals, type TreeKey } from "../src/tree-key.js";
import { nativeKdf } from "../src/node.js";
import {
  commitSlotTree, writeSealedCarrier, openSealedCarrier, rotateTreeKey, OccupiedStoreRefusal, CustodyRefusal,
  type CustodyIo, type SealedCarrier,
} from "../src/sealed-writer.js";

const right = { kind: "passphrase", passphrase: "correct horse battery staple" } as const;
const wrong = { kind: "passphrase", passphrase: "correct horse battery stapler" } as const;

function confirmedPaper(threshold = 1, count = 1) {
  const draft = draftPaperPin({ threshold, count });
  return { draft, confirmed: confirmPaperPin(draft, draft.sheets) };
}

describe("open", () => {
  test("CONTROL: a two-slot tree opens under either slot, and both yield the one tree key", async () => {
    const treeKey = mintTreeKey();
    const { draft, confirmed } = confirmedPaper();
    let tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    tree = await bindSlot(tree, treeKey, { t: 1, pins: [{ kind: "paper", confirmed }] }, nativeKdf);
    expect(tree.slots.length).toBe(2);

    const byPass = await openTreeKey(tree, [right], nativeKdf);
    const byPaper = await openTreeKey(tree, [{ kind: "paper", sheets: draft.sheets }], nativeKdf);
    expect(byPass.reading).toBe("opens");
    expect(byPaper.reading).toBe("opens");
    expect(byPass.reading === "opens" && treeKeyEquals(byPass.treeKey, treeKey)).toBe(true);
    expect(byPaper.reading === "opens" && treeKeyEquals(byPaper.treeKey, treeKey)).toBe(true);
    expect(byPass.reading === "opens" && byPaper.reading === "opens" && byPass.slot !== byPaper.slot).toBe(true);
  });

  test("a wrong passphrase opens no slot, and the reading names no torn tree", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf);
    expect((await openTreeKey(tree, [wrong], nativeKdf)).reading).toBe("no-slot-opens");
    expect((await openTreeKey(tree, [], nativeKdf)).reading).toBe("no-slot-opens");
  });

  test("a 2-of-2 slot (passphrase and paper) opens with both pins and refuses either alone", async () => {
    const treeKey = mintTreeKey();
    const { draft, confirmed } = confirmedPaper();
    const tree = await bindSlot(null, treeKey, { t: 2, pins: [right, { kind: "paper", confirmed }] }, nativeKdf);
    const paper = { kind: "paper", sheets: draft.sheets } as const;
    const both = await openTreeKey(tree, [right, paper], nativeKdf);
    expect(both.reading === "opens" && treeKeyEquals(both.treeKey, treeKey)).toBe(true);
    expect((await openTreeKey(tree, [right], nativeKdf)).reading).toBe("no-slot-opens");
    expect((await openTreeKey(tree, [paper], nativeKdf)).reading).toBe("no-slot-opens");
  });

  test("a 2-of-3 paper pin opens from any two sheets read back", async () => {
    const treeKey = mintTreeKey();
    const { draft, confirmed } = confirmedPaper(2, 3);
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "paper", confirmed }] }, nativeKdf);
    const o = await openTreeKey(tree, [{ kind: "paper", sheets: [draft.sheets[0]!, draft.sheets[2]!] }], nativeKdf);
    expect(o.reading === "opens" && treeKeyEquals(o.treeKey, treeKey)).toBe(true);
  });

  test("a mis-copied paper word opens nothing and the note names the sheet refusal", async () => {
    const { draft, confirmed } = confirmedPaper();
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [{ kind: "paper", confirmed }] }, nativeKdf);
    const words = draft.sheets[0]!.split(" ");
    words[6] = words[6] === "academic" ? "acid" : "academic";
    const o = await openTreeKey(tree, [{ kind: "paper", sheets: [words.join(" ")] }], nativeKdf);
    expect(o.reading).toBe("no-slot-opens");
    expect(o.reading === "no-slot-opens" && o.notes.some((n) => /a paper credential reads no secret: its sheets fail their own check/.test(n))).toBe(true);
    // The note names the fault and quotes no word of the sheet: it reads the same, byte for byte, over an unrelated
    // sheet that fails the same way, so nothing in it varies with what a person typed. (A word hunt over the note would
    // misread: the note's own fixed words, "secret" among them, sit in the paper wordlist.)
    const other = confirmedPaper().draft.sheets[0]!.split(" ");
    expect(other.join(" ")).not.toBe(draft.sheets[0]);
    other[6] = other[6] === "academic" ? "acid" : "academic";
    const o2 = await openTreeKey(tree, [{ kind: "paper", sheets: [other.join(" ")] }], nativeKdf);
    const notesOf = (r: typeof o) => (r.reading === "no-slot-opens" ? r.notes : null);
    expect(notesOf(o)).toHaveLength(1);
    expect(notesOf(o2)).toEqual(notesOf(o));
    // CONTROL: the same comparison catches a note that quotes its sheet.
    const quoting = (sheet: string[]) => [`${notesOf(o)![0]} (${sheet.slice(8).join(" ")})`];
    expect(quoting(other)).not.toEqual(quoting(words));
  });
});

describe("the tree at rest", () => {
  test("encode → decode round-trips, and the record carries no version, counter or clock field", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    const bytes = encodeSlotTree(tree);
    const back = decodeSlotTree(bytes);
    expect(back.reading).toBe("readable");
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { slots: Record<string, unknown>[] };
    expect(Object.keys(json)).toEqual(["keyCheck", "slots"]);
    expect(Object.keys(json.slots[0]!).sort()).toEqual(["id", "nonce", "pins", "t", "wrappedKey"]);
    expect(Object.keys((json.slots[0]!.pins as Record<string, unknown>[])[0]!).sort()).toEqual(["kind", "nonce", "salt", "wrapped"]);
    expect(new TextDecoder().decode(bytes)).not.toMatch(/"v"|version|created|seq|\d{4}-\d{2}-\d{2}T/);
    const o = await openTreeKey((back as { tree: SlotTree }).tree, [right], nativeKdf);
    expect(o.reading === "opens" && treeKeyEquals(o.treeKey, treeKey)).toBe(true);
  });

  test("a torn tree reads unreadable, never a wrong passphrase; nothing standing reads absent", async () => {
    const bytes = encodeSlotTree(await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf));
    expect(decodeSlotTree(bytes.subarray(0, bytes.length - 9)).reading).toBe("unreadable");
    expect(decodeSlotTree(null).reading).toBe("absent");
  });

  test("RED: a stored pin of a kind this build does not build (`tpm`) reads unreadable, naming the kind", async () => {
    const bytes = encodeSlotTree(await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as { slots: { pins: { kind: string }[] }[] };
    json.slots[0]!.pins[0]!.kind = "tpm";
    const r = decodeSlotTree(new TextEncoder().encode(JSON.stringify(json)));
    expect(r.reading).toBe("unreadable");
    expect(r.reading === "unreadable" && r.why).toMatch(/tpm/);
  });
});

describe("bind", () => {
  test("RED: a slot with no human route refuses to bind — no pins, a threshold above the pins, a threshold below one", async () => {
    const treeKey = mintTreeKey();
    await expect(bindSlot(null, treeKey, { t: 1, pins: [] }, nativeKdf)).rejects.toThrow(/human route/);
    await expect(bindSlot(null, treeKey, { t: 2, pins: [right] }, nativeKdf)).rejects.toThrow(/threshold/);
    await expect(bindSlot(null, treeKey, { t: 0, pins: [right] }, nativeKdf)).rejects.toThrow(/threshold/);
  });

  test("RED: a pin kind outside the built union (`ember`, `tpm`) refuses to bind", async () => {
    const treeKey = mintTreeKey();
    for (const kind of ["ember", "tpm"]) {
      await expect(bindSlot(null, treeKey, { t: 1, pins: [{ kind } as unknown as PinSpec] }, nativeKdf)).rejects.toThrow(new RegExp(kind));
    }
  });

  test("an empty passphrase refuses to bind", async () => {
    await expect(bindSlot(null, mintTreeKey(), { t: 1, pins: [{ kind: "passphrase", passphrase: "" }] }, nativeKdf)).rejects.toThrow(/passphrase/);
  });

  test("RED: a paper sheet that does not read back refuses, naming the first departing word's position", () => {
    const draft = draftPaperPin({ threshold: 1, count: 1 });
    const words = draft.sheets[0]!.split(" ");
    const typed = [...words];
    typed[11] = typed[11] === "academic" ? "acid" : "academic";
    expect(() => confirmPaperPin(draft, [typed.join(" ")])).toThrow(/sheet 1, word 12/);
    expect(() => confirmPaperPin(draft, [])).toThrow(/every sheet/);
  });

  test("RED: a paper pin that never passed read-back refuses to bind", async () => {
    const forged = { kind: "paper", confirmed: {} } as unknown as PinSpec;
    await expect(bindSlot(null, mintTreeKey(), { t: 1, pins: [forged] }, nativeKdf)).rejects.toThrow(/reads back/);
  });

  test("held sheets typed back seat a paper pin (a rotation keeps the operator's sheet)", async () => {
    const treeKey = mintTreeKey();
    const { draft } = confirmedPaper();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [{ kind: "paper", confirmed: confirmHeldPaper(draft.sheets) }] }, nativeKdf);
    const o = await openTreeKey(tree, [{ kind: "paper", sheets: draft.sheets }], nativeKdf);
    expect(o.reading === "opens" && treeKeyEquals(o.treeKey, treeKey)).toBe(true);
    expect(() => confirmHeldPaper(["not a sheet"])).toThrow(/slip39/);
  });
});

describe("unbind", () => {
  test("RED: every unbind returns the tree key-rotation offer", async () => {
    const treeKey = mintTreeKey();
    let tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    tree = await bindSlot(tree, treeKey, { t: 1, pins: [right] }, nativeKdf);
    tree = await bindSlot(tree, treeKey, { t: 1, pins: [right] }, nativeKdf);
    const first = unbindSlot(tree, tree.slots[0]!.id);
    const second = unbindSlot(first.tree, first.tree.slots[0]!.id);
    expect(first.rotationOffer).toBe(ROTATION_OFFER);
    expect(second.rotationOffer).toBe(ROTATION_OFFER);
    expect(ROTATION_OFFER).toMatch(/Rotate the key/);
    expect(second.tree.slots.length).toBe(1);
  });

  test("the last slot refuses to unbind (the tree key would keep no human route); an unknown slot refuses", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf);
    expect(() => unbindSlot(tree, tree.slots[0]!.id)).toThrow(/human route/);
    expect(() => unbindSlot(tree, "00".repeat(16))).toThrow(/no slot/);
  });
});

/** A test that runs several scrypt derivations (~0.5 s each) needs room under a full parallel suite. */
const SCRYPT_HEAVY = 30_000;

describe("the tree commits to its tree key — a keyed check that reveals nothing", () => {
  const checkOf = (tree: SlotTree): string => (tree as SlotTree & { keyCheck: string }).keyCheck;

  test("the tree carries a 32-byte keyed check of its tree key: stable for one tree key, apart across TreeKeys, never the tree key itself", async () => {
    const treeKey = mintTreeKey();
    const a = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    const b = await bindSlot(null, treeKey, { t: 1, pins: [wrong] }, nativeKdf);
    const other = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf);
    expect(checkOf(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(checkOf(b)).toBe(checkOf(a));
    expect(checkOf(other)).not.toBe(checkOf(a));
    expect(checkOf(a)).not.toBe(Buffer.from(treeKey).toString("hex"));
    const back = decodeSlotTree(encodeSlotTree(a));
    expect(back.reading === "readable" && checkOf(back.tree)).toBe(checkOf(a));
  }, SCRYPT_HEAVY);

  test("RED: binding a slot over a tree key the tree does not commit to refuses, naming the mismatch", async () => {
    const tree = await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf);
    await expect(bindSlot(tree, mintTreeKey(), { t: 1, pins: [wrong] }, nativeKdf)).rejects.toThrow(/commit/);
  });

  test("RED: a slot spliced in from another tree opens no tree key, and the note names the commitment", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    const foreign = await bindSlot(null, mintTreeKey(), { t: 1, pins: [wrong] }, nativeKdf);
    const spliced = { ...tree, slots: [...tree.slots, foreign.slots[0]!] } as SlotTree;
    const o = await openTreeKey(spliced, [wrong], nativeKdf);
    expect(o.reading).toBe("no-slot-opens");
    expect(o.reading === "no-slot-opens" && o.notes.some((n) => /commit/.test(n))).toBe(true);
    const ok = await openTreeKey(spliced, [right], nativeKdf);
    expect(ok.reading === "opens" && treeKeyEquals(ok.treeKey, treeKey)).toBe(true);
  }, SCRYPT_HEAVY);

  test("RED: a tree at rest with no check, or a malformed one, reads unreadable", async () => {
    const bytes = encodeSlotTree(await bindSlot(null, mintTreeKey(), { t: 1, pins: [right] }, nativeKdf));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    delete json.keyCheck;
    expect(decodeSlotTree(new TextEncoder().encode(JSON.stringify(json))).reading).toBe("unreadable");
    json.keyCheck = "zz";
    expect(decodeSlotTree(new TextEncoder().encode(JSON.stringify(json))).reading).toBe("unreadable");
  });
});

describe("one slot binds each human route once", () => {
  test("RED: a 2-of-2 slot refuses the same passphrase twice, NFKC-equal spellings included", async () => {
    const treeKey = mintTreeKey();
    await expect(bindSlot(null, treeKey, { t: 2, pins: [right, right] }, nativeKdf)).rejects.toThrow(/twice/);
    const composed = { kind: "passphrase", passphrase: "café hearth" } as const;
    const decomposed = { kind: "passphrase", passphrase: "café hearth" } as const;
    await expect(bindSlot(null, treeKey, { t: 2, pins: [composed, decomposed] }, nativeKdf)).rejects.toThrow(/twice/);
  });

  test("RED: a slot refuses one paper secret bound as two pins", async () => {
    const { confirmed } = confirmedPaper();
    await expect(bindSlot(null, mintTreeKey(), { t: 2, pins: [{ kind: "paper", confirmed }, { kind: "paper", confirmed }] }, nativeKdf)).rejects.toThrow(/twice/);
  });

  test("CONTROL: two distinct passphrases bind a 2-of-2 slot, and one passphrase in two slots stands", async () => {
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 2, pins: [right, wrong] }, nativeKdf);
    const o = await openTreeKey(tree, [right, wrong], nativeKdf);
    expect(o.reading === "opens" && treeKeyEquals(o.treeKey, treeKey)).toBe(true);
    expect((await bindSlot(tree, treeKey, { t: 1, pins: [right] }, nativeKdf)).slots.length).toBe(2);
  }, SCRYPT_HEAVY);
});

describe("the paper read-back refusal names a position, never a word", () => {
  test("RED: the refusal echoes no word of the printed sheet and no typed word", () => {
    for (let trial = 0; trial < 8; trial++) {
      const draft = draftPaperPin({ threshold: 1, count: 1 });
      const words = draft.sheets[0]!.split(" ");
      const typed = [...words];
      typed[7] = words[7] === "academic" ? "acid" : "academic";
      let msg = "";
      try { confirmPaperPin(draft, [typed.join(" ")]); } catch (e) { msg = (e as Error).message; }
      expect(msg).toMatch(/sheet 1, word 8/);
      for (const w of new Set([...words, typed[7]!])) expect(msg).not.toMatch(new RegExp(`\\b${w}\\b`));
    }
  });
});

// ── THE RELATION CLASS AND THE OLD-SHAPE REFUSAL (P3 mesh custody contract) ──────────────────────────────────

/** A scratch store that records every mutating call; nothing here touches a real home. */
class ScratchIo implements CustodyIo {
  readonly files = new Map<string, Uint8Array>();
  readonly mutations: string[] = [];
  async read(path: string) { const b = this.files.get(path); return b === undefined ? null : Uint8Array.from(b); }
  async write(path: string, bytes: Uint8Array) { this.mutations.push(`write ${path}`); this.files.set(path, Uint8Array.from(bytes)); }
  async rename(from: string, to: string) {
    this.mutations.push(`rename ${from}`);
    this.files.set(to, this.files.get(from)!); this.files.delete(from);
  }
  async remove(path: string) { this.mutations.push(`remove ${path}`); this.files.delete(path); }
  async list() { return [...this.files.keys()]; }
  private chain: Promise<unknown> = Promise.resolve();
  exclusive<T>(fn: () => Promise<T>): Promise<T> { const r = this.chain.then(fn, fn); this.chain = r.catch(() => undefined); return r; }
}

const TREE = "/scratch/s-slots.bin";
const KEYRING: SealedCarrier = { name: "keyring", path: "/scratch/keyring.bin", keyClass: "relation" };
const ROOT: SealedCarrier = { name: "custody-root", path: "/scratch/custody-root.bin", keyClass: "device-minted" };
const text = (s: string) => new TextEncoder().encode(s);

describe("an occupied store refuses BEFORE any write", () => {
  test("RED: founding the tree over a CLEARTEXT root refuses by name, and the store sees no mutation", async () => {
    const io = new ScratchIo();
    io.files.set(ROOT.path, text("a cleartext custody root, as the old build kept it"));
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    const err = await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree, carriers: [ROOT, KEYRING] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect((err as OccupiedStoreRefusal).standing).toEqual([{ carrier: ROOT, reading: "bare" }]);
    expect(io.mutations).toEqual([]);
    expect(io.files.has(TREE)).toBe(false);
    expect(new TextDecoder().decode(io.files.get(ROOT.path)!)).toMatch(/cleartext custody root/);
  });

  test("RED: a sealed file no listed carrier names refuses the founding too (the census law)", async () => {
    const io = new ScratchIo();
    const old = mintTreeKey();
    const oldTree = await bindSlot(null, old, { t: 1, pins: [right] }, nativeKdf);
    await commitSlotTree({ io, path: "/other/tree.bin", expected: null, treeKey: old, tree: oldTree, carriers: [] });
    await writeSealedCarrier({ io, treeKey: old, treePath: "/other/tree.bin", carrier: { name: "stray", path: "/scratch/stray.bin" }, plaintext: text("x") });
    io.files.delete("/other/tree.bin");
    io.mutations.length = 0;
    const treeKey = mintTreeKey();
    const err = await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf), carriers: [ROOT] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect((err as OccupiedStoreRefusal).unlisted).toEqual(["/scratch/stray.bin"]);
    expect(io.mutations).toEqual([]);
  });

  // LARK-led bytes carry no reading of their own: they read bare, as any file that is not this house's frame does.
  const LARK = Uint8Array.from([0x4c, 0x41, 0x52, 0x4b, 1, 2, 3, 4, 5, 6, 7, 8]);

  test("RED: LARK-led bytes at a listed carrier read bare, refuse the founding, and the store sees no mutation", async () => {
    const io = new ScratchIo();
    io.files.set(ROOT.path, LARK);
    const treeKey = mintTreeKey();
    const err = await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf), carriers: [ROOT, KEYRING] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect((err as OccupiedStoreRefusal).standing).toEqual([{ carrier: ROOT, reading: "bare" }]);
    expect(io.mutations).toEqual([]);
    expect(Buffer.from(io.files.get(ROOT.path)!).equals(Buffer.from(LARK))).toBe(true);
  });

  test("LAW: a bare file at a path no listed carrier names does not block a founding; only a file bearing the seal's magic does", async () => {
    const io = new ScratchIo();
    io.files.set("/scratch/foreign.bin", LARK);
    io.files.set("/scratch/notes.txt", text("not custody's"));
    const treeKey = mintTreeKey();
    await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf), carriers: [ROOT, KEYRING] });
    expect(io.files.has(TREE)).toBe(true);
    expect(Buffer.from(io.files.get("/scratch/foreign.bin")!).equals(Buffer.from(LARK))).toBe(true);
  }, 30_000);

  test("CONTROL: a clean store founds, and a founded tree commits a bind with carriers standing (not a founding)", async () => {
    const io = new ScratchIo();
    const treeKey = mintTreeKey();
    const tree = await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf);
    await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree, carriers: [ROOT, KEYRING] });
    expect(io.files.has(TREE)).toBe(true);
    await writeSealedCarrier({ io, treeKey, treePath: TREE, carrier: KEYRING, plaintext: text("k1") });
    const grown = await bindSlot(tree, treeKey, { t: 1, pins: [wrong] }, nativeKdf);
    await commitSlotTree({ io, path: TREE, expected: await io.read(TREE), treeKey, tree: grown, carriers: [ROOT, KEYRING] });
    expect(decodeSlotTree(await io.read(TREE)).reading).toBe("readable");
  }, 30_000);

  test("RED: a write to a carrier with NO tree standing refuses before any byte, naming the occupant when cleartext stands", async () => {
    const io = new ScratchIo();
    io.files.set(KEYRING.path, text("{\"cleartext\":true}"));
    const err = await writeSealedCarrier({ io, treeKey: mintTreeKey(), treePath: TREE, carrier: KEYRING, plaintext: text("x") }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OccupiedStoreRefusal);
    expect(io.mutations).toEqual([]);
    expect(new TextDecoder().decode(io.files.get(KEYRING.path)!)).toBe('{"cleartext":true}');
  });
});

describe("the relation class rides the sealed writer", () => {
  async function foundedWithKeyring(): Promise<{ io: ScratchIo; treeKey: TreeKey }> {
    const io = new ScratchIo();
    const treeKey = mintTreeKey();
    await commitSlotTree({ io, path: TREE, expected: null, treeKey, tree: await bindSlot(null, treeKey, { t: 1, pins: [right] }, nativeKdf), carriers: [ROOT, KEYRING] });
    await writeSealedCarrier({ io, treeKey, treePath: TREE, carrier: KEYRING, plaintext: text("convergence-secret-epoch-3") });
    await writeSealedCarrier({ io, treeKey, treePath: TREE, carrier: ROOT, plaintext: text("root") });
    io.mutations.length = 0;
    return { io, treeKey };
  }

  test("a rotation re-seals a relation carrier byte-identical: re-sealed, never regenerated", async () => {
    const { io, treeKey } = await foundedWithKeyring();
    const before = await openSealedCarrier({ io, treeKey, carrier: KEYRING });
    const newTreeKey = mintTreeKey();
    await rotateTreeKey({ io, treePath: TREE, carriers: [ROOT, KEYRING], oldTreeKey: treeKey, newTreeKey, slots: [{ t: 1, pins: [right] }], kdf: nativeKdf });
    const after = await openSealedCarrier({ io, treeKey: newTreeKey, carrier: KEYRING });
    expect(before.reading === "opens" && after.reading === "opens" && new TextDecoder().decode(after.plaintext)).toBe("convergence-secret-epoch-3");
    expect((await openSealedCarrier({ io, treeKey, carrier: KEYRING })).reading).toBe("key-fails");
  }, 30_000);

  test("RED: a rotation that cannot open a RELATION carrier refuses with nothing written, and says only the party re-issues it", async () => {
    const { io, treeKey } = await foundedWithKeyring();
    // damage the keyring: flip a ciphertext byte so the tree key in hand no longer opens it
    const bytes = Uint8Array.from(io.files.get(KEYRING.path)!); bytes[bytes.length - 1] ^= 0xff; io.files.set(KEYRING.path, bytes);
    io.mutations.length = 0;
    const err = await rotateTreeKey({ io, treePath: TREE, carriers: [ROOT, KEYRING], oldTreeKey: treeKey, newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [right] }], kdf: nativeKdf })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CustodyRefusal);
    expect((err as CustodyRefusal).message).toMatch(/re-issue/);
    expect(io.mutations).toEqual([]);
  }, 30_000);

  test("CONTROL: the same damage on a NON-relation carrier refuses without the re-issue sentence", async () => {
    const { io, treeKey } = await foundedWithKeyring();
    const bytes = Uint8Array.from(io.files.get(ROOT.path)!); bytes[bytes.length - 1] ^= 0xff; io.files.set(ROOT.path, bytes);
    const err = await rotateTreeKey({ io, treePath: TREE, carriers: [ROOT, KEYRING], oldTreeKey: treeKey, newTreeKey: mintTreeKey(), slots: [{ t: 1, pins: [right] }], kdf: nativeKdf })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CustodyRefusal);
    expect((err as CustodyRefusal).message).not.toMatch(/re-issue/);
  }, 30_000);
});
