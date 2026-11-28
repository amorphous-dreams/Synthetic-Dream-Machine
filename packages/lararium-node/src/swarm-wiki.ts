/**
 * swarm-wiki — the swarm's records as ONE sealed custody row on this vessel (`swarm-records.json`), never a document.
 *
 * A swarm record (a lei and its returns, an unstringing, a tessera's halves, the lane board's rows) is custody testimony: it
 * rests where the vessel's custody holder seals it, under the device key, hot. A vessel riding a pūlama asks that row of the
 * pūlama's own holder, so the record rests among the pūlama's sealed records; a standing vessel's own holder seals it alike.
 * No Repo announces the row and no fleet syncs it, so no swarm control reaches a peer or a mirror by placement.
 *
 * `writeNew` claims a title inside ONE read-decide-write under the holder, so two racing writers land exactly one. A row
 * that opens and reads malformed refuses by name: no reader folds a refusal to empty, so no writer mints over it.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { SwarmWikiPort } from "@lararium/mesh/swarm-tiddlers";
import { readCustodyRecord, updateCustodyRecord } from "./custody-seat.js";

/** The custody row the swarm's records rest in (identity home, hot, sealed under the device key). */
export const SWARM_RECORDS_FILE = "swarm-records.json";

/** The row opened and held no map of swarm records. */
export class SwarmRecordsMalformed extends Error {
  override readonly name = "SwarmRecordsMalformed";
  constructor(readonly reason: string) { super(`swarm-records-malformed: the swarm-records row ${reason}; set the row aside by hand to start it afresh`); }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function parse(bytes: Uint8Array | null): Map<string, string> {
  if (bytes === null) return new Map();
  let read: unknown;
  try { read = JSON.parse(dec.decode(bytes)); } catch { throw new SwarmRecordsMalformed("reads no JSON"); }
  if (!Array.isArray(read) || !read.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "string" && typeof p[1] === "string")) {
    throw new SwarmRecordsMalformed("holds no list of [title, text] pairs");
  }
  return new Map(read as Array<[string, string]>);
}

const encode = (rows: Map<string, string>): Uint8Array => enc.encode(JSON.stringify([...rows].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));

/** The swarm's wiki port over the vessel's sealed custody row. */
export function custodySwarmWiki(): SwarmWikiPort {
  const rows = async (): Promise<Map<string, string>> => parse(await readCustodyRecord("identity", SWARM_RECORDS_FILE));
  return {
    // A Map keyed by title answers no inherited member, so a prototype-keyed title reads absent.
    read: async (title) => (await rows()).get(title) ?? null,
    write: async (title, text) => {
      await updateCustodyRecord("identity", SWARM_RECORDS_FILE, (plaintext) => {
        const standing = parse(plaintext);
        if (standing.get(title) === text) return { plaintext: null, value: undefined };
        standing.set(title, text);
        return { plaintext: encode(standing), value: undefined };
      });
    },
    writeNew: (title, text) => updateCustodyRecord("identity", SWARM_RECORDS_FILE, (plaintext) => {
      const standing = parse(plaintext);
      if (standing.has(title)) return { plaintext: null, value: false };
      standing.set(title, text);
      return { plaintext: encode(standing), value: true };
    }),
    list: async (prefix) => [...(await rows()).keys()].filter((title) => title.startsWith(prefix)),
  };
}
