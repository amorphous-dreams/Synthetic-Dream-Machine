/**
 * face-custody.worker — K15's isolation red on a vessel worker's own thread: two faces found with independent trees, face A
 * unlocked alone, and every door into face B tried with what A's unlock holds, bypassing every router, session and store
 * adapter (the keystore's raw port reads and writes the bytes).
 */
import { browserKeystoreCustodyIo } from "../../src/browser-custody.js";
import {
  bindFirstFaceSlot, faceCustodyHeld, faceKeyOpens, faceRowPath, lockFaceCustody, readFaceRow, unlockFaceCustody, writeFaceRow,
} from "../../src/browser-face-custody.js";

const scope = globalThis as unknown as {
  addEventListener(type: "message", callback: (event: MessageEvent) => void): void;
  postMessage(message: unknown): void;
};
const PASS_A = { kind: "passphrase", passphrase: "face A keeps its own fire" } as const;
const PASS_B = { kind: "passphrase", passphrase: "face B keeps another fire" } as const;
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array | null): string | null => b === null ? null : new TextDecoder().decode(b);
const refusalOf = async (p: Promise<unknown>): Promise<string> => p.then(() => "landed", (e: unknown) => (e as { reading?: string }).reading ?? String(e));

scope.addEventListener("message", (event) => {
  const msg = event.data as { op: string; idbName: string; a: string; b: string };
  if (msg.op !== "isolation") return;
  void (async () => {
    const { idbName, a, b } = msg;
    const io = browserKeystoreCustodyIo(idbName);
    await bindFirstFaceSlot(idbName, a, PASS_A);
    await bindFirstFaceSlot(idbName, b, PASS_B);
    await writeFaceRow(idbName, a, "recipe/1", enc("A's recipe"));
    await writeFaceRow(idbName, b, "ledger/1", enc("B's ledger"));
    lockFaceCustody(idbName, a);
    lockFaceCustody(idbName, b);
    const bPath = await faceRowPath(idbName, b, "ledger/1");
    const bBefore = (await io.read(bPath))!.slice();

    await unlockFaceCustody(idbName, a, [PASS_A]);
    const heldAfterUnlockA = { a: faceCustodyHeld(idbName, a), b: faceCustodyHeld(idbName, b) };
    const controlReadA = dec(await readFaceRow(idbName, a, "recipe/1"));
    const bReadRefusal = await refusalOf(readFaceRow(idbName, b, "ledger/1"));
    const bWriteRefusal = await refusalOf(writeFaceRow(idbName, b, "ledger/1", enc("A writes over B")));
    // THE BYPASS: A's held key against B's bytes, no router between.
    const aKeyOpensB = await faceKeyOpens(idbName, a, b, "ledger/1");
    // B's ciphertext planted in A's place: A's writer meets an occupied row its key never opens, and replaces nothing.
    const aPlanted = await faceRowPath(idbName, a, "ledger/1");
    await io.write(aPlanted, bBefore);
    const bOccupiedReplaceRefusal = await refusalOf(writeFaceRow(idbName, a, "ledger/1", enc("A writes over B's bytes")));
    const planted = (await io.read(aPlanted))!;
    if (!planted.every((x, i) => x === bBefore[i])) throw new Error("the refused write moved the planted bytes");
    await io.remove(aPlanted);
    // Every door A's unlock reached left B's bytes as they stood.
    const bMid = (await io.read(bPath))!;
    const bBytesUnchanged = bMid.length === bBefore.length && bMid.every((x, i) => x === bBefore[i]);
    // A's ciphertext copied into B's place.
    const aPath = await faceRowPath(idbName, a, "recipe/1");
    const aBytes = (await io.read(aPath))!;
    await io.write(bPath, aBytes);
    const copiedIntoB = await refusalOf(faceKeyOpens(idbName, a, b, "ledger/1").then((opens) => { if (opens) return "opens"; throw Object.assign(new Error("row-unopened"), { reading: "row-unopened" }); }));
    await io.write(bPath, bBefore);
    await unlockFaceCustody(idbName, b, [PASS_B]);
    const controlReadBAfterUnlock = dec(await readFaceRow(idbName, b, "ledger/1"));
    const onWorker = typeof (globalThis as { document?: unknown }).document === "undefined";
    scope.postMessage({
      op: "isolation", onWorker, heldAfterUnlockA, controlReadA, bReadRefusal, bWriteRefusal, aKeyOpensB, bOccupiedReplaceRefusal,
      copiedIntoB, bBytesUnchanged, controlReadBAfterUnlock,
    });
  })().catch((e: unknown) => scope.postMessage({ op: "isolation", error: String(e) }));
});

scope.postMessage({ type: "ready" });
