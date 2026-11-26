/**
 * floor-rehome — THE DOOR THAT MOVES AN OLD FLOOR ROW: a hand at an unlocked place moves each accept the control document
 * still holds (the shape pin step 4 retired) into the place's accept home, once, with a receipt per Nexus.
 *
 * A DOOR ASKS; THE BOOT NEVER MOVES A ROW. No boot reads the old rows, copies them or deletes them: a silent boot move would
 * re-floor a place behind its back. Until a hand runs `lares vessel floor rehome`, the place mounts genesis and every status
 * line carries `floor-pin-unmoved` with that command. The old exact-shape reader lives HERE ALONE, and it burns with the next
 * pin step's branch.
 *
 * THE MOVE. For each old row: read it at its old exact shape (a torn row stays and names itself); check its manifest and
 * blobs still rest whole in this place's CAS (`bytes-absent` leaves the row); write the accept with `took` set to the heads
 * the board shows now (a causal witness, never a time); remove the old row. An accept already standing at that Nexus holds
 * (a hand accepted since), and the old row leaves under `superseded`. A second run finds no old row and lands nothing.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-tiers#/floor-accept
 */
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { ownEntry } from "./stored-value.js";
import {
  FLOOR_ACCEPT_KIND, floorAcceptTitle, readFloorAccept, readLocalFloor, tookOf, writeFloorAccept,
  type FloorAccept, type FloorAcceptHome,
} from "./floor-accept.js";

/** Where the retired rows rest in the control document, read by this door alone. */
const UNMOVED_PREFIX = `${CONTROL_HOME_ID}/floor-pin/`;
const UNMOVED_KIND = "floor-pin";
const UNMOVED_KEYS = ["kind", "nexus", "release", "manifest"] as const;
const HEX64 = /^[0-9a-f]{64}$/;

/** The status word a place carries while an old row waits in its control document; the cure names the door. */
export const FLOOR_PIN_UNMOVED = "floor-pin-unmoved" as const;
export const FLOOR_REHOME_CURE = "lares vessel floor rehome" as const;

/** The Nexuses whose old rows still wait in the control document (torn rows included: each names itself at the door). */
export function unmovedFloorRows(controlDoc: LarDoc | null | undefined): string[] {
  const out: string[] = [];
  for (const title of Object.keys(controlDoc?.tiddlers ?? {})) if (title.startsWith(UNMOVED_PREFIX)) out.push(title.slice(UNMOVED_PREFIX.length));
  return out.sort();
}

/** An old row at its exact retired shape, as an accept carrying `took`; null where it reads torn. */
function readUnmovedRow(text: string | null, nexus: string, took: readonly string[]): FloorAccept | null {
  if (text === null) return null;
  let v: unknown;
  try { v = JSON.parse(text); } catch { return null; }
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  const keys = Object.hasOwn(r, "local") ? [...UNMOVED_KEYS, "local"] : [...UNMOVED_KEYS];
  if (Object.keys(r).length !== keys.length || !keys.every((k) => Object.hasOwn(r, k))) return null;
  if (r["kind"] !== UNMOVED_KIND || r["nexus"] !== nexus) return null;
  if (!(r["release"] === null || (typeof r["release"] === "string" && HEX64.test(r["release"])))) return null;
  if (typeof r["manifest"] !== "string" || !HEX64.test(r["manifest"])) return null;
  const local = Object.hasOwn(r, "local") ? readLocalFloor(r["local"]) : undefined;
  if (local === null) return null;
  // The accept shape's own reader decides last: an old row moves only where it lands as a whole accept.
  return readFloorAccept({ kind: FLOOR_ACCEPT_KIND, nexus, release: r["release"], manifest: r["manifest"], took: tookOf(took), ...(local ? { local } : {}) }, nexus);
}

/** One Nexus's move, as the door's receipt line names it. */
export interface FloorRehomeReceipt {
  readonly nexus:    string;
  readonly act:      "moved" | "superseded" | "torn" | "bytes-absent";
  readonly manifest: string | null;
  readonly took:     readonly string[];
  readonly detail:   string;
}

/**
 * `lares vessel floor rehome`: move every old row once. `control` the control document (it opened: a hand at an unlocked
 * place); `accepts` the accept home (minted where none stood); `heads(nexus)` the heads the board shows now; `whole(manifest)`
 * null where the floor rests whole in this place's CAS, else why not. Answers one receipt per old row.
 */
export async function rehomeFloorRows(args: {
  readonly control: FloorAcceptHome;
  readonly accepts: FloorAcceptHome;
  readonly heads:   (nexus: string) => Promise<readonly string[]>;
  readonly whole:   (manifest: string) => Promise<string | null>;
}): Promise<FloorRehomeReceipt[]> {
  const receipts: FloorRehomeReceipt[] = [];
  for (const nexus of unmovedFloorRows(args.control.doc())) {
    const title = `${UNMOVED_PREFIX}${nexus}`;
    const took = await args.heads(nexus).catch(() => [] as readonly string[]);
    const accept = readUnmovedRow(tiddlerText(ownEntry(args.control.doc()?.tiddlers, title)), nexus, took);
    if (accept === null) {
      receipts.push({ nexus, act: "torn", manifest: null, took: [], detail: `the old row at ${nexus.slice(0, 12)}… fails its exact shape; it stays in the control document and moves nothing` });
      continue;
    }
    if (tiddlerText(ownEntry(args.accepts.doc()?.tiddlers, floorAcceptTitle(nexus))) !== null) {
      args.control.change((draft) => { if (Object.hasOwn(draft.tiddlers, title)) delete draft.tiddlers[title]; });
      receipts.push({ nexus, act: "superseded", manifest: accept.manifest, took: accept.took, detail: "an accept already stands in the accept home at this Nexus; it holds, and the old row leaves" });
      continue;
    }
    const absent = await args.whole(accept.manifest).catch((e: unknown) => e instanceof Error ? e.message : String(e));
    if (absent !== null) {
      receipts.push({ nexus, act: "bytes-absent", manifest: accept.manifest, took: accept.took, detail: `the floor ${accept.manifest.slice(0, 12)}… does not rest whole in this place's CAS (${absent}); the old row stays` });
      continue;
    }
    args.accepts.change((draft) => { writeFloorAccept(draft, accept); });
    args.control.change((draft) => { if (Object.hasOwn(draft.tiddlers, title)) delete draft.tiddlers[title]; });
    receipts.push({ nexus, act: "moved", manifest: accept.manifest, took: accept.took, detail: `moved into the accept home, took ${accept.took.length} head(s)` });
  }
  return receipts;
}
