/**
 * custody-root — THE CUSTODY ROOT: a hot carrier minted at founding, sealed under the vessel KEK (VK), and the
 * one root every sovereign derivation of an unlocked vessel stands on.
 *
 * ── TWO ROOTS, NEVER ONE ────────────────────────────────────────────────────────────────────────
 * The FLOOR key (the vessel key) rests outside the VK. It signs the knock and the floor's announcement and
 * derives the per-Nexus wire key, because those acts run before any VK opens. The CUSTODY root rests under
 * the VK and derives what only an unlocked vessel uses: the veil, the keyhive signer, the hosting key, the
 * sovereign caps. A stolen box at rest yields the floor key's reach and nothing the custody root derives.
 * The custody root never feeds a floor act.
 *
 * ── THE BRAND ───────────────────────────────────────────────────────────────────────────────────
 * `CustodyRoot` carries a type-level brand, and every root the two doors hand out enters a module-private
 * WeakSet. A derivation refuses, by name, any value the doors never handed out: the floor key's bytes, raw
 * or dressed as `{ bytes }`, never pass. The root holds its own copy of its bytes, so a caller that zeroes
 * its buffer moves no derivation.
 *
 * ── A CHILD DERIVES UNDER A REGISTERED DOMAIN ───────────────────────────────────────────────────
 * `custodyDerive(root, domain)` runs RFC 5869 HKDF-SHA256 with an empty salt and the domain address as
 * `info`. The domain must stand in the registry (`ALL_DOMAINS`): each child names its own purpose there, so
 * two children of one root never fuse and no purpose hides outside the table.
 *
 * ── THE VEIL'S INPUT MOVES, ITS STRING NEVER DOES ───────────────────────────────────────────────
 * `custodyVeil` derives the dyad veil from the custody root through the same `deriveDyadVeil` the floor key
 * feeds, under the frozen `dyad-veil` string. Only the input differs, so the move changes no derivation
 * byte for a given input.
 *
 * The carrier rests at `custodyRootPath()`, written once at founding through the one sealed writer.
 */

import { hkdfSync, randomBytes } from "node:crypto";
import { join } from "node:path";
import { ALL_DOMAINS, deriveDyadVeil } from "@lararium/mesh";
import { larIdentityDir } from "./vessel-paths.js";

/** A custody root's length: one 32-byte secret. */
export const CUSTODY_ROOT_BYTES = 32;

declare const CUSTODY_ROOT_BRAND: unique symbol;

/** The custody root, handed out by `mintCustodyRoot` or `custodyRootFromBytes` and nowhere else. */
export type CustodyRoot = { readonly bytes: Uint8Array } & { readonly [CUSTODY_ROOT_BRAND]: true };

const issued = new WeakSet<object>();

/** The refusal every custody door throws. */
export class CustodyRootRefused extends Error {
  override readonly name = "CustodyRootRefused";
  constructor(detail: string) {
    super(`[custody-root] ${detail}`);
  }
}

/** The custody root carrier's path in the identity home. */
export function custodyRootPath(): string {
  return join(larIdentityDir(), "custody-root.bin");
}

function issue(bytes: Uint8Array): CustodyRoot {
  const root = Object.freeze({ bytes: Uint8Array.from(bytes) }) as CustodyRoot;
  issued.add(root);
  return root;
}

/** Mint a fresh custody root from the CSPRNG — the founding act's one mint. */
export function mintCustodyRoot(): CustodyRoot {
  return issue(new Uint8Array(randomBytes(CUSTODY_ROOT_BYTES)));
}

/** Brand the bytes the sealed carrier opened to. Any other length refuses. */
export function custodyRootFromBytes(bytes: Uint8Array): CustodyRoot {
  if (!(bytes instanceof Uint8Array) || bytes.length !== CUSTODY_ROOT_BYTES) {
    throw new CustodyRootRefused(`a custody root holds ${CUSTODY_ROOT_BYTES} bytes (got ${bytes instanceof Uint8Array ? bytes.length : typeof bytes})`);
  }
  return issue(bytes);
}

/** True only for a root one of the two doors handed out. */
export function isCustodyRoot(v: unknown): v is CustodyRoot {
  return typeof v === "object" && v !== null && issued.has(v);
}

function assertRoot(root: unknown): asserts root is CustodyRoot {
  if (!isCustodyRoot(root)) {
    throw new CustodyRootRefused("refused a key no custody door handed out — the floor key never derives a custody child");
  }
}

/** Derive the child a registered `domain` names: HKDF-SHA256, empty salt, the domain as info, 32 bytes. */
export function custodyDerive(root: CustodyRoot, domain: string): Uint8Array {
  assertRoot(root);
  if (!ALL_DOMAINS.includes(domain)) {
    throw new CustodyRootRefused(`refused domain ${JSON.stringify(domain)} — a custody child derives only under a domain the registry declares`);
  }
  return new Uint8Array(hkdfSync("sha256", root.bytes, new Uint8Array(0), domain, 32));
}

/** The dyad veil for `groupTag`, derived from the custody root under the frozen `dyad-veil` string. */
export function custodyVeil(root: CustodyRoot, groupTag: string): Promise<{ signingKey: string; verifyingKey: string }> {
  assertRoot(root);
  return deriveDyadVeil(root.bytes, groupTag);
}
