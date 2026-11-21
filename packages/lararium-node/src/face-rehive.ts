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
 *   restored-prev     the row is another identity's and `….bin.prev` holds the face's own: the row moves aside and the
 *                     previous generation stands in its place (nothing is lost but the last overwrite).
 *   stood-from-seed   the row is another identity's and no own generation stands: the row moves aside and the face's next
 *                     boot stands its hive from its intact seed, archive-less, as a founding does; the archive floor then
 *                     writes the face's own new Archive. What the lost Archive alone held is gone.
 *
 * A row moved aside rests at `….bin.mismatch-<16 hex of its own digest>` under the face's key, on this vessel, and is never
 * deleted: the act writes the copy first and removes the row only once the copy stands, so a stop between leaves both.
 *
 * ── WHERE IT RUNS ───────────────────────────────────────────────────────────────────────────────────
 * Through the custody door's `rehive` frame alone (`custody-frames`), sent by `lares face rehive --face N` from a terminal
 * (the face's own route rides it), and only while the face stands SHUT: neither worn nor lit, its key closed in the seated
 * holder. The door opens the face's key for this act alone, outside the holder, so no composition hears the face open, no
 * sibling lights mid-act, and the key leaves memory when the act settles.
 */
import { createHash } from "node:crypto";
import { ArchiveIdentityMismatch, requireArchiveOf } from "@lararium/keyhive";
import { openFaceCarrier, removeFaceCarrier, writeFaceCarrier, type Credential, type CustodyIo, type FaceCustodyKey } from "@lararium/mesh";
import { faceCarrierFor, openFaceTree } from "./face-custody.js";
import { faceTreePath, readFaceIndexSync } from "./face-index.js";
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
  remove(file: string): Promise<void>;
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
};

const archiveFile = (digest: string): string => `veil-archive-g${digest}.bin`;

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
    const reading = await readAgainst(seed, standing);
    if (reading.own) throw new RehiveRefused("row-is-own", "this face's veil-archive row restores the face's own identity: there is nothing to rehive, and nothing moved");
    const aside = `${row}.mismatch-${createHash("sha256").update(standing).digest("hex").slice(0, 16)}`;
    const prev = await port.read(`${row}.prev`);
    const prevIsOwn = prev !== null && (await readAgainst(seed, prev).catch(() => ({ own: false as const }))).own;
    // THE COPY STANDS BEFORE THE ROW LEAVES: a stop between the two leaves both, and nothing is lost.
    await port.write(aside, standing);
    await port.remove(row);
    if (prevIsOwn) await port.write(row, prev!);
    return { outcome: prevIsOwn ? "restored-prev" : "stood-from-seed", foreignIdentity: reading.restored, ownIdentity: reading.seed, aside };
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
    write: (file, bytes) => writeFaceCarrier({ io: args.io, key: args.fck, treePath, carrier: carrier(file), plaintext: bytes }),
    async remove(file) { await removeFaceCarrier({ io: args.io, key: args.fck, treePath, carrier: carrier(file) }); },
  };
}

/**
 * The door's act: open face `ordinal`'s key under its own route, outside the holder, rehive it, and drop the key. The caller
 * has read the face shut (neither worn nor lit) before it asks.
 */
export async function rehiveShutFace(args: {
  readonly io: CustodyIo; readonly homes: CustodyHomes; readonly ordinal: number; readonly credentials: readonly Credential[];
}): Promise<RehiveOutcome> {
  const entry = readFaceIndexSync(args.homes.identity).faces[args.ordinal];
  if (entry === undefined || !("fcid" in entry)) throw new RehiveRefused("face-not-standing", `no face h${args.ordinal} stands on this vessel; nothing moved`);
  if (entry.group === null) throw new RehiveRefused("face-founding", `face h${args.ordinal} still stands mid-founding (no PersonaGroup yet); nothing moved`);
  const opened = await openFaceTree({ io: args.io, homes: args.homes, fcid: entry.fcid, credentials: args.credentials });
  if (opened.reading !== "opens") {
    throw new RehiveRefused(opened.reading === "no-slot-opens" ? "face-refused" : opened.reading, opened.reading === "no-slot-opens"
      ? `no route of face h${args.ordinal} opens under what was presented; nothing moved`
      : `the slot tree of face h${args.ordinal} reads ${opened.reading}; nothing moved`);
  }
  try {
    const port = faceRowPortOf({ io: args.io, homes: args.homes, fcid: entry.fcid, fck: opened.fck });
    const out = await rehiveFaceRows(port, entry.group);
    // The face's PersonaGroup names it to the reach checks the operator runs next (`lares nexus cabal standing <group>`).
    const anchors = await port.read(`anchors-h${args.ordinal}.json`).catch(() => null);
    let personaGroup: string | null = null;
    try { personaGroup = anchors ? (JSON.parse(new TextDecoder().decode(anchors)) as { personaGroupId?: unknown }).personaGroupId as string ?? null : null; } catch { personaGroup = null; }
    return { ...out, personaGroup: typeof personaGroup === "string" ? personaGroup : null };
  } finally {
    opened.fck.fill(0);
  }
}
