/**
 * face-labels — what a face relation wore, in plaintext where a re-founding never reaches: its pet-name (the LABEL) and the
 * override base each of its working copies forked from (the BASES sidecar). The seed reads both after a re-founding, so the
 * re-minted face's copies keep the base they forked from, from disk alone.
 *
 * A face's private mirrors key by its PET NAME (`faces/<pet name>/`, `bag-paths.ts`), so a re-found finds them where they stand.
 * A re-founding clears the hearth (the sealed rows that held the pet-name) and keeps the projections root, so the label names
 * which relation wore which pet name (and the face-segment rule reads every other face's name off it):
 * `<projections>/face-labels/<F>.json` holds `{ relation, petname, handleIndex }`. A base rides a record's meta envelope and
 * never projects, so the sidecar carries it: `<projections>/face-labels/<F>.bases.json` maps each working title to the carrier
 * identity (`carrierHash`, `sha256:…`) of the canon record its copy forked from.
 *
 * WHO WRITES. The VESSEL writes both whenever a face stands (`openNodeVessel`): the label off its sealed pet-name, the
 * sidecar kept current off the face's own working documents, filed by the owner table (`device-daemon-docs`: the slots the
 * face's group owns), each change re-read and the file rewritten only where it moved. So both stay true with no CLI door
 * running; the CLI's face reads (`liveFaces`) write the label too.
 *
 * THE SHAPE IS SHARED. The label's bytes, its validation and the write-or-not decision live in `@lararium/mesh`
 * `face-label.ts`, which the browser vessel binds too (`browser-face-labels.ts`, its origin-private file system); this
 * module binds them to the node's projections root, synchronously, so a face founded on either device leaves one record.
 *
 * Neither file sits under `wikis/` or `bags/`, so no mirror grant names them: no projector, census, ingest or export walks
 * them as carriers. When a former face's folders move to ashes, its label and sidecar move with them.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { plainMeta, storedDeleted, isPrototypeKey, type StoredTiddlers } from "@lararium/mesh/stored-value";
import {
  FACE_LABELS_DIR,
  FACE_LABEL_SCHEMA,
  FACE_BASES_SCHEMA,
  faceLabelFileName,
  faceBasesFileName,
  faceLabelBytes,
  parseFaceLabel,
  faceLabelToWrite,
  isFaceLabelRelation,
  type FaceLabel,
  type FaceLabelInput,
} from "@lararium/mesh/face-label";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { faceSegmentRefusal, type FaceSegmentCode, type FaceSite } from "./bag-paths.js";

export { FACE_LABELS_DIR, FACE_LABEL_SCHEMA, FACE_BASES_SCHEMA, type FaceLabel };

const BASE = /^sha256:[0-9a-f]{64}$/;

/** `<projections>/face-labels`. */
export function faceLabelsDir(projections: string): string {
  return join(projections, FACE_LABELS_DIR);
}

/** `<projections>/face-labels/<F>.json`. */
export function faceLabelPath(relation: string, projections: string): string {
  return join(faceLabelsDir(projections), faceLabelFileName(relation));
}

/** `<projections>/face-labels/<F>.bases.json`. */
export function faceBasesPath(relation: string, projections: string): string {
  return join(faceLabelsDir(projections), faceBasesFileName(relation));
}

/** The label a relation holds, or null where none stands or its bytes name no label. */
export function readFaceLabel(relation: string, projections: string): FaceLabel | null {
  let bytes: string;
  try { bytes = readFileSync(faceLabelPath(relation, projections), "utf8"); } catch { return null; }
  return parseFaceLabel(bytes, relation);
}

/**
 * Write one face's label. A label that already says the same thing takes no write; one that names another pet-name takes the
 * present one. Never throws: a label serves as an aid, and no standing face fails over it. Answers whether it wrote.
 */
export function writeFaceLabel(face: FaceLabelInput, projections: string): boolean {
  if (!isFaceLabelRelation(face.relation)) return false;
  const label = faceLabelToWrite(readFaceLabel(face.relation, projections), face);
  if (label === null) return false;
  try {
    mkdirSync(faceLabelsDir(projections), { recursive: true });
    atomicWriteFileSync(faceLabelPath(label.relation, projections), faceLabelBytes(label), undefined, { mode: 0o600 });
    return true;
  } catch { return false; }
}

/** Every relation a label stands for. */
export function labelledRelations(projections: string): string[] {
  try { return readdirSync(faceLabelsDir(projections)).filter((n) => n.endsWith(".json") && !n.endsWith(".bases.json")).map((n) => n.slice(0, -5)).filter((r) => isFaceLabelRelation(r)).sort(); }
  catch { return []; }
}

/**
 * THE FACE'S SITE: its relation and the folder its pet name makes (`faces/<pet name>`), or why it makes none, by name. The other
 * faces' segments come off the label shelf: a label under another relation that carries this very pet name names a former
 * instance of this face (a re-found mints a new relation under the same pet name), so it never collides; a label whose pet name
 * folds onto this one without matching it refuses (`face-segment-collision`), since no two faces share a root.
 */
