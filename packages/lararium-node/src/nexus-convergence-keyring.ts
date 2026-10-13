/**
 * nexus-convergence-keyring — the per-Nexus convergence-secret SOURCE the cad seal message-locks against.
 *
 * THE SALT, NOT A CONTENT KEY. A Nexus holds ONE convergence secret per charter epoch. That secret salts the
 * dedup domain: it keys `messageKey = BLAKE3(plaintext, key = nexusSecret)` so (a) the same body seals to the same
 * cid ONLY within one Nexus (no cross-Nexus confirmation-of-file), and (b) an outsider lacking the secret cannot
 * precompute a suspected plaintext's cid. Content confidentiality rides the per-bag read-cap on the private keyhive
 * lane, so the secret's compromise grants only the insider confirmation-of-file the tier already accepts.
 *
 * ── THE NAME ────────────────────────────────────────────────────────────────────────────────────
 * A secret answers to (Nexus AID, `epochCid`): the charter's genesis epoch CID names the Nexus, and the seal
 * lineage's own epoch CID names the epoch. No counter names a secret. Two vessels that read one charter derive one
 * name with no shared clock and no agreed numbering, and a secret for one Nexus never answers for another.
 *
 * ── ONE NEXUS PER KEYRING ───────────────────────────────────────────────────────────────────────
 * A keyring holds one Nexus's secrets and refuses an entry that names another. `current()` answers the secret the
 * charter HEAD names, as this vessel reads its own charter; `forEpoch` answers any held epoch, so a body sealed
 * before this member joined still opens (read-all: a shared CAS lets every current member read every body).
 *
 * FAIL-CLOSED: a keyring that holds no secret for the head has NO `current()` → the seal installer throws → the
 * body stays local and unsealed (never a plaintext body registered as sealed). A `forEpoch` miss returns
 * `undefined` → the read helper throws by name → never a silent wrong-key derivation.
 *
 * NO-GLOBAL-NOW: the keyring reads as a member-LOCAL replica; the head names this vessel's own reading of the
 * charter, never a global present.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-convergence-keyring
 */

import { randomBytes } from "node:crypto";
import { require32, deriveMessageKey, canonicalKeyringEntry, keyringEntryName, hex, CONVERGENCE_SECRET_LEN } from "@lararium/mesh";

/** The scoped name of one convergence secret: the Nexus it salts and the charter epoch it belongs to. */
export interface NexusEpochName {
  /** The Nexus AID: the charter's genesis epoch CID, lower-cased. */
  readonly nexusAid: string;
  /** The seal lineage's CID for this epoch, lower-cased. */
  readonly epochCid: string;
}

/** One named convergence secret: its scoped name and its 32-byte salt (width-guarded at every boundary). */
export interface NexusEpochSecret extends NexusEpochName {
  readonly secret: Uint8Array;
}

/** One Nexus's convergence secrets as this member holds them. */
export interface NexusConvergenceKeyring {
  /** The Nexus every secret here salts. */
  readonly nexusAid: string;
  /** The secret the charter head names: the seal-time secret. THROWS when the head names none held (fail-closed). */
  current(): NexusEpochSecret;
  /** The salt for one epoch of this Nexus, or `undefined` when this member never received it (fail-closed read). */
  forEpoch(epochCid: string): Uint8Array | undefined;
  /** Every epoch CID held for this Nexus, in the order the entries arrived. */
  readonly epochCids: readonly string[];
}

/** The canonical spelling of a scoped name; THROWS on a part that carries no printable token. */
export function requireEpochName(name: NexusEpochName): NexusEpochName {
  const c = canonicalKeyringEntry({ ...name, secretHex: "00".repeat(CONVERGENCE_SECRET_LEN) });
  if (!c) throw new TypeError("nexus-convergence-keyring: a secret answers to a Nexus AID and an epoch CID, each one printable token");
  return { nexusAid: c.nexusAid, epochCid: c.epochCid };
}

/** The store key of a scoped name. */
export function epochNameKey(name: NexusEpochName): string {
  return keyringEntryName(requireEpochName(name));
}

/** The keyring row's file under the identity home (the carrier table's `keyring` row). */
export const NEXUS_KEYRING_FILE = ".nexus-convergence-secrets.json";

