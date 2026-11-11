/**
 * face-cards — what a face relation wore, in plaintext where a re-founding never reaches: its pet-name (the CARD) and the
 * override base each of its working copies forked from (the BASES sidecar). The seed reads both after a re-founding, so a
 * former face's folders adopt by pet-name and its copies keep the base they forked from, from disk alone.
 *
 * A face's private mirrors key by its relation F (`wikis/daemon-<F>`, `bags/daemon-<F>`, `bags/kahua-<F>`). A re-founding
 * clears the hearth (the sealed rows that held the pet-name) and keeps the projections root, so the card names the face:
 * `<projections>/face-cards/<F>.json` holds `{ relation, petname, handleIndex }`. A base rides a record's meta envelope and
 * never projects, so the sidecar carries it: `<projections>/face-cards/<F>.bases.json` maps each working title to the canon
 * text hash (`sha256:…`) its copy forked from.
 *
 * WHO WRITES. The VESSEL writes both whenever a face stands (`openNodeVessel`): the card off its sealed pet-name, the
 * sidecar kept current off the face's own working documents, filed by the owner table (`device-daemon-docs`: the slots the
 * face's group owns), each change re-read and the file rewritten only where it moved. So both stay true with no CLI door
 * running; the CLI's face reads (`liveFaces`) write the card too.
 *
 * Neither file sits under `wikis/` or `bags/`, so no mirror grant names them: no projector, census, ingest or export walks
 * them as carriers. When a former face's folders move to ashes, its card and sidecar move with them.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";

export const FACE_CARDS_DIR = "face-cards";
export const FACE_CARD_SCHEMA = "lar-face-card/1";
export const FACE_BASES_SCHEMA = "lar-face-bases/1";

/** One card: the pet-name a face relation wore when it last stood or a door last read it. */
export interface FaceCard {
  readonly schema: typeof FACE_CARD_SCHEMA;
  readonly relation: string;
  readonly petname: string;
  readonly handleIndex: number;
}

const RELATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BASE = /^sha256:[0-9a-f]{64}$/;

/** `<projections>/face-cards`. */
export function faceCardsDir(projections: string): string {
  return join(projections, FACE_CARDS_DIR);
}

/** `<projections>/face-cards/<F>.json`. */
export function faceCardPath(relation: string, projections: string): string {
  if (!RELATION.test(relation)) throw new Error(`face card: invalid relation ${JSON.stringify(relation)}`);
  return join(faceCardsDir(projections), `${relation}.json`);
}

/** `<projections>/face-cards/<F>.bases.json`. */
export function faceBasesPath(relation: string, projections: string): string {
  if (!RELATION.test(relation)) throw new Error(`face bases: invalid relation ${JSON.stringify(relation)}`);
  return join(faceCardsDir(projections), `${relation}.bases.json`);
}

/** The card a relation holds, or null where none stands or its bytes name no card. */
export function readFaceCard(relation: string, projections: string): FaceCard | null {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(faceCardPath(relation, projections), "utf8")); } catch { return null; }
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r["schema"] !== FACE_CARD_SCHEMA || r["relation"] !== relation || typeof r["petname"] !== "string" || r["petname"].trim() === ""
    || !Number.isSafeInteger(r["handleIndex"])) return null;
  return { schema: FACE_CARD_SCHEMA, relation, petname: r["petname"], handleIndex: r["handleIndex"] as number };
}

/**
 * Write one face's card. A card that already says the same thing takes no write; one that names another pet-name takes the
 * present one. Never throws: a card serves as an aid, and no standing face fails over it. Answers whether it wrote.
 */
export function writeFaceCard(face: { readonly relation: string | null; readonly petname: string | null | undefined; readonly handleIndex: number }, projections: string): boolean {
  if (face.relation === null || !RELATION.test(face.relation) || typeof face.petname !== "string" || face.petname.trim() === "") return false;
  const standing = readFaceCard(face.relation, projections);
  if (standing !== null && standing.petname === face.petname && standing.handleIndex === face.handleIndex) return false;
  try {
    mkdirSync(faceCardsDir(projections), { recursive: true });
    const card: FaceCard = { schema: FACE_CARD_SCHEMA, relation: face.relation, petname: face.petname, handleIndex: face.handleIndex };
    atomicWriteFileSync(faceCardPath(face.relation, projections), `${JSON.stringify(card, null, 2)}\n`, undefined, { mode: 0o600 });
    return true;
  } catch { return false; }
}

/** Every relation a card stands for. */
export function cardedRelations(projections: string): string[] {
  try { return readdirSync(faceCardsDir(projections)).filter((n) => n.endsWith(".json") && !n.endsWith(".bases.json")).map((n) => n.slice(0, -5)).filter((r) => RELATION.test(r)).sort(); }
  catch { return []; }
}

/** Move a file under face-cards to `dest`; nothing where none stands or `dest` stands. Answers whether it moved. */
export function moveFaceCardFile(from: string, dest: string): boolean {
  if (!existsSync(from) || existsSync(dest)) return false;
  renameSync(from, dest);
  return true;
}

/** The bases a face's sidecar names, title -> canon text hash; empty where none stands. */
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
  if (!RELATION.test(relation)) return false;
  const sorted = Object.fromEntries(Object.entries(bases).filter(([, b]) => BASE.test(b)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const standing = readFaceBases(relation, projections);
  if (JSON.stringify(standing) === JSON.stringify(sorted) && existsSync(faceBasesPath(relation, projections))) return false;
  try {
    mkdirSync(faceCardsDir(projections), { recursive: true });
    atomicWriteFileSync(faceBasesPath(relation, projections), `${JSON.stringify({ schema: FACE_BASES_SCHEMA, relation, bases: sorted }, null, 2)}\n`, undefined, { mode: 0o600 });
    return true;
  } catch { return false; }
}

/** The override bases one document's records name: title -> base, live records alone. */
export function basesOfDoc(doc: { readonly tiddlers?: Readonly<Record<string, { readonly meta?: Readonly<Record<string, unknown>> } | undefined>> } | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [title, record] of Object.entries(doc?.tiddlers ?? {})) {
    const meta = record?.meta;
    if (!meta || meta["deleted"] === true) continue;
    const base = meta["overrideBase"];
    if (typeof base === "string" && BASE.test(base)) out[title] = base;
  }
  return out;
}

/** A document a keeper reads: its current state and its change events (an automerge-repo handle's shape). */
export interface KeptDoc {
  doc(): { readonly tiddlers?: Readonly<Record<string, { readonly meta?: Readonly<Record<string, unknown>> } | undefined>> } | undefined;
  on(event: "change", listener: () => void): unknown;
  off(event: "change", listener: () => void): unknown;
}

/**
 * KEEP ONE FACE'S BASES SIDECAR TRUE. `docs()` names the face's working documents as the owner table files them (the slots
 * its group owns, never whichever face stands lit later); each change re-reads every one and rewrites the sidecar where it
 * moved, coalesced to one write per turn. A copy whose base a document has dropped leaves the sidecar with it. `refresh`
 * re-reads the owner table (a slot the control document names later); `stop` lets every document go.
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
