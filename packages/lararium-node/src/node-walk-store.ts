/**
 * node-walk-store — a node vessel WALKS like any leaf (operator-ruled): it keeps, per hearth it walks at, the
 * carried invite until it settles, the grant that hearth pushed, its wallet, its receipts and where that hearth's
 * relay answers. One row per hearth, sealed under the vessel key, never federated.
 *
 * The hearth's sorter reads only what a socket presents, never what kind of device it is, so a node walks on the
 * one platform-blind walk client (`walk-client`, mesh) exactly as a browser does. Walking grants the node no carry
 * duty and touches its own Nexus not at all: the record names the hearth's Nexus and nothing of this vessel's.
 *
 * ── A SECRET ROW ────────────────────────────────────────────────────────────────────────────────
 * A record holds unspent bearer invites, the hearth's grant, and one receipt per carried document
 * (`{ cid: "blake3:<hex>", ref, key }`, where `key` opens that document). So each record rests as a HOT row under
 * the vessel key (`walk/<digest of the hearth's gate key>.json`), and the file's own name says nothing a reader
 * could dial. A vessel at the floor reads no walk record and presents no walk.
 *
 * ── THE ROW RESTS IN THE CUSTODY HOME ───────────────────────────────────────────────────────────
 * A walk row rests where every sealed row of this vessel rests: under the storage home of the custody seat. The
 * store takes no directory. Whatever directory a Repo's storage adapter got handed, the row resolves through the
 * seat alone, so no caller files a secret row beside a document store the vessel key never spans.
 *
 * ── A ROW READS WHOLE OR REFUSES ────────────────────────────────────────────────────────────────
 * Nothing at a hearth's path reads as no walk there. A row that stands and does not open (another key's seal, a
 * torn file, bare bytes, another shape, a record filed under another hearth's name) refuses by name at the read,
 * at the list and at the update: a wallet never gets written over a record nobody could read. An update writes a
 * whole record or refuses.
 *
 * ── ONE HAND AT A TIME ──────────────────────────────────────────────────────────────────────────
 * `update` reads the standing row, decides and seals under ONE custody holder (`updateCustodyRow`), so no other
 * writer in any process lands between the read and the write.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-invite
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { decodeInvite, isWalkRecord, sha256HexSync, type WalkRecord, type WalkStore } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { openedCustody, readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { ownerOnlyDir } from "./fs-atomic.js";

const WALK_FILE = /^[0-9a-f]{32}\.json$/;

/** The row one hearth's walk record rests in, relative to the storage home: keyed by a digest of its gate key. */
export function walkRowFile(gatePubKey: string): string {
  return `walk/${sha256HexSync(gatePubKey.toLowerCase()).slice(0, 32)}.json`;
}

interface WalkFile { readonly gatePubKey: string; readonly record: WalkRecord }

/** The `walk/` directory under the storage home of the custody this vessel holds open. */
async function walkDir(): Promise<string> {
  return join((await openedCustody()).homes.storage, "walk");
}

/**
 * Whether a whole record AGREES with the hearth its row names: a carried invite names that hearth's gate key and
 * the record's Nexus, and a grant names the record's Nexus. A record that disagrees would present another
 * hearth's token on this hearth's dial, or derive a leaf for another Nexus.
 */
function agrees(gate: string, record: WalkRecord): boolean {
  const nexus = record.nexusAid.toLowerCase();
  if (record.invite !== undefined) {
    const invite = decodeInvite(record.invite);
    if (!invite || invite.gatePubKey.toLowerCase() !== gate || invite.nexusAid.toLowerCase() !== nexus) return false;
  }
  return record.grant === undefined || record.grant.nexusAid.toLowerCase() === nexus;
}

/** A hearth this vessel does not walk at holds a row while a take for another hearth commits. */
export class WalksElsewhere extends Error {
  override readonly name = "WalksElsewhere";
  constructor() { super("another hearth's walk record stands: a vessel walks at one hearth"); }
}

/** A row's plaintext as a whole walk record filed under its own hearth; any other shape refuses `malformed`. */
function parseWalkFile(bytes: Uint8Array, file: string): WalkFile {
  const malformed = (): CustodyRowUnavailable => new CustodyRowUnavailable("storage", file, "malformed");
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw malformed(); }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw malformed();
  const { gatePubKey, record, ...rest } = raw as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || typeof gatePubKey !== "string" || !isWalkRecord(record)) throw malformed();
  // The row's name derives from the hearth it names: a record filed under another hearth's name refuses.
  if (gatePubKey !== gatePubKey.toLowerCase() || walkRowFile(gatePubKey) !== file) throw malformed();
  if (!agrees(gatePubKey, record)) throw malformed();
  return { gatePubKey, record };
}

/**
 * The walk store over this vessel's own sealed rows. `oneHearth` makes each update refuse `WalksElsewhere` when a
 * row for any OTHER hearth stands: the check reads the `walk/` directory inside the same custody hold that seals
 * the row, so two takes for two hearths, in one process or in two, keep one hearth.
 */
export function nodeWalkStore(opts: { readonly oneHearth?: boolean } = {}): WalkStore {
  return {
    async read(gatePubKey) {
      const file = walkRowFile(gatePubKey);
      const bytes = await readCustodyRow("storage", file);
      return bytes === null ? null : parseWalkFile(bytes, file).record;
    },
    async update(gatePubKey, decide) {
      const gate = gatePubKey.toLowerCase();
      const file = walkRowFile(gate);
      const dir = await walkDir();
      ownerOnlyDir(dir);
      return updateCustodyRow<WalkRecord | null>("storage", file, (standing) => {
        const next = decide(standing === null ? null : parseWalkFile(standing, file).record);
        if (next === null) return { plaintext: null, value: null };
        // The row takes a whole record that agrees with its hearth, so the next read opens what this write sealed.
        if (!isWalkRecord(next) || !agrees(gate, next)) throw new Error(`[node-walk-store] the walk record for ${file} reads malformed; nothing sealed`);
        // A row's name alone says a hearth stands there, readable or not: a take never lands beside one.
        if (opts.oneHearth && readdirSync(dir).some((name) => WALK_FILE.test(name) && `walk/${name}` !== file)) throw new WalksElsewhere();
        const row: WalkFile = { gatePubKey: gate, record: next };
        return { plaintext: new TextEncoder().encode(JSON.stringify(row)), value: next };
      });
    },
  };
}

/**
 * Every hearth this vessel walks at: its gate key and its record, ascending by gate key. No `walk/` directory
 * reads as walking nowhere; a directory that stands and refuses its listing refuses the list by name, and so does
 * a row that stands and does not read whole. A file no walk row could carry (a sidecar, a stray name) reads as no
 * hearth, and a row that left between the listing and its read reads as the absence it became.
 */
export async function listWalkRecords(): Promise<ReadonlyArray<{ readonly gatePubKey: string; readonly record: WalkRecord }>> {
  const dir = await walkDir();                                 // a locked seat refuses here, by its own name
  let names: string[];
  try { names = readdirSync(dir); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new CustodyRowUnavailable("storage", "walk", `unlistable (${(err as NodeJS.ErrnoException).code ?? "unreadable"})`);
  }
  const out: WalkFile[] = [];
  for (const name of names.filter((n) => WALK_FILE.test(n)).sort()) {
    const file = `walk/${name}`;
    const bytes = await readCustodyRow("storage", file);
    if (bytes !== null) out.push(parseWalkFile(bytes, file));
  }
  return out.sort((a, b) => a.gatePubKey.localeCompare(b.gatePubKey));
}
