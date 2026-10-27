/** One face's secret names one working document for each wiki and slot kind. */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import { stringifyAutomergeUrl, type AutomergeUrl, type BinaryDocumentId } from "@automerge/automerge-repo";
import { utf8Bytes } from "./crypto.js";
import { FACE_WORKING_ADDRESS_DOMAIN } from "./domains.js";
import { materializeSharedLarDoc } from "./deterministic-doc.js";
import { emptyLarDoc, type LarDoc } from "./base-doc.js";
import { pinnedDoc } from "./pinned-doc.js";
import type { SessionFace } from "./session-contract.js";
import { WIKI_SLOT_KINDS, type WikiSlotKind } from "./wiki-recipe.js";

export type FaceWorkingAddressReason =
  | "secret-malformed" | "wiki-malformed" | "kind-unknown"
  | "no-address-secret" | "address-not-derived";

export class FaceWorkingAddressRefusal extends Error {
  override readonly name = "FaceWorkingAddressRefusal";
  constructor(readonly reason: FaceWorkingAddressReason) {
    super(`face working address: ${reason}`);
  }
}

/** A fixed, four-byte big-endian length precedes each UTF-8 field. */
function addressImage(wikiId: string, kind: WikiSlotKind): Uint8Array {
  const parts = [FACE_WORKING_ADDRESS_DOMAIN, wikiId, kind].map(utf8Bytes);
  const image = new Uint8Array(parts.reduce((size, part) => size + 4 + part.length, 0));
  const view = new DataView(image.buffer);
  let offset = 0;
  for (const part of parts) {
    view.setUint32(offset, part.length, false);
    image.set(part, offset + 4);
    offset += 4 + part.length;
  }
  return image;
}

/** The address follows the face and wiki relation, independent of recipe composition. */
export function faceWorkingDocUrl(secret: Uint8Array, wikiId: string, kind: WikiSlotKind): AutomergeUrl {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new FaceWorkingAddressRefusal("secret-malformed");
  if (typeof wikiId !== "string" || wikiId.length === 0) throw new FaceWorkingAddressRefusal("wiki-malformed");
  if (!WIKI_SLOT_KINDS.includes(kind)) throw new FaceWorkingAddressRefusal("kind-unknown");
  const binId = hmac(sha256, secret, addressImage(wikiId, kind)).slice(0, 16) as BinaryDocumentId;
  return stringifyAutomergeUrl({ documentId: binId });
}

export interface FaceWorkingSlotPorts {
  readonly face: SessionFace;
  readonly wikiId: string;
  readonly kind: WikiSlotKind;
  readonly secret: () => Promise<Uint8Array | null>;
  readonly claimed?: string;
}

export type FaceWorkingSlotResolution =
  | { readonly ok: true; readonly url: AutomergeUrl; readonly reach: "face" }
  | { readonly ok: false; readonly refusal: FaceWorkingAddressRefusal };

/** A vessel without this face's secret cannot find or mint its working layer. */
export async function resolveFaceWorkingSlot(ports: FaceWorkingSlotPorts): Promise<FaceWorkingSlotResolution> {
  const secret = await ports.secret();
  if (secret === null) return { ok: false, refusal: new FaceWorkingAddressRefusal("no-address-secret") };
  try {
    const url = faceWorkingDocUrl(secret, ports.wikiId, ports.kind);
    if (ports.claimed !== undefined && ports.claimed !== url) {
      return { ok: false, refusal: new FaceWorkingAddressRefusal("address-not-derived") };
    }
    return { ok: true, url, reach: "face" };
  } catch (error) {
    if (error instanceof FaceWorkingAddressRefusal) return { ok: false, refusal: error };
    throw error;
  } finally {
    secret.fill(0);
  }
}

/** The blank pinned genesis bytes converge across offline vessels. */
export const faceWorkingGenesis = (): ReturnType<typeof pinnedDoc<Record<string, unknown>>> => pinnedDoc(emptyLarDoc() as unknown as Record<string, unknown>);

/** Find or materialize the deterministic working document under its derived id. */
export function materializeFaceWorkingDoc(repo: Repo, url: AutomergeUrl, label: string): Promise<DocHandle<LarDoc>> {
  return materializeSharedLarDoc(repo, url, `board:face-working${label ? `:${label}` : ""}`);
}
