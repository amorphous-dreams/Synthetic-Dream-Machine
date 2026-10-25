/**
 * handle-owner-anchor (node) — K15-H: `lares handle publish|burn|rotate` take the owner Persona KEL prefix and the head op-key
 * from the SELECTED face's sealed anchor through `readFaceOwner`, never from the daemon doc's mutable prefix tiddler.
 *
 * THE HOLE (measured on the head before this lane): the adapters read `PERSONA_KEL_PREFIX_TIDDLER` off the daemon doc, which
 * names the founding face and which a document change can move, so a verb that selected persona h1 signed under h0's prefix
 * (or under any prefix the doc named). The control: the honest path returns h1's own prefix and head, and each broken row
 * (another face's chain, no anchor, no chain) refuses by name.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as ed from "@noble/ed25519";
import { hex, mintFaceAnchor, mintPersonaInception, type PersonaKelEvent } from "@lararium/mesh";
import { readHandleOwnerOf } from "../src/commands/handle.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import { keepFaceAnchorOfGroup } from "../src/face-anchor-store.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 180_000 });

let seat: SeatedScratchCustody;
const faces: Array<{ did: string; chain: PersonaKelEvent[]; prefix: string }> = [];
async function standFace(handleIndex: number, byte: number, { anchor = true }: { anchor?: boolean } = {}): Promise<void> {
  const did = `0x${hex(await ed.getPublicKeyAsync(new Uint8Array(32).fill(byte)))}`;
  const inception = mintPersonaInception(did, `${byte.toString(16).padStart(2, "0")}`.repeat(32));
  faces[handleIndex] = { did, chain: [inception], prefix: inception.prefix };
  const group = `GROUP-OF-FACE-${handleIndex}`;
  await persistIdentityAnchors({ personaGroupId: group, meshCabalDocIdHex: "ab".repeat(32) }, handleIndex);
  if (anchor) await keepFaceAnchorOfGroup(mintFaceAnchor({ personaGroup: group, personaKelPrefix: inception.prefix, personaRootDid: did, edge: { handleIndex }, leaseEpoch: 0 }));
}
const boardOf = (...chains: PersonaKelEvent[][]) => async (prefix: string): Promise<PersonaKelEvent[] | null> => chains.find((c) => c[0]!.prefix === prefix) ?? null;

beforeEach(async () => { seat = await seatScratchCustody("handle-owner"); faces.length = 0; });
afterEach(async () => { await seat.drop(); });

describe("the node Handle owner rides the sealed anchor", () => {
  test("★ a verb that selects face 1 reads face 1's own prefix and head op-key, never face 0's ★", async () => {
    await standFace(0, 0x31); await standFace(1, 0x32);
    expect(faces[1]!.prefix).not.toBe(faces[0]!.prefix);
    const board = boardOf(faces[0]!.chain, faces[1]!.chain);
    const one = await readHandleOwnerOf(1, board, "publish");
    expect(one.personaKelPrefix).toBe(faces[1]!.prefix);
    expect(one.headOpKeyDid).toBe(faces[1]!.did);
    expect((await readHandleOwnerOf(0, board, "publish")).personaKelPrefix).toBe(faces[0]!.prefix);
  });

  test("★ CONTROLS: a chain under another prefix, no anchor row, no chain on the board, and an unanchored index each refuse ★", async () => {
    await standFace(0, 0x31); await standFace(1, 0x32); await standFace(2, 0x33, { anchor: false });
    // a board that answers face 1's prefix with face 0's chain
    await expect(readHandleOwnerOf(1, async () => faces[0]!.chain, "burn")).rejects.toThrow(/prefix/i);
    await expect(readHandleOwnerOf(2, boardOf(faces[2]!.chain), "rotate")).rejects.toThrow(/sealed anchor/i);
    await expect(readHandleOwnerOf(1, boardOf(faces[0]!.chain), "rotate")).rejects.toThrow(/absent from the local board|fail-closed/i);
    await expect(readHandleOwnerOf(7, boardOf(faces[0]!.chain, faces[1]!.chain), "publish")).rejects.toThrow(/sealed anchor/i);
  });
});
