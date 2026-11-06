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
 * A face's WARD KEY (the co-sign signer, whose public half each admission of this browser into the face carries) rests under a ward
 * of its own in the same frame: its tree at `ward/sign/<group>/slots`, its seed at `ward/sign/<group>/seed`, its public half in plain
 * bytes at `ward/sign/<group>/public-key`. Its mint runs here too (`runWardKeyMint`): the ward key and the seed draw inside the act,
 * the tree binds over the route typed for it, the seed seals under it, and the pop signs once, so neither ever stands on the page.
 *
 * A passkey never opens a ward: a passkey route, or a tree that carries a passkey pin, refuses `ward-passkey-refused` before any
 * derivation.
 */
import {
  bindWardSlot, confirmHeldPaper, constantTimeBytesEqual, decodeSlotTree, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, encodeSlotTree, mintWardKey, nobleKdf, openUnderWard,
  openWardKey, sealUnderWard, signingSeedFromHex, treeKeyEquals, wardKeyPopImage, WARD_STORE, WardRefused,
  type Credential, type FaceCarrier, type KdfPort, type PinSpec, type WardKey,
} from "@lararium/mesh";

/** The keystore rows a face's ward holds: its tree, and its root under it. Every name starts `ward/`. */
export const WARD_ROW_PREFIX = "ward/";
export const wardTreeRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/slots`;
export const wardRootRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/persona-root`;
/** The root's PUBLIC key beside its ward, so a ward act's signer names its key with the page's custody locked. */
export const wardKeyRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/public-key`;
/**
 * THE FACE THE WARD BELONGS TO: the opaque id (fcid) of the face tree that stood worn when the root minted. It lands before the
 * ward's tree, so a torn mint resumes owned; a ward act, a mint and a possession read answer only for the face whose tree it names,
 * and that face's clear removes the ward with it.
 */
export const wardOwnerRowOf = (handleIndex: number): string => `${WARD_ROW_PREFIX}h${handleIndex}/face-tree`;

/** A face's ward key rows: its own ward tree, its seed under that ward, and its PUBLIC half beside it (plain bytes, opening nothing). */
export function wardSignRowsOf(group: string): { readonly tree: string; readonly seed: string; readonly key: string } {
  if (group.length === 0 || group.includes("/")) throw new WardRefused("ward-key-unnamed", "a ward key names its PersonaGroup");
  return { tree: `${WARD_ROW_PREFIX}sign/${group}/slots`, seed: `${WARD_ROW_PREFIX}sign/${group}/seed`, key: `${WARD_ROW_PREFIX}sign/${group}/public-key` };
}

/** The carrier the ward key seed's AEAD binds: bytes moved to another face's row, or to a root's row, open nowhere. */
export function wardSignCarrier(group: string): FaceCarrier {
  const path = wardSignRowsOf(group).seed;
  return { name: `browser-ward/sign/${group}/seed`, path, kind: "ward-sign", ref: group, owner: group, store: WARD_STORE };
}

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

/** The pin a human route binds: a passphrase, or a paper sheet the person holds. A passkey refuses by name. */
export function wardPinOf(credential: Credential): PinSpec {
  if (credential.kind === "passphrase") return { kind: "passphrase", passphrase: credential.passphrase };
  if (credential.kind === "paper") return { kind: "paper", confirmed: confirmHeldPaper(credential.sheets) };
  throw new WardRefused("ward-passkey-refused", "the ward binds human routes alone");
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

/** What a WARD KEY act takes: the face's ward key tree and its sealed seed as raw bytes, the route typed for this one act, the bytes. */
export interface WardKeyActRequest {
  readonly act: "ward-key-sign";
  readonly group: string;
  readonly tree: Uint8Array;
  readonly sealedSeed: Uint8Array;
  readonly route: WardRoute;
  readonly bytes: Uint8Array;
}

/** What a ward key MINT takes: the face, the device atom its pop vouches for, and the route the fresh ward binds over. */
export interface WardKeyMintRequest {
  readonly act: "ward-key-mint";
  readonly group: string;
  readonly deviceKey: string;
  readonly route: WardRoute;
}

/** What a mint answers: the ward key, its pop over (group, atom, ward key), and the two rows to land (they open under no page key). */
export type WardKeyMintAnswer = { readonly key: string; readonly signature: string; readonly tree: Uint8Array; readonly sealedSeed: Uint8Array } | { readonly refused: string };

/** What a ward act answers: the root's public key and one signature, or the refusal's name. */
export type WardActAnswer = { readonly key: string; readonly signature: string } | { readonly refused: string };

/** Run one ward act: a face root's sign, a ward key's sign, or a ward key's mint. `watch` sees each secret buffer the act opens, to
 *  witness that each zeroes (the worker passes none). */
export function runWardAct(req: WardKeyMintRequest, kdf?: KdfPort, watch?: (secret: Uint8Array) => void): Promise<WardKeyMintAnswer>;
export function runWardAct(req: WardActRequest | WardKeyActRequest, kdf?: KdfPort, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer>;
export function runWardAct(req: WardActRequest | WardKeyActRequest | WardKeyMintRequest, kdf?: KdfPort, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer | WardKeyMintAnswer>;
export function runWardAct(req: WardActRequest | WardKeyActRequest | WardKeyMintRequest, kdf: KdfPort = nobleKdf, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer | WardKeyMintAnswer> {
  if ("act" in req) return req.act === "ward-key-mint" ? runWardKeyMint(req, kdf, watch) : runWardKeyAct(req, kdf, watch);
  return runWardRootAct(req, kdf, watch);
}

async function runWardRootAct(req: WardActRequest, kdf: KdfPort, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer> {
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

/** One WARD KEY act: the face's ward key opens FRESH from the typed route, the seed opens under it, signs once, and both zero-fill. */
async function runWardKeyAct(req: WardKeyActRequest, kdf: KdfPort, watch?: (secret: Uint8Array) => void): Promise<WardActAnswer> {
  try {
    const credential = wardCredentialOf(req.route);
    const reading = decodeSlotTree(req.tree);
    if (reading.reading !== "readable") return { refused: "ward-tree-unreadable" };
    const opened = await openWardKey(reading.tree, [credential], kdf);
    if (opened.reading !== "opens") return { refused: "ward-no-slot-opens" };
    watch?.(opened.treeKey);
    let seed: Uint8Array | null = null;
    try {
      seed = openWardKeySeed(opened.treeKey, req.group, req.sealedSeed);
      watch?.(seed);
      const key = await ed25519VerifyingKeyFromSeed(seed);
      const signature = await ed25519SignerFromSeed(seed)(req.bytes);
      return { key, signature };
    } finally { opened.treeKey.fill(0); seed?.fill(0); }
  } catch (e) {
    return { refused: e instanceof WardRefused ? e.reading : "ward-act-failed" };
  }
}

/** The seed a face's ward key row opens to under its ward; any other reading refuses by name. The plaintext zero-fills here. */
function openWardKeySeed(wardKey: WardKey, group: string, bytes: Uint8Array | null): Uint8Array {
  const opened = openUnderWard(wardKey, wardSignCarrier(group), bytes);
  if (opened.reading === "absent") throw new WardRefused("ward-absent", "no ward key seed stands for this face");
  if (opened.reading !== "opens") throw new WardRefused("ward-key-unopenable", `the ward key seed reads ${opened.reading}`);
  try {
    const record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(opened.plaintext)) as { signingKey?: unknown };
    if (typeof record.signingKey !== "string" || !/^[0-9a-f]{64}$/.test(record.signingKey)) throw new WardRefused("ward-key-unopenable", "the ward key row holds no seed");
    return signingSeedFromHex(record.signingKey);
  } catch (e) {
    if (e instanceof WardRefused) throw e;
    throw new WardRefused("ward-key-unopenable", "the ward key row does not parse");
  } finally { opened.plaintext.fill(0); }
}

/**
 * MINT one face's ward key inside the act: a fresh ward key binds one slot over the typed route (proved to reopen under it), a fresh
 * seed seals under that ward key (proved to reopen), and the seed signs the admission's pop once. The ward key, the seed and every
 * plaintext zero-fill before this returns; what leaves is the public key, the pop and the two sealed rows.
 */
export async function runWardKeyMint(req: WardKeyMintRequest, kdf: KdfPort = nobleKdf, watch?: (secret: Uint8Array) => void): Promise<WardKeyMintAnswer> {
  let ward: WardKey | null = null, seed: Uint8Array | null = null, plaintext: Uint8Array | null = null;
  try {
    const credential = wardCredentialOf(req.route);
    const pin = wardPinOf(credential);
    ward = mintWardKey();
    watch?.(ward);
    const tree = encodeSlotTree(await bindWardSlot(null, ward, { t: 1, pins: [pin] }, kdf));
    const reread = decodeSlotTree(tree);
    if (reread.reading !== "readable") return { refused: "ward-tree-unreadable" };
    const back = await openWardKey(reread.tree, [credential], kdf);
    if (back.reading !== "opens") return { refused: "ward-no-slot-opens" };
    const same = treeKeyEquals(back.treeKey, ward);
    back.treeKey.fill(0);
    if (!same) return { refused: "ward-no-slot-opens" };
    seed = globalThis.crypto.getRandomValues(new Uint8Array(32));
    watch?.(seed);
    plaintext = new TextEncoder().encode(JSON.stringify({ signingKey: [...seed].map((b) => b.toString(16).padStart(2, "0")).join("") }));
    watch?.(plaintext);
    const sealedSeed = sealUnderWard(ward, wardSignCarrier(req.group), plaintext);
    const proof = openWardKeySeed(ward, req.group, sealedSeed);
    const holds = constantTimeBytesEqual(proof, seed);
    proof.fill(0);
    if (!holds) return { refused: "ward-key-unopenable" };
    const key = await ed25519VerifyingKeyFromSeed(seed);
    const signature = await ed25519SignerFromSeed(seed)(wardKeyPopImage(req.group, req.deviceKey, key));
    return { key, signature, tree, sealedSeed };
  } catch (e) {
    return { refused: e instanceof WardRefused ? e.reading : "ward-act-failed" };
  } finally { ward?.fill(0); seed?.fill(0); plaintext?.fill(0); }
}
