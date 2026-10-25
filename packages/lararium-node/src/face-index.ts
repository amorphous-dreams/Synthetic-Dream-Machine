/**
 * face-index — THE FLOOR INDEX OF FACES: the one F row that names the faces a node can unlock before any face opens.
 *
 * It rests in the identity home in the clear, in local face order. Each entry is a face (`fcid`, the PersonaGroup's
 * digest or null while a founding stands, the founding ask's digest or null once the group stands) or a tombstone, so a
 * removed face never moves another face's ordinal. The `fcid` is the face custody id: a random 16-byte id minted with
 * the face's slot tree, the immutable owner in every D carrier context, and the name of the face's own directory.
 *
 * ── THE ACCEPTED LEAK, AND ONLY IT ──────────────────────────────────────────────────────────────
 * The count of faces (tombstones included), each group's digest, each founding ask's digest and each random directory
 * name. The reader refuses any other field, so no name, handle, prefix, label or key byte can ride the index.
 *
 * ── THE INDEX ROUTES AND NEVER DECIDES ──────────────────────────────────────────────────────────
 * It is unauthenticated. After a face unlocks, the face's own D `face-owner` row names its fcid and group; the holder
 * compares both with the index entry and refuses by name on a mismatch before it seats anything (`custody-holder`).
 *
 * Contract: lar:///ha.ka.ba/lares/docs/pono/k15-custody-step-zero#/the-floor-index
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CustodyIo } from "@lararium/mesh";

export const FACE_INDEX_FILE = "face-index.json";
export const FACES_DIR = "faces";
export const FACE_TREE_FILE = "fk-slots.bin";

const FCID = /^[0-9a-f]{32}$/;
const DIGEST = /^[0-9a-f]{64}$/;

export type FaceIndexEntry =
  | { readonly fcid: string; readonly group: string | null; readonly ask: string | null }
  | { readonly tombstone: true };
export interface FaceIndex { readonly faces: readonly FaceIndexEntry[] }

/** An index that reads torn or carries a field the contract does not allow. */
export class FaceIndexRefused extends Error {
  override readonly name = "FaceIndexRefused";
  constructor(why: string) { super(`face-index: ${why}`); }
}

export const faceIndexPath = (identityDir: string): string => join(identityDir, FACE_INDEX_FILE);
export const faceDir = (identityDir: string, fcid: string): string => join(identityDir, FACES_DIR, fcid);
export const faceTreePath = (identityDir: string, fcid: string): string => join(faceDir(identityDir, fcid), FACE_TREE_FILE);

/** Read the index's bytes strictly: only the contract's fields, in well-formed shapes. `null` reads as no faces. */
export function decodeFaceIndex(bytes: Uint8Array | null): FaceIndex {
  if (bytes === null) return { faces: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new FaceIndexRefused("the index does not parse"); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new FaceIndexRefused("the index is not an object");
  const top = Object.keys(parsed as object);
  if (top.length !== 1 || top[0] !== "faces") throw new FaceIndexRefused("the index carries a field beyond the face list");
  const faces = (parsed as { faces: unknown }).faces;
  if (!Array.isArray(faces)) throw new FaceIndexRefused("the face list is not a list");
  return { faces: faces.map((raw, at): FaceIndexEntry => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new FaceIndexRefused(`entry ${at} is not an object`);
    const keys = Object.keys(raw).sort().join(",");
    if (keys === "tombstone") {
      if ((raw as { tombstone: unknown }).tombstone !== true) throw new FaceIndexRefused(`entry ${at} is a malformed tombstone`);
      return { tombstone: true };
    }
    if (keys !== "ask,fcid,group") throw new FaceIndexRefused(`entry ${at} carries a field beyond fcid, group and ask`);
    const { fcid, group, ask } = raw as { fcid: unknown; group: unknown; ask: unknown };
    if (typeof fcid !== "string" || !FCID.test(fcid)) throw new FaceIndexRefused(`entry ${at} names no face custody id`);
    for (const [name, v] of [["group", group], ["ask", ask]] as const) {
      if (v !== null && (typeof v !== "string" || !DIGEST.test(v))) throw new FaceIndexRefused(`entry ${at} ${name} is not a digest`);
    }
    return { fcid, group: group as string | null, ask: ask as string | null };
  }) };
}

