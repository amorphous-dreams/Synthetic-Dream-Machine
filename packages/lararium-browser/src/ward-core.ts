/**
 * ward-core — THE PURE CORE OF ONE BROWSER WARD ACT (seat-harness#/the-ward), run inside a per-act worker the page terminates.
 *
 * A browser face's root rests under that face's WARD key, the browser twin of the node's `ward-slots.bin`: the ward tree rests at
 * `ward/h<N>/slots` (a keyslot tree over the face's human routes), and the root at `ward/h<N>/persona-root`, sealed in the ward's
 * own frame (`lares-ward-seal`, domain `custody-carrier-ward`). The keystore's tree key wraps neither, so no unlocked custody
 * opens the root.
 *
 * The act receives the ward tree and the warded root row as raw bytes (no key rides them), the route the person typed for this act,
 * and the bytes to sign. It opens the ward key FRESH from that route through noble's scrypt (the minted KDF port), opens the root
 * under it, signs once, and zero-fills the ward key and the seed. What leaves is the root's public key and the one signature, and
 * nothing else; a refusal leaves by name and carries no byte of a credential.
 *
 * A passkey never opens a ward: a passkey route, or a tree that carries a passkey pin, refuses `ward-passkey-refused` before any
 * derivation.
 */
import {
  decodeSlotTree, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, nobleKdf, openUnderWard, openWardKey, signingSeedFromHex,
  WARD_STORE, WardRefused, type Credential, type FaceCarrier, type KdfPort, type WardKey,
} from "@lararium/mesh";

/** The keystore rows a face's ward holds: its tree, and its root under it. Every name starts `ward/`. */
export const WARD_ROW_PREFIX = "ward/";
export const wardTreeRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/slots`;
export const wardRootRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/persona-root`;
/** The root's PUBLIC key beside its ward, so a ward act's signer names its key with the page's custody locked. */
export const wardKeyRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/public-key`;

/** The carrier the warded root's AEAD binds: bytes moved to another face's row open nowhere. */
export function wardRootCarrier(handleIndex: number): FaceCarrier {
  return { name: `browser-ward/h${handleIndex}/persona-root`, path: wardRootRowOf(handleIndex), kind: "persona-root", ref: `h${handleIndex}`, owner: `h${handleIndex}`, store: WARD_STORE };
}

/** A ward route as the page hands it: the typed passphrase, or a credential. A passkey credential refuses at every door. */
export type WardRoute = string | Credential;

export function wardCredentialOf(route: WardRoute): Credential {
  if (typeof route === "string") {
    if (route.length === 0) throw new WardRefused("ward-needs-fresh-unlock", "an empty route");
    return { kind: "passphrase", passphrase: route };
  }
  const kind = (route as { kind?: unknown } | null | undefined)?.kind;
  if (kind === "passkey") throw new WardRefused("ward-passkey-refused", "the ward opens human routes alone (a passphrase, a paper sheet)");
  if (kind !== "passphrase" && kind !== "paper") throw new WardRefused("ward-needs-fresh-unlock", "no route rides this act");
  return route;
}

/** The keypair a warded row opens to under `wardKey`; any other reading refuses by name. The plaintext zero-fills before this returns. */
export function openWardedRoot(wardKey: WardKey, handleIndex: number, bytes: Uint8Array | null): { readonly verifyingKey: string; readonly signingKey: string } {
  const opened = openUnderWard(wardKey, wardRootCarrier(handleIndex), bytes);
  if (opened.reading === "absent") throw new WardRefused("ward-absent", "no warded root stands for this face");
  if (opened.reading !== "opens") throw new WardRefused("ward-root-unopenable", `the warded root reads ${opened.reading}`);
  try {
    const record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(opened.plaintext)) as { verifyingKey?: unknown; signingKey?: unknown };
    if (typeof record.signingKey !== "string" || typeof record.verifyingKey !== "string") throw new WardRefused("ward-root-unopenable", "the warded root holds no keypair");
    return { verifyingKey: record.verifyingKey, signingKey: record.signingKey };
  } catch (e) {
    if (e instanceof WardRefused) throw e;
    throw new WardRefused("ward-root-unopenable", "the warded root does not parse");
  } finally { opened.plaintext.fill(0); }
}

/** What a ward act takes: raw bytes and one typed route, never a key. */
export interface WardActRequest {
  readonly tree: Uint8Array;
  readonly sealedRoot: Uint8Array;
  readonly handleIndex: number;
  readonly route: WardRoute;
  readonly bytes: Uint8Array;
}

/** What a ward act answers: the root's public key and one signature, or the refusal's name. */
export type WardActAnswer = { readonly key: string; readonly signature: string } | { readonly refused: string };

/** Run one ward act. `watch` sees each secret buffer the act opens, to witness that each zeroes (the worker passes none). */
export async function runWardAct(req: WardActRequest, kdf: KdfPort = nobleKdf, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer> {
  try {
    const credential = wardCredentialOf(req.route);
    const reading = decodeSlotTree(req.tree);
    if (reading.reading !== "readable") return { refused: "ward-tree-unreadable" };
    const opened = await openWardKey(reading.tree, [credential], kdf);
    if (opened.reading !== "opens") return { refused: "ward-no-slot-opens" };
    watch?.(opened.treeKey);
    let seed: Uint8Array | null = null;
    try {
      const root = openWardedRoot(opened.treeKey, req.handleIndex, req.sealedRoot);
      seed = signingSeedFromHex(root.signingKey);
      watch?.(seed);
      const key = await ed25519VerifyingKeyFromSeed(seed);
      if (key !== root.verifyingKey) return { refused: "ward-root-unopenable" };
      const signature = await ed25519SignerFromSeed(seed)(req.bytes);
      return { key, signature };
    } finally { opened.treeKey.fill(0); seed?.fill(0); }
  } catch (e) {
    return { refused: e instanceof WardRefused ? e.reading : "ward-act-failed" };
  }
}
