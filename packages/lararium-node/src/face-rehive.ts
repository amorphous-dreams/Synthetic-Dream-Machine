/**
 * face-rehive — a face whose veil-archive row holds ANOTHER identity's Archive stands its hive again from its own seed.
 *
 * ── WHAT A REHIVE DOES ──────────────────────────────────────────────────────────────────────────────
 * A face's atom seed IS its Keyhive identity; its veil archive carries that identity's prekey secrets, its key-agreement
 * (CGKA) and membership state, and the card it last presented. A row that restores another identity refuses every boot of
 * the face (`ArchiveIdentityMismatch`), and no write can cure it, since the seal proves each write against the seed
 * (`persistVeilArchive`). The rehive reads the row against the seed and:
 *
 *   row-is-own        the row restores the face's own identity: nothing moves, and the act refuses by name.
 *   restored-prev     the row is another identity's and `….bin.prev` holds the face's own: the row's bytes rest aside and the
 *                     previous generation replaces the row (nothing is lost but the last overwrite).
 *   stood-from-seed   the row is another identity's and no own generation stands: the row's bytes rest aside and the rehive's
 *                     marker replaces the row, which every reader takes for no Archive, so the face's next boot stands its hive
 *                     from its intact seed and the archive floor writes the face's own new Archive.
 *
 * ── NOTHING HALF-DONE ───────────────────────────────────────────────────────────────────────────────
 * The foreign bytes seal aside first, at `….bin.mismatch-<16 hex of their own digest>` (never deleted, and the same name on a
 * retry). Then ONE compare-and-replace seals the row's next bytes (the proven `.prev`, or the marker) only where the row still
 * holds exactly the bytes copied aside: a write that landed between refuses `row-moved` and nothing more moves. A stop between
 * the two steps leaves the foreign row whole beside its copy, and a retry finishes the act; a retry over the marker reads the
 * rehive as done and answers it again. The row is never absent mid-act.
 *
 * ── WHERE IT RUNS ───────────────────────────────────────────────────────────────────────────────────
 * Through the custody door's `rehive` frame alone (`custody-frames`), sent by `lares vault rehive --face N` from a person's
 * terminal, only on a vessel that holds its own custody (never under a pūlama, whose custody rests elsewhere and lights faces
 * on its own hand), and only while the face stands SHUT. The holder opens the face's key for this act alone
 * (`openFaceForAct`): the face's own per-boot attempt budget, its sealed `face-owner` row and its anchors read against the floor
 * index FIRST, and the key and custody id come back bound together, so every row the act touches is that one face's.
 */
import { createHash } from "node:crypto";
import { ArchiveIdentityMismatch, requireArchiveOf } from "@lararium/keyhive";
import { openFaceCarrier, updateFaceCarrier, writeFaceCarrier, type CustodyIo } from "@lararium/mesh/sealed-writer";
import { type Credential } from "@lararium/mesh/keyslot-door";
import { type FaceCustodyKey } from "@lararium/mesh/fck";
import type { CustodyHolder } from "./custody-holder.js";
import { faceCarrierFor } from "./face-custody.js";
import { faceDir, faceTreePath } from "./face-index.js";
import { rehiveMarker, rehiveMarkerAside } from "./identity-anchors.js";
import { carrierTable, type CustodyHomes } from "./vault-carriers.js";

/** A rehive that moved nothing, by name. */
export class RehiveRefused extends Error {
  override readonly name = "RehiveRefused";
  constructor(readonly reason: string, message: string) { super(message); }
}

/** One face's rows, read and written under that face's key: the rehive's whole reach. */
export interface FaceRowPort {
  read(file: string): Promise<Uint8Array | null>;
  write(file: string, bytes: Uint8Array): Promise<void>;
  /** The names of the files standing in this face's directory. */
  list(): Promise<readonly string[]>;
  /** Seal `next` over `file` only where it holds exactly `expected` now, in one step; else refuse `row-moved`. */
  replace(file: string, expected: Uint8Array, next: Uint8Array): Promise<void>;
}

export type RehiveOutcome = {
  readonly outcome: "restored-prev" | "stood-from-seed";
  /** The identity the moved row restores (the first 20 hex of its key), and the face's own, off its seed. */
  readonly foreignIdentity: string;
  readonly ownIdentity: string;
  /** Where the moved row rests now, in the face's own directory. */
  readonly aside: string;
  /** The face's PersonaGroup, off its own anchors row (null where that row stands absent). */
  readonly personaGroup?: string | null;
  /** True where this answer finished, or re-read, a rehive an earlier run began. */
  readonly resumed?: boolean;
};