/** The keyring row's plaintext for a set of held secrets, in the order given. */
export function encodeNexusKeyringRow(entries: readonly NexusEpochSecret[]): Uint8Array {
  const secrets = entries.map((e) => ({ nexusAid: e.nexusAid, epochCid: e.epochCid, secretHex: hex(e.secret) }));
  return new TextEncoder().encode(JSON.stringify({ secrets }, null, 2));
}

/**
 * Mint a FRESH convergence secret under a scoped name: 32 CSPRNG bytes. The seat alone calls this, when its act
 * roots or rolls a charter epoch (never a boot, never per body, never per session): a new secret resets the dedup
 * domain, so it costs a charter act. The secret then rides the private lane to every member.
 */
export function mintNexusSecret(name: NexusEpochName): NexusEpochSecret {
  return { ...requireEpochName(name), secret: new Uint8Array(randomBytes(CONVERGENCE_SECRET_LEN)) };
}

/**
 * Stand one Nexus's keyring from the secrets a member holds for it. Each secret passes the ONE width guard
 * (`require32`); an entry that names another Nexus refuses, and so does one epoch named twice (a torn
 * distribution never settles by last-wins). `headEpochCid` names the charter head as this vessel reads it, or
 * `null` when it reads none. The keyring stays immutable.
 */
export function makeNexusConvergenceKeyring(args: {
  readonly nexusAid:     string;
  readonly headEpochCid: string | null;
  readonly entries:      Iterable<NexusEpochSecret>;
}): NexusConvergenceKeyring {
  const head = args.headEpochCid === null ? null : requireEpochName({ nexusAid: args.nexusAid, epochCid: args.headEpochCid });
  const nexusAid = requireEpochName({ nexusAid: args.nexusAid, epochCid: args.headEpochCid ?? "-" }).nexusAid;
  const byEpoch = new Map<string, Uint8Array>();
  for (const entry of args.entries) {
    const name = requireEpochName(entry);
    if (name.nexusAid !== nexusAid) {
      throw new TypeError(`nexus-convergence-keyring: an entry names Nexus ${name.nexusAid}; this keyring holds ${nexusAid} alone`);
    }
    require32(entry.secret, `nexusSecret@${name.epochCid}`);
    if (byEpoch.has(name.epochCid)) {
      throw new TypeError(`nexus-convergence-keyring: duplicate secret for epoch ${name.epochCid} — a torn distribution, refuse it`);
    }
    byEpoch.set(name.epochCid, entry.secret);
  }
  const epochCids = Object.freeze([...byEpoch.keys()]);
  return {
    nexusAid,
    current(): NexusEpochSecret {
      if (head === null) {
        throw new Error("nexus-convergence-keyring: the charter names no head epoch — no convergence secret to seal under (fail-closed)");
      }
      const secret = byEpoch.get(head.epochCid);
      if (secret === undefined) {
        throw new Error(`nexus-convergence-keyring: no secret held for the head epoch ${head.epochCid} — nothing seals until the seat's secret arrives (fail-closed)`);
      }
      return { nexusAid, epochCid: head.epochCid, secret };
    },
    forEpoch(epochCid: string): Uint8Array | undefined { return byEpoch.get(epochCid.trim().toLowerCase()); },
    epochCids,
  };
}

/**
 * Re-derive the message-locked read-cap for a body sealed at a NAMED epoch. Looks up the epoch's salt and
 * re-derives `messageKey = BLAKE3(plaintext, key = nexusSecret_epoch)`. A member MISSING that epoch's secret throws
 * by name — never a silent wrong-key derivation. A member walks this path to confirm or dedup a body whose
 * plaintext it already holds.
 */
export function readCapForEpoch(
  plaintext: Uint8Array,
  epochCid:  string,
  keyring:   NexusConvergenceKeyring,
): Uint8Array {
  const secret = keyring.forEpoch(epochCid);
  if (secret === undefined) {
    throw new Error(`nexus-convergence-keyring: no secret for epoch ${epochCid} of Nexus ${keyring.nexusAid} — this member cannot re-derive that body's read-cap (fail-closed)`);
  }
  return deriveMessageKey(plaintext, secret);
}
