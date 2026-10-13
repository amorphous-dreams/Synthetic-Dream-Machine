/**
 * nexus-convergence-secret-store — the vessel's CUSTODY of its per-Nexus convergence secrets (the cad seal's key
 * source): one sealed row that holds every secret this vessel carries, each named by (Nexus AID, `epochCid`).
 *
 * ── AT REST ─────────────────────────────────────────────────────────────────────────────────────
 * The row rests sealed under the vessel key and passes through the custody seat (`custody-seat`): the one sealed
 * writer on the way down, the sealed open on the way up. At the floor every door here refuses `CustodyLocked`.
 * A mint and a join each read, decide and write under ONE custody holder (`updateCustodyRow`), so two acts in two
 * processes never write over each other's entry.
 *
 * ── A ROW READS WHOLE OR REFUSES ────────────────────────────────────────────────────────────────
 * The custody's founding seals this row holding no secret (`custody-session`), so the row stands for the vessel's
 * whole life. Nothing at its path therefore reads as a LOSS and refuses `absent`, exactly as a row that stands and
 * does not open (torn, bare, another key's) refuses, and as one that opens to another shape, one malformed entry,
 * or one name held twice. No reader folds a refusal to empty, so nothing mints or joins over a row it could not
 * read, and a vessel that lost its row never mints a second secret under a name its members hold.
 *
 * ── MINT ONLY AT THE SEAT ───────────────────────────────────────────────────────────────────────
 * `mintNexusEpochSecret` mints a secret under a name this vessel holds none for, and the act that roots or rolls a
 * charter epoch alone calls it. Under a name already held it changes nothing. No boot, reader or delivery mints.
 * NOTHING TAKES A SECRET BACK. A seat mints before its charter moves, so an act that refuses or dies after the
 * mint leaves a secret no epoch names yet. That secret seals nothing (a keyring seals under the verified charter
 * head alone), and an epoch CID content-addresses its own fields, so the same act run again finds the secret
 * standing under the very name it derives and mints nothing. No door removes an entry: a second act that adopted
 * a standing secret never loses it to the first act's retreat.
 *
 * ── A DELIVERY JOINS BY SCOPED NAME ─────────────────────────────────────────────────────────────
 * `installDeliveredKeyring` adds the delivered secrets whose names this vessel holds none for. The same bytes
 * under a held name change nothing. Different bytes under a held name refuse the WHOLE delivery
 * (`NexusKeyringConflict`) and the held value stays: two secrets under one name mean two dedup domains wearing one
 * Nexus's name, and no arrival order settles that. A delivery for one Nexus never touches another's entries.
 *
 * NO-GLOBAL-NOW: the row reads as this vessel's own replica, never a global truth of a Nexus's secrets.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/nexus-convergence-secret-store
 */

import { hex, hexToBytes, canonicalKeyringEntry, type KeyringEntryWire } from "@lararium/mesh";
import {
  mintNexusSecret, makeNexusConvergenceKeyring, epochNameKey, requireEpochName, encodeNexusKeyringRow, NEXUS_KEYRING_FILE,
  type NexusEpochName, type NexusEpochSecret, type NexusConvergenceKeyring,
} from "./nexus-convergence-keyring.js";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";

export { NEXUS_KEYRING_FILE };

/** A delivery that carries different bytes under a name this vessel already holds a secret for. */
export class NexusKeyringConflict extends Error {
  override readonly name = "NexusKeyringConflict";
  constructor(readonly conflicts: readonly NexusEpochName[]) {
    super(`a delivered keyring carries different bytes under ${conflicts.length} held name(s) ` +
      `(${conflicts.map((c) => `${c.nexusAid.slice(0, 18)}… @ ${c.epochCid.slice(0, 18)}…`).join(", ")}); ` +
      "nothing joined and every held secret stays");
  }
}

const malformed = (): CustodyRowUnavailable => new CustodyRowUnavailable("identity", NEXUS_KEYRING_FILE, "malformed");

/** The held secrets a row's plaintext carries, in file order. Nothing standing, and every other shape, refuses. */
function parseRow(bytes: Uint8Array | null): NexusEpochSecret[] {
  if (bytes === null) throw new CustodyRowUnavailable("identity", NEXUS_KEYRING_FILE, "absent");
  let raw: unknown;
  try { raw = (JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as { secrets?: unknown }).secrets; }
  catch { throw malformed(); }
  if (!Array.isArray(raw)) throw malformed();
  const out: NexusEpochSecret[] = [];
  const names = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) throw malformed();
    const entry = canonicalKeyringEntry(item as Record<string, unknown>);
    if (!entry) throw malformed();
    const key = epochNameKey(entry);
    if (names.has(key)) throw malformed();
    names.add(key);
    out.push({ nexusAid: entry.nexusAid, epochCid: entry.epochCid, secret: hexToBytes(entry.secretHex) });
  }
  return out;
}

