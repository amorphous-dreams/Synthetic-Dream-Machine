/** A face's issued operation bytes rest sealed on that face's PersonaGroup plane. */
import { FACE_OPERATION_RECORD_INFO, hex, mutableLarRecord, tiddlerText, type LarTiddlerStore } from "@lararium/mesh";
import { openCheckpoint, sealCheckpoint } from "./ceremony-core.js";

export async function faceOperationTitle(signedInput: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(signedInput)));
  return `lar:///ha.ka.ba/keyhive/face-operation/${hex(digest)}`;
}

export async function readFaceOperation<T>(store: LarTiddlerStore, seed: Uint8Array, signedInput: Uint8Array): Promise<T | null> {
  const record = await store.get(await faceOperationTitle(signedInput));
  const body = record && !record.meta?.deleted ? tiddlerText(record) : null;
  return body ? openCheckpoint<T>(body, seed, FACE_OPERATION_RECORD_INFO) : null;
}

export async function writeFaceOperation(store: LarTiddlerStore, seed: Uint8Array, signedInput: Uint8Array, issued: unknown): Promise<void> {
  const title = await faceOperationTitle(signedInput);
  const text = await sealCheckpoint(issued, seed, FACE_OPERATION_RECORD_INFO);
  await store.put(mutableLarRecord(title, { text, kind: "face-operation-record" }, "lares-keyhive"),
    { kind: "lares-verb", requestId: `face-operation-${title.slice(-16)}` });
}
