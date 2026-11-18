import { sha256BytesSync, utf8Bytes } from "./crypto.js";

export class FaceScopedIdError extends Error {
  override readonly name = "FaceScopedIdError";
}

/** Namespace a caller's request or effect key under its verified proof subject. */
export function faceScopedId(proofSubject: string, id: string): string {
  if (typeof proofSubject !== "string" || !proofSubject) throw new FaceScopedIdError("proof subject required");
  if (typeof id !== "string" || !id) throw new FaceScopedIdError("id required");
  const prefix = Array.from(sha256BytesSync(utf8Bytes(proofSubject)).subarray(0, 16),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${id}`;
}