async function readStored(): Promise<NexusEpochSecret[]> {
  return parseRow(await readCustodyRow("identity", NEXUS_KEYRING_FILE));
}

/**
 * Read the row, decide over its held secrets, and write it, as ONE custody holder (`updateCustodyRow`): no mint
 * or join in any process lands between this act's read and its write. `decide` answers the next set, or
 * `null` to leave the row as it stands.
 */
function updateStored<T>(decide: (held: NexusEpochSecret[]) => { readonly next: readonly NexusEpochSecret[] | null; readonly value: T }): Promise<T> {
  return updateCustodyRow("identity", NEXUS_KEYRING_FILE, (bytes) => {
    const { next, value } = decide(parseRow(bytes));
    return { plaintext: next === null ? null : encodeNexusKeyringRow(next), value };
  });
}

/** Every secret this vessel holds, across every Nexus, as wire entries: what an admission delivers. */
export async function heldNexusKeyringEntries(): Promise<KeyringEntryWire[]> {
  return (await readStored()).map((e) => ({ nexusAid: e.nexusAid, epochCid: e.epochCid, secretHex: hex(e.secret) }));
}

/**
 * One Nexus's keyring as this vessel holds it, or `null` when it holds no secret for that Nexus. `headEpochCid`
 * names the charter head as this vessel reads it. Mints nothing.
 */
export async function loadNexusKeyring(a: { readonly nexusAid: string; readonly headEpochCid: string | null }): Promise<NexusConvergenceKeyring | null> {
  const nexusAid = requireEpochName({ nexusAid: a.nexusAid, epochCid: a.headEpochCid ?? "-" }).nexusAid;
  const entries = (await readStored()).filter((e) => e.nexusAid === nexusAid);
  return entries.length > 0 ? makeNexusConvergenceKeyring({ nexusAid, headEpochCid: a.headEpochCid, entries }) : null;
}

/**
 * THE SEAT'S MINT. Mint and seal a secret under `name` when this vessel holds none for it; `minted` answers
 * whether a secret got made. Under a held name nothing changes and no byte moves.
 */
export function mintNexusEpochSecret(name: NexusEpochName): Promise<{ readonly minted: boolean }> {
  const wanted = requireEpochName(name);
  const key = epochNameKey(wanted);
  return updateStored<{ readonly minted: boolean }>((held) => held.some((e) => epochNameKey(e) === key)
    ? { next: null, value: { minted: false } }
    : { next: [...held, mintNexusSecret(wanted)], value: { minted: true } });
}

/**
 * Join a keyring DELIVERED at admission (the opened `KeyringEnvelope` entries) into this vessel's row, by scoped
 * name. `joined` counts the names that landed; `held` counts the delivered names this vessel now holds. A malformed
 * entry, or one name carried twice, refuses before anything lands. Different bytes under a held name refuse the
 * whole delivery (`NexusKeyringConflict`). A delivery that adds nothing writes nothing.
 */
export function installDeliveredKeyring(delivered: readonly KeyringEntryWire[]): Promise<{ readonly joined: number; readonly held: number }> {
  const incoming = new Map<string, NexusEpochSecret>();
  for (const raw of delivered) {
    const entry = canonicalKeyringEntry(raw);
    if (!entry) throw new TypeError("installDeliveredKeyring: a delivered entry reads malformed — nothing joins");
    const key = epochNameKey(entry);
    if (incoming.has(key)) throw new TypeError("installDeliveredKeyring: one (Nexus AID, epoch CID) name rides twice in this delivery — nothing joins");
    incoming.set(key, { nexusAid: entry.nexusAid, epochCid: entry.epochCid, secret: hexToBytes(entry.secretHex) });
  }
  return updateStored((held) => {
    const byName = new Map(held.map((e) => [epochNameKey(e), e] as const));
    const conflicts: NexusEpochName[] = [];
    const fresh: NexusEpochSecret[] = [];
    for (const [key, entry] of incoming) {
      const standing = byName.get(key);
      if (standing === undefined) fresh.push(entry);
      else if (hex(standing.secret) !== hex(entry.secret)) conflicts.push({ nexusAid: entry.nexusAid, epochCid: entry.epochCid });
    }
    if (conflicts.length > 0) throw new NexusKeyringConflict(conflicts);
    return { next: fresh.length > 0 ? [...held, ...fresh] : null, value: { joined: fresh.length, held: incoming.size } };
  });
}