export function faceSiteOf(face: FaceLabelInput, projections: string): { readonly site: FaceSite } | { readonly refused: { readonly code: FaceSegmentCode; readonly why: string } } {
  const others: string[] = [];
  for (const r of labelledRelations(projections)) {
    if (r === face.relation) continue;
    const label = readFaceLabel(r, projections);
    if (label === null || label.petname.normalize("NFC") === face.petname?.normalize("NFC")) continue;
    if (faceSegmentRefusal(label.petname) === null) others.push(label.petname.normalize("NFC"));
  }
  const refused = faceSegmentRefusal(face.petname, others);
  if (refused !== null) return { refused };
  if (!isFaceLabelRelation(face.relation)) return { refused: { code: "face-segment-empty", why: "a face with no relation names no private plane yet" } };
  return { site: { relation: face.relation, segment: face.petname!.normalize("NFC") } };
}

/** Move a file under face-labels to `dest`; nothing where none stands or `dest` stands. Answers whether it moved. */
export function moveFaceLabelFile(from: string, dest: string): boolean {
  if (!existsSync(from) || existsSync(dest)) return false;
  renameSync(from, dest);
  return true;
}

/** The bases a face's sidecar names, title -> canon carrier identity; empty where none stands. */
export function readFaceBases(relation: string, projections: string): Record<string, string> {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(faceBasesPath(relation, projections), "utf8")); } catch { return {}; }
  const r = raw as { schema?: unknown; relation?: unknown; bases?: unknown };
  if (r?.schema !== FACE_BASES_SCHEMA || r.relation !== relation || typeof r.bases !== "object" || r.bases === null) return {};
  const out: Record<string, string> = {};
  for (const [title, base] of Object.entries(r.bases as Record<string, unknown>)) if (typeof base === "string" && BASE.test(base)) out[title] = base;
  return out;
}

/** Write a face's bases sidecar where it moved; never throws. Answers whether it wrote. */
export function writeFaceBases(relation: string, bases: Readonly<Record<string, string>>, projections: string): boolean {
  if (!isFaceLabelRelation(relation)) return false;
  const sorted = Object.fromEntries(Object.entries(bases).filter(([, b]) => BASE.test(b)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  // THE BYTES DECIDE: the whole file compares, and a sidecar whose bytes differ takes this write.
  const body = `${JSON.stringify({ schema: FACE_BASES_SCHEMA, relation, bases: sorted }, null, 2)}\n`;
  let standing: string | null = null;
  try { standing = readFileSync(faceBasesPath(relation, projections), "utf8"); } catch { standing = null; }
  if (standing === body) return false;
  try {
    mkdirSync(faceLabelsDir(projections), { recursive: true });
    atomicWriteFileSync(faceBasesPath(relation, projections), body, undefined, { mode: 0o600 });
    return true;
  } catch { return false; }
}

/** A working document as a keeper reads it: its `tiddlers` map as the document rests it, read through the read door. */
export interface KeptDocState { readonly tiddlers?: StoredTiddlers }

/** The override bases one document's records name: title -> base, live records alone, each read through the read door. */
export function basesOfDoc(doc: KeptDocState | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    if (isPrototypeKey(title) || !record || storedDeleted(record)) continue;
    const base = plainMeta(record, "overrideBase");
    if (typeof base === "string" && BASE.test(base)) out[title] = base;
  }
  return out;
}

/** A document a keeper reads: its current state and its change events (an automerge-repo handle's shape). */
export interface KeptDoc {
  doc(): KeptDocState | undefined;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

/**
 * KEEP ONE FACE'S BASES SIDECAR TRUE. `docs()` names the face's working documents as the owner table files them (the slots
 * its group owns, never whichever face stands lit later); each change re-reads every one and rewrites the sidecar where it
 * moved, coalesced to one write per turn. A copy whose base a document has dropped leaves the sidecar with it. `refresh`
 * re-reads the owner table (a slot the vessel registry names later); `stop` lets every document go.
 */
export function keepFaceBases(opts: { readonly relation: string; readonly projections: string; readonly docs: () => readonly KeptDoc[] }): { stop(): void; refresh(): void } {
  let scheduled = false, stopped = false;
  const watched = new Set<KeptDoc>();
  const write = (): void => {
    scheduled = false;
    if (stopped) return;
    const docs = opts.docs();
    for (const d of docs) if (!watched.has(d)) { watched.add(d); d.on("change", schedule); }
    // A document not yet hydrated reads nothing: the sidecar keeps what it said until every one reads.
    if (docs.length === 0 || docs.some((d) => d.doc() === undefined)) return;
    const bases: Record<string, string> = {};
    for (const d of docs) Object.assign(bases, basesOfDoc(d.doc()));
    writeFaceBases(opts.relation, bases, opts.projections);
  };
  function schedule(): void { if (!scheduled && !stopped) { scheduled = true; queueMicrotask(write); } }
  write();
  return { stop: () => { stopped = true; for (const d of watched) d.off("change", schedule); watched.clear(); }, refresh: schedule };
}