const archiveFile = (digest: string): string => `veil-archive-g${digest}.bin`;
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The identity an Archive restores against `seed`: `own`, or the mismatch naming both. Any other fault throws. */
async function readAgainst(seed: Uint8Array, bytes: Uint8Array): Promise<{ readonly own: true } | { readonly own: false; readonly restored: string; readonly seed: string }> {
  try { await requireArchiveOf(seed, bytes); return { own: true }; }
  catch (error) {
    if (error instanceof ArchiveIdentityMismatch) return { own: false, restored: error.restored, seed: error.seed };
    throw error;
  }
}

/** The rehive over one face's rows, named by its PersonaGroup digest. */
export async function rehiveFaceRows(port: FaceRowPort, groupDigest: string): Promise<RehiveOutcome> {
  const row = archiveFile(groupDigest);
  const seed = await port.read(`face-atom-g${groupDigest}.bin`);
  if (!seed || seed.length !== 32) throw new RehiveRefused("face-holds-no-atom", "this face holds no atom seed, so no identity stands to rehive from; nothing moved");
  try {
    const standing = await port.read(row);
    if (!standing) throw new RehiveRefused("row-absent", "this face keeps no veil-archive row: its next boot already stands its hive from its seed; nothing moved");
    // A RETRY OVER THE MARKER reads the rehive as done: the aside it names holds the foreign bytes, whole.
    const marked = rehiveMarkerAside(standing);
    if (marked !== null) {
      const kept = await port.read(marked);
      if (!kept) throw new RehiveRefused("aside-absent", `the rehive's marker names ${marked}, and no row stands there`);
      const reading = await readAgainst(seed, kept);
      if (reading.own) throw new RehiveRefused("aside-is-own", `the row set aside at ${marked} restores the face's own identity; read it before anything moves again`);
      return { outcome: "stood-from-seed", foreignIdentity: reading.restored, ownIdentity: reading.seed, aside: marked, resumed: true };
    }
    const reading = await readAgainst(seed, standing);
    if (reading.own) {
      // A RETRY OVER THE SWAP: a run that died after the replace and before its answer left the own row beside the aside it sealed.
      for (const name of (await port.list()).filter((n) => n.startsWith(`${row}.mismatch-`)).sort()) {
        const kept = await port.read(name);
        const other = kept ? await readAgainst(seed, kept).catch(() => null) : null;
        if (other && !other.own) return { outcome: "restored-prev", foreignIdentity: other.restored, ownIdentity: other.seed, aside: name, resumed: true };
      }
      throw new RehiveRefused("row-is-own", "this face's veil-archive row restores the face's own identity: there is nothing to rehive, and nothing moved");
    }
    const aside = `${row}.mismatch-${createHash("sha256").update(standing).digest("hex").slice(0, 16)}`;
    const prev = await port.read(`${row}.prev`);
    const prevIsOwn = prev !== null && (await readAgainst(seed, prev).catch(() => ({ own: false as const }))).own;
    // THE COPY STANDS BEFORE THE ROW CHANGES; an aside a stopped run already sealed is the same name and the same bytes.
    const already = await port.read(aside);
    if (already && !same(already, standing)) throw new RehiveRefused("aside-differs", `${aside} already holds other bytes than the row's (a name collision or a damaged copy); read it before anything moves again, and nothing moved`);
    if (!already) await port.write(aside, standing);
    // ONE STEP replaces the row, and only over the bytes just copied aside.
    await port.replace(row, standing, prevIsOwn ? prev! : rehiveMarker(aside));
    return { outcome: prevIsOwn ? "restored-prev" : "stood-from-seed", foreignIdentity: reading.restored, ownIdentity: reading.seed, aside, ...(already ? { resumed: true } : {}) };
  } finally {
    seed.fill(0);
  }
}

