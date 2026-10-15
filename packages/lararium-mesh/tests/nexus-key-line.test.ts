import { describe, expect, it } from "vitest";
import { getPublicKeyAsync, signAsync } from "@noble/ed25519";
import {
  NEXUS_KEY_HAND_OVER_DOMAIN, NEXUS_KEY_LINE_BOUND,
  followNexusKeyLine, nexusKeyHandOverBytes, nexusKeyHandOverId, nexusKeyHandOverKey,
  nexusKeyHandOversFromBoard, readNexusKeyHandOver, signNexusKeyHandOver, writeNexusKeyHandOver, admittedKeyOf,
} from "../src/nexus-key-line.js";
import { emptyLarDoc } from "../src/base-doc.js";
import { hex, sha256HexBytesSync } from "../src/crypto.js";

const seed = (n: number) => new Uint8Array(32).fill(n);
const pub = async (n: number) => hex(await getPublicKeyAsync(seed(n)));
const signer = (n: number) => async (bytes: Uint8Array) => hex(await signAsync(bytes, seed(n)));
const hand = async (from: number, to: number, nexus = "lar:///nexus/one") => signNexusKeyHandOver(
  { nexus, from: await pub(from), to: await pub(to) }, signer(from), signer(to),
);

// Deliberate name spelling in this suite keeps one vector per law.
describe("Nexus key line", () => {
  it("L1 signed hand-over reads back its semantic bytes and content id", async () => {
    const a = await hand(1, 2);
    const bytes = nexusKeyHandOverBytes(a);
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ kind: NEXUS_KEY_HAND_OVER_DOMAIN, nexus: a.nexus, from: a.from, to: a.to });
    expect(readNexusKeyHandOver(a)).toEqual(a);
    expect(nexusKeyHandOverId(a)).toBe(sha256HexBytesSync(bytes));
  });

  it("L2 signing refuses equal keys, malformed keys, and an empty Nexus", async () => {
    const key = await pub(1);
    await expect(signNexusKeyHandOver({ nexus: "n", from: key, to: key }, signer(1), signer(1))).rejects.toThrow("nexus-key-hand-over:");
    await expect(signNexusKeyHandOver({ nexus: "n", from: "bad", to: await pub(2) }, signer(1), signer(2))).rejects.toThrow("nexus-key-hand-over:");
    await expect(signNexusKeyHandOver({ nexus: "  ", from: key, to: await pub(2) }, signer(1), signer(2))).rejects.toThrow("nexus-key-hand-over:");
  });

  it("L3 read refuses extra or missing fields and invalid signatures or equal keys", async () => {
    const a = await hand(1, 2);
    expect(readNexusKeyHandOver({ ...a, extra: true })).toBeNull();
    const { toSig: _toSig, ...missing } = a;
    expect(readNexusKeyHandOver(missing)).toBeNull();
    expect(readNexusKeyHandOver({ ...a, fromSig: `00${a.fromSig.slice(2)}` })).toBeNull();
    const bytes = nexusKeyHandOverBytes(a);
    expect(readNexusKeyHandOver({ ...a, toSig: await signer(3)(bytes) })).toBeNull();
    const equal = { ...a, to: a.from, toSig: await signer(1)(nexusKeyHandOverBytes({ ...a, to: a.from })) };
    expect(readNexusKeyHandOver(equal)).toBeNull();
  });

  it("L4 changing to after signing changes the decoded bytes and refuses", async () => {
    const a = await hand(1, 2);
    const before = new TextDecoder().decode(nexusKeyHandOverBytes(a));
    const tampered = { ...a, to: await pub(3) };
    const after = new TextDecoder().decode(nexusKeyHandOverBytes(tampered));
    expect(after).not.toBe(before);
    expect(readNexusKeyHandOver(tampered)).toBeNull();
  });

  it("L5 an empty line keeps the admitted key as head", async () => {
    const admitted = await pub(1);
    expect(followNexusKeyLine({ nexus: "n", admitted, carried: [] })).toEqual({ head: admitted, keys: [admitted], handOvers: [] });
  });

  it("L6 walks two hand-overs independent of carried order", async () => {
    const ab = await hand(1, 2), bc = await hand(2, 3);
    const a = ab.from;
    const expected = { head: bc.to, keys: [a, ab.to, bc.to], handOvers: [ab, bc] };
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: a, carried: [ab, bc] })).toEqual(expected);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: a, carried: [bc, ab] })).toEqual(expected);
  });

  it("L7 refuses a fork at the root or deeper in the line", async () => {
    const ab = await hand(1, 2), ac = await hand(1, 3);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [ab, ac] })).toEqual({ refusal: "forked" });
    const bc = await hand(2, 3), bd = await hand(2, 4);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [ab, bc, bd] })).toEqual({ refusal: "forked" });
  });

  it("L8 refuses a loop", async () => {
    const ab = await hand(1, 2), ba = await hand(2, 1);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [ab, ba] })).toEqual({ refusal: "loops" });
  });

  it("L9 a record of another Nexus, and an unrelated face's line, touch the walk nowhere", async () => {
    const ab = await hand(1, 2), otherNexus = await hand(2, 3, "lar:///nexus/two");
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [ab, otherNexus] })).toEqual({ head: ab.to, keys: [ab.from, ab.to], handOvers: [ab] });
    const xy = await hand(4, 5);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [xy] })).toEqual({ head: ab.from, keys: [ab.from], handOvers: [] });
  });

  it("L10 a malformed or forged record drops and refuses nothing; a carried value that reads as no list refuses", async () => {
    const ab = await hand(1, 2);
    const { toSig: _toSig, ...missing } = ab;
    const forgedFork = { ...(await hand(1, 3)), fromSig: ab.fromSig };                    // names a.from, signed by nobody
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: ["bad", missing, forgedFork, ab] })).toEqual({ head: ab.to, keys: [ab.from, ab.to], handOvers: [ab] });
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: {} })).toEqual({ refusal: "carried-malformed" });
  });

  it("L10b A FLOOD DENIES NOBODY: thousands of records under other keys leave a face's line whole", async () => {
    const ab = await hand(1, 2);
    const junk = { ...ab, from: "aa".repeat(32), to: "bb".repeat(32) };                   // shaped like a record, signed by nobody
    const carried = [...new Array(10_000).fill(junk), ab];
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried })).toEqual({ head: ab.to, keys: [ab.from, ab.to], handOvers: [ab] });
    expect(admittedKeyOf({ nexus: ab.nexus, key: ab.to, carried })).toBe(ab.from);
    // Forged records that NAME the admitted key, each to its own stranger, fork nothing: none verifies.
    const forged = Array.from({ length: 200 }, (_, i) => ({ ...ab, to: (i + 0x10).toString(16).padStart(2, "0").repeat(32) }));
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried: [...forged, ab] })).toEqual({ head: ab.to, keys: [ab.from, ab.to], handOvers: [ab] });
  });

  it("L13 a line walks no further than its bound, while a board holds other faces' records past it", async () => {
    const links = [];
    for (let i = 1; i <= NEXUS_KEY_LINE_BOUND + 1; i++) links.push(await hand(i, i + 1));
    expect(followNexusKeyLine({ nexus: links[0]!.nexus, admitted: links[0]!.from, carried: links })).toEqual({ refusal: "line-over-bound" });
    // CONTROL: a short line reads whole beside many other faces' records on the same board.
    const ok = followNexusKeyLine({ nexus: links[0]!.nexus, admitted: links[0]!.from, carried: [...links.slice(0, 2), ...links.slice(10)] });
    expect(ok).toEqual({ head: links[1]!.to, keys: [links[0]!.from, links[0]!.to, links[1]!.to], handOvers: links.slice(0, 2) });
  });

  it("L14 a record whose nexus spells other than its canonical form reads as none", async () => {
    const ab = await hand(1, 2);
    const bytes = nexusKeyHandOverBytes({ nexus: " LAR:///Nexus/One", from: ab.from, to: ab.to });
    const odd = { ...ab, nexus: " LAR:///Nexus/One", fromSig: hex(await signAsync(bytes, seed(1))), toSig: hex(await signAsync(bytes, seed(2))) };
    expect(readNexusKeyHandOver(odd)).toBeNull();
  });

  it("L11 board round-trip filters Nexus and idempotently writes one tiddler", async () => {
    const ab = await hand(1, 2), bc = await hand(2, 3), foreign = await hand(4, 5, "lar:///nexus/two");
    const board = emptyLarDoc();
    writeNexusKeyHandOver(board, ab); writeNexusKeyHandOver(board, bc); writeNexusKeyHandOver(board, foreign);
    writeNexusKeyHandOver(board, ab);
    expect(nexusKeyHandOversFromBoard(board, ab.nexus)).toHaveLength(2);
    expect(nexusKeyHandOversFromBoard(board, "lar:///nexus/three")).toEqual([]);
    expect(Object.keys(board.tiddlers).filter((key) => key === nexusKeyHandOverKey(ab))).toHaveLength(1);
  });

  it("L12 verifies a complete line after writing and reading the board", async () => {
    const ab = await hand(1, 2), bc = await hand(2, 3);
    const board = emptyLarDoc();
    writeNexusKeyHandOver(board, ab); writeNexusKeyHandOver(board, bc);
    const carried = nexusKeyHandOversFromBoard(board, ab.nexus);
    expect(followNexusKeyLine({ nexus: ab.nexus, admitted: ab.from, carried })).toEqual({ head: bc.to, keys: [ab.from, ab.to, bc.to], handOvers: [ab, bc] });
  });

  it("L15 the backward walk finds the admitted key for the line's head, and for no key the line handed on", async () => {
    const ab = await hand(1, 2), bc = await hand(2, 3), xy = await hand(8, 9);
    const carried = [bc, xy, ab];
    expect(admittedKeyOf({ nexus: ab.nexus, key: bc.to, carried })).toBe(ab.from);
    expect(admittedKeyOf({ nexus: ab.nexus, key: ab.to, carried })).toBeNull();          // handed on to c
    expect(admittedKeyOf({ nexus: ab.nexus, key: await pub(20), carried })).toBe(await pub(20)); // no record names it
    expect(admittedKeyOf({ nexus: "lar:///nexus/two", key: bc.to, carried })).toBe(bc.to);       // another Nexus's line
    const forkBack = await hand(7, 3);
    expect(admittedKeyOf({ nexus: ab.nexus, key: bc.to, carried: [...carried, forkBack] })).toBeNull();
    const forkFore = await hand(1, 5);
    expect(admittedKeyOf({ nexus: ab.nexus, key: bc.to, carried: [...carried, forkFore] })).toBeNull();
  });
});