export function encodeFaceIndex(index: FaceIndex): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify({ faces: index.faces })}\n`);
}

export async function readFaceIndex(io: Pick<CustodyIo, "read">, identityDir: string): Promise<FaceIndex> {
  return decodeFaceIndex(await io.read(faceIndexPath(identityDir)));
}

/** The index as it stands on disk, read with no port (a scan that names files and opens nothing). */
export function readFaceIndexSync(identityDir: string): FaceIndex {
  try { return decodeFaceIndex(new Uint8Array(readFileSync(faceIndexPath(identityDir)))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { faces: [] }; throw error; }
}

/** Every distinct file name standing in any face's directory. */
export function faceFileNames(identityDir: string): string[] {
  return [...new Set(listFaceFiles(identityDir, readFaceIndexSync(identityDir)).map(([, name]) => name))].sort();
}

/** Add a face to the index (the caller holds the custody claim): a fresh fcid, with the founding ask or the group it stands under. */
export async function appendFaceEntry(
  io: Pick<CustodyIo, "read" | "write">, identityDir: string, naming: { readonly ask?: string | null; readonly group?: string | null },
): Promise<{ readonly ordinal: number; readonly fcid: string }> {
  const index = await readFaceIndex(io, identityDir);
  const fcid = randomBytes(16).toString("hex");
  const entry: FaceIndexEntry = { fcid, group: naming.group ?? null, ask: naming.ask ?? null };
  if (entry.group === null && entry.ask === null) throw new FaceIndexRefused("a face enters the index under a group digest or a founding ask");
  if (index.faces.some((f) => "fcid" in f && ((entry.group !== null && f.group === entry.group) || (entry.ask !== null && f.ask === entry.ask)))) {
    throw new FaceIndexRefused("a face already stands in the index under this group or ask");
  }
  await io.write(faceIndexPath(identityDir), encodeFaceIndex({ faces: [...index.faces, entry] }));
  return { ordinal: index.faces.length, fcid };
}

/** Bind the group digest to a face the index names by fcid. The founding ask stays on the entry until `retireFaceAsk`, so the ask row can still be addressed while it moves. */
export async function bindFaceGroup(
  io: Pick<CustodyIo, "read" | "write">, identityDir: string, fcid: string, groupDigest: string,
): Promise<void> {
  if (!DIGEST.test(groupDigest)) throw new FaceIndexRefused("a group binds by its digest");
  const index = await readFaceIndex(io, identityDir);
  const at = index.faces.findIndex((f) => "fcid" in f && f.fcid === fcid);
  if (at < 0) throw new FaceIndexRefused("no face stands under this custody id");
  const entry = index.faces[at] as { fcid: string; group: string | null; ask: string | null };
  if (entry.group !== null && entry.group !== groupDigest) throw new FaceIndexRefused("this face already stands under another group");
  if (entry.group === groupDigest) return;
  const faces = index.faces.map((f, i): FaceIndexEntry => (i === at ? { fcid, group: groupDigest, ask: entry.ask } : f));
  await io.write(faceIndexPath(identityDir), encodeFaceIndex({ faces }));
}

/** The founding ask retires from a face's entry once the rows it addressed have moved under the group. */
export async function retireFaceAsk(io: Pick<CustodyIo, "read" | "write">, identityDir: string, fcid: string): Promise<void> {
  const index = await readFaceIndex(io, identityDir);
  const at = index.faces.findIndex((f) => "fcid" in f && f.fcid === fcid);
  if (at < 0) throw new FaceIndexRefused("no face stands under this custody id");
  const entry = index.faces[at] as { fcid: string; group: string | null; ask: string | null };
  if (entry.ask === null) return;
  if (entry.group === null) throw new FaceIndexRefused("a face keeps its founding ask until its group binds");
  const faces = index.faces.map((f, i): FaceIndexEntry => (i === at ? { fcid, group: entry.group, ask: null } : f));
  await io.write(faceIndexPath(identityDir), encodeFaceIndex({ faces }));
}

/** Every file name standing in the faces' directories, in index order: `[fcid, name]` pairs. Opens nothing; a scan reads names alone. */
export function listFaceFiles(identityDir: string, index: FaceIndex): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = [];
  for (const f of index.faces) {
    if (!("fcid" in f)) continue;
    let names: string[];
    try { names = readdirSync(faceDir(identityDir, f.fcid)); } catch { continue; }
    for (const name of names) out.push([f.fcid, name] as const);
  }
  return out;
}

/** Retire a face: its entry becomes a tombstone and no other ordinal moves. */
export async function tombstoneFaceEntry(io: Pick<CustodyIo, "read" | "write">, identityDir: string, ordinal: number): Promise<void> {
  const index = await readFaceIndex(io, identityDir);
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= index.faces.length) throw new FaceIndexRefused("no face stands at this ordinal");
  const faces = index.faces.map((f, i): FaceIndexEntry => (i === ordinal ? { tombstone: true } : f));
  await io.write(faceIndexPath(identityDir), encodeFaceIndex({ faces }));
}

/** What the index says of a face: by fcid, group digest, ask digest or ordinal. Null where it names none. */
export function findFace(index: FaceIndex, by: { readonly fcid?: string; readonly group?: string; readonly ask?: string; readonly ordinal?: number }):
  { readonly ordinal: number; readonly fcid: string; readonly group: string | null; readonly ask: string | null } | null {
  for (let ordinal = 0; ordinal < index.faces.length; ordinal++) {
    const f = index.faces[ordinal]!;
    if (!("fcid" in f)) continue;
    if (by.ordinal !== undefined && by.ordinal !== ordinal) continue;
    if (by.fcid !== undefined && by.fcid !== f.fcid) continue;
    if (by.group !== undefined && by.group !== f.group) continue;
    if (by.ask !== undefined && by.ask !== f.ask) continue;
    if (by.ordinal === undefined && by.fcid === undefined && by.group === undefined && by.ask === undefined) continue;
    return { ordinal, fcid: f.fcid, group: f.group, ask: f.ask };
  }
  return null;
}

/** Where one file of a face rests: `faces/<fcid>/<file>`, the face found by group or ask digest. The legacy flat spelling answers when the index names no such face, so a reader of an absent row still gets a path that does not exist. Opens nothing. */
export function faceFilePathSync(identityDir: string, by: { readonly group?: string; readonly ask?: string }, file: string): string {
  const found = findFace(readFaceIndexSync(identityDir), by);
  return found === null ? join(identityDir, file) : join(faceDir(identityDir, found.fcid), file);
}
