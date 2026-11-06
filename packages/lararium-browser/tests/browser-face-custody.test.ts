/**
 * browser-face-custody — EACH FACE KEEPS ITS OWN FIRE: a face custody key (FCK) per PersonaGroup, wrapped in that face's own
 * slot tree, its rows sealed under it (browser-vessel-lift slice 3 part ii; k15-custody-step-zero#/row-census-browser).
 *
 *   FC1 RED (on the vessel worker's thread): found faces A and B with independent trees and occupied rows; unlock A alone;
 *       bypass every router and session: A's key opens no B row, a B read and a B write refuse `face-locked`, an occupied B
 *       row takes no replacement, A's ciphertext copied into B's place opens under neither, and every B byte stands
 *       unchanged. CONTROL: A reads its own rows, and B opens its own once B unlocks.
 *   FC2 RED: a face's first persistence refuses `no-custody-slot` until its slot tree binds; the root mint refuses
 *       `no-custody-slot` the same way. CONTROL: once bound, the row and the root land and read back; once locked, they
 *       refuse `face-locked`.
 *   FC3 RED: a clear names one face: a clear naming none refuses `face-absent`; a wrong route clears nothing; the confirm
 *       door parks the first ask. CONTROL: the confirmed clear removes A's tree and rows alone, B's bytes stand.
 *   FC4 RED: a face names a PersonaGroup, never `h<N>` (`face-names-a-handle`); the index routes and never decides: two
 *       faces' index entries swapped open a tree and refuse at the anchor (`face-index-mismatch`), seating nothing.
 *   FC5 RED: the leaf's ember row rests under its face's slot and answers signed asks only while that face stands unlocked
 *       (`face-locked`); an unsigned or forged ask refuses `ember-ask-unsigned`. CONTROL: the unlocked face answers.
 *
 * Ceremony and custody reds run on scratch stores with synthetic names and secrets.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { afterEach, describe, expect, test } from "vitest";
import * as ed25519 from "@noble/ed25519";
import { readyWorker } from "./fixtures/ready-worker.js";
import { browserKeystoreCustodyIo } from "../src/browser-custody.js";
import {
  FACE_INDEX_ROW, bindFirstFaceSlot, clearFaceCustody, faceCustodyHeld, faceCustodyKeysHeld, faceRowPath, lockFaceCustody,
  readFaceCustody, readFaceRow, unlockFaceCustody, writeFaceRow,
} from "../src/browser-face-custody.js";
import { answerEmberAsk, emberAskBytes, mintEmber } from "../src/browser-ember.js";

const SLOW = 240_000;
const PASS_A = { kind: "passphrase", passphrase: "face A keeps its own fire" } as const;
const PASS_B = { kind: "passphrase", passphrase: "face B keeps another fire" } as const;
const store = (tag: string): string => `face-custody-${tag}-${crypto.randomUUID()}`;
const face = (tag: string): string => `pg-${tag}-${crypto.randomUUID()}`;
const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const text = (b: Uint8Array | null): string | null => b === null ? null : new TextDecoder().decode(b);

const workers: Worker[] = [];
afterEach(() => { for (const w of workers.splice(0)) w.terminate(); });

describe("each face's rows rest under its own key", () => {
  test("FC1 RED on the vessel worker's thread: A unlocked opens no B row by any door; every B byte stands", async () => {
    const w = await readyWorker(new URL("./fixtures/face-custody.worker.ts", import.meta.url));
    workers.push(w);
    const out = await new Promise<Record<string, unknown>>((resolve) => {
      w.onmessage = (e) => { if ((e.data as { op?: string }).op === "isolation") resolve(e.data as Record<string, unknown>); };
      w.postMessage({ op: "isolation", idbName: store("isolation"), a: face("a"), b: face("b") });
    });
    expect(out["error"] ?? null).toBeNull();
    expect(out).toMatchObject({
      onWorker: true,
      heldAfterUnlockA: { a: true, b: false },
      controlReadA: "A's recipe",
      bReadRefusal: "face-locked",
      bWriteRefusal: "face-locked",
      aKeyOpensB: false,
      bOccupiedReplaceRefusal: "row-unopened",
      copiedIntoB: "row-unopened",
      bBytesUnchanged: true,
      controlReadBAfterUnlock: "B's ledger",
    });
  }, SLOW);

  test("FC2 RED a face's first persistence refuses no-custody-slot until its tree binds — CONTROL: bound they land; locked they refuse", async () => {
    const idbName = store("first"), a = face("a");
    expect(await readFaceCustody(idbName, a)).toEqual({ reading: "absent" });
    await expect(writeFaceRow(idbName, a, "outbox/1", bytes("too early"))).rejects.toMatchObject({ reading: "no-custody-slot" });
    const io = browserKeystoreCustodyIo(idbName);
    expect((await io.list()).filter((r) => r.startsWith("face-")), "a refusal writes nothing").toEqual([]);

    await bindFirstFaceSlot(idbName, a, PASS_A);
    expect(await readFaceCustody(idbName, a)).toEqual({ reading: "bound", unlocked: true });
    await writeFaceRow(idbName, a, "outbox/1", bytes("now it lands"));
    expect(text(await readFaceRow(idbName, a, "outbox/1"))).toBe("now it lands");

    expect(lockFaceCustody(idbName, a)).toBe(true);
    expect(faceCustodyKeysHeld(idbName)).toBe(0);
    await expect(readFaceRow(idbName, a, "outbox/1")).rejects.toMatchObject({ reading: "face-locked" });
    expect(await unlockFaceCustody(idbName, a, [PASS_B])).toMatchObject({ reading: "no-slot-opens" });
    expect(await unlockFaceCustody(idbName, a, [PASS_A])).toMatchObject({ reading: "opens" });
  }, SLOW);

  test("FC3 RED a clear names one face; a wrong route and an unconfirmed ask clear nothing — CONTROL: the confirmed clear takes A alone", async () => {
    const idbName = store("clear"), a = face("a"), b = face("b");
    await bindFirstFaceSlot(idbName, a, PASS_A);
    await bindFirstFaceSlot(idbName, b, PASS_B);
    await writeFaceRow(idbName, a, "outbox/1", bytes("A"));
    await writeFaceRow(idbName, b, "outbox/1", bytes("B"));
    const io = browserKeystoreCustodyIo(idbName);
    const census = async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {};
      for (const row of await io.list()) out[row] = [...(await io.read(row))!].join(",");
      return out;
    };
    const before = await census();
    const aRow = await faceRowPath(idbName, a, "outbox/1"), bRow = await faceRowPath(idbName, b, "outbox/1");
    const treeOf = (row: string): string => `face-slots/${row.split("/")[1]!}`;

    await expect(clearFaceCustody(idbName, null, [PASS_A], () => true)).rejects.toMatchObject({ reading: "face-absent" });
    await expect(clearFaceCustody(idbName, undefined as unknown as string, [PASS_A], () => true)).rejects.toMatchObject({ reading: "face-absent" });
    expect(await clearFaceCustody(idbName, a, [PASS_B], () => true)).toMatchObject({ reading: "no-slot-opens" });
    expect(await clearFaceCustody(idbName, a, [PASS_A], () => false)).toMatchObject({ reading: "asked" });
    expect(await census(), "nothing cleared yet").toEqual(before);

    expect(await clearFaceCustody(idbName, a, [PASS_A], () => true)).toMatchObject({ reading: "cleared" });
    expect(await readFaceCustody(idbName, a)).toEqual({ reading: "absent" });
    expect(faceCustodyHeld(idbName, a)).toBe(false);
    const after = await census();
    expect(after[aRow], "A's row leaves").toBeUndefined();
    expect(after[treeOf(aRow)], "A's tree leaves").toBeUndefined();
    expect(before[bRow]).toBeDefined();
    expect(after[bRow], "B's row stands byte-identical").toBe(before[bRow]);
    expect(after[treeOf(bRow)], "B's tree stands byte-identical").toBe(before[treeOf(bRow)]);
    expect(text(await readFaceRow(idbName, b, "outbox/1")), "CONTROL: B still reads its own").toBe("B");
  }, SLOW);

  test("FC4 RED a face names a PersonaGroup, never h<N>; swapped index entries refuse at the anchor and seat nothing", async () => {
    const idbName = store("index"), a = face("a"), b = face("b");
    await expect(bindFirstFaceSlot(idbName, "h0", PASS_A)).rejects.toMatchObject({ reading: "face-names-a-handle" });
    await expect(readFaceCustody(idbName, "h12")).rejects.toMatchObject({ reading: "face-names-a-handle" });
    // One typed passphrase for both faces, so a swapped index would open the other face's tree.
    await bindFirstFaceSlot(idbName, a, PASS_A);
    await bindFirstFaceSlot(idbName, b, PASS_A);
    lockFaceCustody(idbName, a); lockFaceCustody(idbName, b);
    const io = browserKeystoreCustodyIo(idbName);
    const raw = JSON.parse(text(await io.read(FACE_INDEX_ROW))!) as { entries: { group: string; fcid: string }[] };
    expect(raw.entries.length).toBe(2);
    expect(JSON.stringify(raw), "the index names no face in the clear").not.toContain(a);
    const [ea, eb] = raw.entries;
    const swapped = { entries: [{ ...ea!, fcid: eb!.fcid }, { ...eb!, fcid: ea!.fcid }] };
    await io.write(FACE_INDEX_ROW, bytes(JSON.stringify(swapped)));
    await expect(unlockFaceCustody(idbName, a, [PASS_A])).rejects.toMatchObject({ reading: "face-index-mismatch" });
    expect(faceCustodyKeysHeld(idbName), "no face seated").toBe(0);
    // CONTROL: the honest index seats its face.
    await io.write(FACE_INDEX_ROW, bytes(JSON.stringify(raw)));
    expect(await unlockFaceCustody(idbName, a, [PASS_A])).toMatchObject({ reading: "opens" });
  }, SLOW);
});

describe("the leaf's ember row", () => {
  test("FC5 RED the ember answers signed asks only while its face stands unlocked — CONTROL: the unlocked face answers", async () => {
    const idbName = store("ember"), a = face("a"), b = face("b");
    const hearthSeed = ed25519.utils.randomSecretKey();
    const hearthKey = await ed25519.getPublicKeyAsync(hearthSeed);
    const hearth = "hearth-synthetic";
    // A stand-in exchange: the pin's group lands with the ember pin's own build; the row and its door stand here.
    const exchange = {
      publicOf: (s: Uint8Array) => s.slice().reverse(),
      answer: (s: Uint8Array, blinded: Uint8Array) => blinded.map((x, i) => x ^ s[i % s.length]!),
    };
    await expect(mintEmber(idbName, a, hearth, hearthKey, exchange), "no slot, no ember").rejects.toMatchObject({ reading: "no-custody-slot" });
    await bindFirstFaceSlot(idbName, a, PASS_A);
    await bindFirstFaceSlot(idbName, b, PASS_B);
    const minted = await mintEmber(idbName, a, hearth, hearthKey, exchange);
    expect(minted.point.length).toBe(32);

    const blinded = crypto.getRandomValues(new Uint8Array(32));
    const signature = await ed25519.signAsync(emberAskBytes(hearth, blinded), hearthSeed);
    const answer = await answerEmberAsk(idbName, a, { hearth, blinded, signature }, exchange);
    expect(answer.length, "CONTROL: the unlocked face answers").toBe(32);

    const forged = await ed25519.signAsync(emberAskBytes(hearth, blinded), ed25519.utils.randomSecretKey());
    await expect(answerEmberAsk(idbName, a, { hearth, blinded, signature: forged }, exchange)).rejects.toMatchObject({ reading: "ember-ask-unsigned" });
    await expect(answerEmberAsk(idbName, a, { hearth, blinded, signature: new Uint8Array(64) }, exchange)).rejects.toMatchObject({ reading: "ember-ask-unsigned" });
    await expect(answerEmberAsk(idbName, b, { hearth, blinded, signature }, exchange), "face B keeps no ember of A's").rejects.toMatchObject({ reading: "ember-absent" });

    lockFaceCustody(idbName, a);
    await expect(answerEmberAsk(idbName, a, { hearth, blinded, signature }, exchange)).rejects.toMatchObject({ reading: "face-locked" });
    await unlockFaceCustody(idbName, a, [PASS_A]);
    expect([...(await answerEmberAsk(idbName, a, { hearth, blinded, signature }, exchange))]).toEqual([...answer]);
  }, SLOW);
});
