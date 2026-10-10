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
 * ── TWO DOORS, BOTH ON THE CUSTODY PATH ─────────────────────────────────────────────────────────
 * A root comes from `mintCustodyRoot` (the founding act's CSPRNG) or from `custodyRootFromBytes`, and the
 * load door takes no bytes at all: it takes an `OpenedCustodyRoot`, which only `openCustodyRootCarrier`
 * mints, after the one sealed writer's opening of the custody carrier under the VK the slot tree commits to.
 * The opened bytes ride a module-private WeakMap behind that token, so no caller holds 32 bytes that a door
 * would brand. Every root either door hands out enters a module-private WeakSet, and a derivation refuses,
 * by name, any value the doors never handed out: the floor key's bytes — raw, dressed as `{ bytes }`, or
 * dressed as an opening — never pass. Each root holds its own copy of its bytes.
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
 * ── THE CARRIER ─────────────────────────────────────────────────────────────────────────────────
 * The carrier rests at `custodyRootPath()`, written once at founding through the one sealed writer
 * (`sealCustodyRoot`). Its seal names it by home and file (`identity/custody-root.bin`), the name the
 * carrier table's VK-sealed census gives it, so the AAD binds where the bytes rest.
 */

import { hkdfSync, randomBytes } from "node:crypto";
import { join } from "node:path";
import {
  ALL_DOMAINS, deriveDyadVeil, openSealedCarrier, writeSealedCarrier,
  type CustodyIo, type SealedCarrier, type VesselKey, type VkOpening,
} from "@lararium/mesh";
import { larIdentityDir } from "./vessel-paths.js";

/** A custody root's length: one 32-byte secret. */
export const CUSTODY_ROOT_BYTES = 32;

declare const CUSTODY_ROOT_BRAND: unique symbol;

/** The custody root, handed out by `mintCustodyRoot` or `custodyRootFromBytes` and nowhere else. */
export type CustodyRoot = { readonly bytes: Uint8Array } & { readonly [CUSTODY_ROOT_BRAND]: true };

const issued = new WeakSet<object>();

declare const OPENED_BRAND: unique symbol;
/** The custody carrier, opened under the VK. Only `openCustodyRootCarrier` mints one; it carries no bytes a caller reads. */
export type OpenedCustodyRoot = { readonly [OPENED_BRAND]: true };

const openedBytes = new WeakMap<object, Uint8Array>();

/** The refusal every custody door throws. */
export class CustodyRootRefused extends Error {
  override readonly name = "CustodyRootRefused";
  constructor(detail: string) {
    super(`[custody-root] ${detail}`);
  }
}

const CARRIER_FILE = "custody-root.bin";

/** The custody root carrier's path in the identity home. */
export function custodyRootPath(identityDir: string = larIdentityDir()): string {
  return join(identityDir, CARRIER_FILE);
}

/** The custody root's sealed carrier: named by home and file, resting in `identityDir`. */
export function custodyRootCarrier(identityDir: string = larIdentityDir()): SealedCarrier {
  return { name: `identity/${CARRIER_FILE}`, path: custodyRootPath(identityDir) };
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

/** Brand what the custody carrier opened to. Anything but an `openCustodyRootCarrier` opening refuses. */
export function custodyRootFromBytes(opened: OpenedCustodyRoot): CustodyRoot {
  const bytes = typeof opened === "object" && opened !== null ? openedBytes.get(opened) : undefined;
  if (bytes === undefined) {
    throw new CustodyRootRefused("the load door takes only an opening of the sealed custody carrier — raw bytes and the floor key never pass");
  }
  return issue(bytes);
}

/**
 * Open the custody carrier under `vk`. `opens` hands back the opening the load door takes; every other reading
 * stays named (`absent`, `key-fails`, `torn`, …). A carrier that opens to any width but 32 bytes refuses.
 */
export async function openCustodyRootCarrier(args: {
  readonly io:           CustodyIo;
  readonly vk:           VesselKey;
  readonly identityDir?: string;
}): Promise<{ readonly reading: "opens"; readonly opened: OpenedCustodyRoot } | Exclude<VkOpening, { reading: "opens" }>> {
  const o = await openSealedCarrier({ io: args.io, vk: args.vk, carrier: custodyRootCarrier(args.identityDir) });
  if (o.reading !== "opens") return o;
  if (o.plaintext.length !== CUSTODY_ROOT_BYTES) {
    throw new CustodyRootRefused(`the custody carrier opens to ${o.plaintext.length} bytes; a custody root holds ${CUSTODY_ROOT_BYTES}`);
  }
  const opened = Object.freeze({}) as OpenedCustodyRoot;
  openedBytes.set(opened, Uint8Array.from(o.plaintext));
  return { reading: "opens", opened };
}

/** Seal `root` as the custody carrier through the one sealed writer, under the VK the tree at `treePath` commits to. */
export async function sealCustodyRoot(args: {
  readonly io:           CustodyIo;
  readonly vk:           VesselKey;
  readonly treePath:     string;
  readonly root:         CustodyRoot;
  readonly identityDir?: string;
}): Promise<void> {
  assertRoot(args.root);
  await writeSealedCarrier({
    io: args.io, vk: args.vk, treePath: args.treePath, carrier: custodyRootCarrier(args.identityDir), plaintext: args.root.bytes,
  });
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