/** One face's row port under its custody key, outside every holder: each file names a row of the carrier table. */
export function faceRowPortOf(args: { readonly io: CustodyIo; readonly homes: CustodyHomes; readonly fcid: string; readonly fck: FaceCustodyKey }): FaceRowPort {
  const treePath = faceTreePath(args.homes.identity, args.fcid);
  const carrier = (file: string) => {
    const row = carrierTable().find((r) => r.faceRecord !== undefined && r.custody !== "ward-cold" && r.faceRecord.inner.test(file));
    if (!row) throw new RehiveRefused("row-unknown", `no face row of the carrier table names ${file}`);
    return faceCarrierFor(args.homes, args.fcid, file, row);
  };
  return {
    async read(file) {
      const opened = await openFaceCarrier({ io: args.io, key: args.fck, carrier: carrier(file) });
      if (opened.reading === "opens") return opened.plaintext;
      if (opened.reading === "absent") return null;
      throw new RehiveRefused("row-unavailable", `the face row ${file} reads ${opened.reading}; nothing moved`);
    },
    async list() {
      const dir = faceDir(args.homes.identity, args.fcid);
      return (await args.io.list()).filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)).filter((n) => !n.includes("/"));
    },
    write: (file, bytes) => writeFaceCarrier({ io: args.io, key: args.fck, treePath, carrier: carrier(file), plaintext: bytes }),
    async replace(file, expected, next) {
      await updateFaceCarrier({
        io: args.io, key: args.fck, treePath, carrier: carrier(file),
        decide: (standing) => {
          if (standing.reading !== "opens" || !same(standing.plaintext, expected)) throw new RehiveRefused("row-moved", `the face row ${file} changed after it was read; the copy stands aside and nothing more moved`);
          return { plaintext: next, value: undefined };
        },
      });
    },
  };
}

/**
 * The door's act: the holder opens face `ordinal`'s key for this act alone (budget, `face-owner` and anchors read first, the
 * key bound to the custody id they read), the rehive runs over that one face's rows, and the key leaves memory. The caller has
 * read the face shut (neither worn nor lit) and holds the door's one chain, so no unlock or wear of this vessel opens it meanwhile.
 */
export async function rehiveShutFace(args: {
  readonly holder: CustodyHolder; readonly io: CustodyIo; readonly ordinal: number; readonly credentials: readonly Credential[];
}): Promise<RehiveOutcome> {
  if (!args.holder.openFaceForAct) throw new RehiveRefused("rehive-unavailable", "this vessel's custody rests elsewhere: rehive the face where its custody rests");
  const opened = await args.holder.openFaceForAct({ ordinal: args.ordinal }, args.credentials);
  if (opened.reading !== "opens") {
    const reason = opened.reading === "no-slot-opens" ? "face-refused" : opened.reading === "already-unlocked" ? "face-open" : opened.reading === "face-absent" ? "face-not-standing" : opened.reading;
    const detail = opened.reading === "no-slot-opens" ? ` (${opened.attemptsLeft} attempt(s) left this boot for this face)` : opened.reading === "index-mismatch" ? `: ${opened.why}` : "";
    throw new RehiveRefused(reason, `face h${args.ordinal} did not open for the rehive (${opened.reading}${detail}); nothing moved`);
  }
  try {
    if (opened.groupDigest === null) throw new RehiveRefused("face-founding", `face h${args.ordinal} still stands mid-founding (no PersonaGroup yet); nothing moved`);
    const port = faceRowPortOf({ io: args.io, homes: args.holder.homes, fcid: opened.fcid, fck: opened.fck });
    // THE FACE'S OWN ANCHORS, read before anything moves (the holder already read them against the floor index).
    const anchors = await port.read(`anchors-h${args.ordinal}.json`);
    let personaGroup: string | null = null;
    try { const g = anchors ? (JSON.parse(new TextDecoder().decode(anchors)) as { personaGroupId?: unknown }).personaGroupId : null; personaGroup = typeof g === "string" ? g : null; } catch { personaGroup = null; }
    // THE ORDINAL STANDS PROVED or nothing moves: the anchors row at hN must stand and name the group this custody holds.
    if (personaGroup === null || createHash("sha256").update(personaGroup).digest("hex") !== opened.groupDigest) {
      throw new RehiveRefused("index-mismatch", `face h${args.ordinal}'s anchors ${personaGroup === null ? "stand absent" : "name another group than its custody"}, so nothing proves the handle names this face; nothing moved`);
    }
    const out = await rehiveFaceRows(port, opened.groupDigest);
    return { ...out, personaGroup };
  } finally {
    opened.fck.fill(0);
  }
}
