/**
 * seed-mirrors — the seed's second leg: every disk mirror under the projections root laid back into the ONE layer it
 * mirrors, through INGEST's three-way gate.
 *
 * THE LAW. A seed lays every disk mirror back into the one layer it mirrors (disk equal to the base: nothing; the disk
 * moved: it lands; both moved: a stand-off at the shore, within that one layer), and a second seed lands nothing:
 *
 *   projections/wikis/daemon-<F>   -> face F's daemon WORKING (`wikis/daemon/working`); a kāpae shadow raises as a kāpae
 *   projections/bags/daemon-<F>    -> face F's daemon canon (`bags/daemon-<F>`)
 *   projections/bags/kahua-<F>     -> face F's kahua stage, by the operator's hand alone (below)
 *   projections/bags/<house-bag>   -> that bag's canon
 *   projections/wikis/<slug>       -> that wiki's working layer
 *   recovery/ and consented temp/  -> placed back as files, as carry places them (never through a layer)
 *   projections/ashes/**           -> nothing: never read back, never projected into
 *
 * Canon lays before working (a working copy forks its override base off the canon under it). A canon pour never writes
 * working; only a working layer's OWN mirror flows back into it, and the top layer always shadows: nothing retracts,
 * nothing stands off against a lower layer, and the seed's canon leg only warns where canon stands fresher.
 *
 * ADOPTION BY PET-NAME. A re-founding keeps the projections root, so the former face's folders rest there under the
 * former relation. The seed adopts them for the face here that carries the former face's pet-name (its face label,
 * `face-labels.ts`), exactly as an import maps a bundle face: one face here carries it, else the seed refuses THAT folder by
 * name and lands nothing of it (none or two such faces: a former face's private memory never lands on another person's face),
 * and goes on for every other folder. A folder no label names reads as no face's mirror: the seed names it and adopts nothing
 * from it. A face standing shut waits for the folders its label names; a face whose pet-name would not read blocks only the
 * folders no other face claims. Adopted files copy into the new face's folder where none stands (a different file there stands off, as the import's mirror check
 * does), then lay through the same gate. So a tear-out with no export recovers from disk alone.
 *
 * THE LIT-FACE GATE. The daemon's working layer (`wikis/daemon/working`) holds the WORN face's document alone, so a face's working and
 * face-canon folders (its own, and every former face's it adopts) lay only while that face stands worn. Every other face places
 * nothing into any layer: the seed names it ("<pet-name>: wear it (`lares vault unlock --face N`) and seed again"), an expected
 * state rather than a stand-off, and its former folders stay out of ashes until its own seed lands them. No face's private memory
 * ever lands in another face. Kahua lifts sign per face under that face's own grant, so they ride every face.
 *
 * KAHUA LIFTS BY THE OPERATOR'S HAND, WITH EYES. The seed previews every kahua item it would lift per face (title, body
 * digest, face; a file that differs from a standing head reads `differs`), then lifts them under the target face's grant,
 * keyed by title and body digest, signed by that face, ONLY on a typed confirmation naming the count (a TTY) or
 * `--lift-kahua <N>` with N equal to the previewed count. A bare `--yes` lifts nothing in kahua; a wrong count refuses
 * before anything writes. Unconfirmed items stand pending (`kahua-pending.json` under the config home), listed by
 * `lares shore` and liftable later with the same count rule (`lares shore lift-kahua --count <N>`).
 *
 * ASHES. After an adoption lands for a face with NOTHING pending, the former folders move to `projections/ashes/<former>/`
 * (`ashes.ts`); a partial landing leaves them and says why.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { daemonFaceCanonBag, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import {
  larProjectionsHome, larConfigHome, mirrorDirFileToUri, isDaemonFaceFolder, isKahuaFaceFolder, isPrivateProjectionSlug,
  daemonFaceFolder, kahuaFaceFolder, KAPAE_EXT, TEMP_LAYER_DIR, parseTidCarrier, atomicWriteFileSync, daemonBagsDir,
} from "@lararium/node";
import { LIVE_CARRY_DOORS, litFaceOf, wearItLine, type CarryDoors, type CarryVesselFace } from "./commands/carry.js";
import { scanFiles, candidatesOf, settleIngest, openSyncedTree } from "./ingest-core.js";
import { summaryOutput } from "./verb-result.js";
import { vesselDid } from "./env.js";
import { canonIsDisk } from "./holdings.js";
import { sha256Hex, type CarryKahuaHead } from "./carry-manifest.js";
import { readFaceLabel, readFaceBases } from "./face-labels.js";
import { moveFaceToAshes } from "./ashes.js";

// ── the doors ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One mirror folder laid into the one layer it mirrors. */
export interface MirrorWave {
  /** The folder the wave reads. */
  readonly source: string;
  /** The plane dir the uri derives against (`<projections>/wikis` or `<projections>/bags`): the first segment under it
   *  names the holding slot and never enters the name. */
  readonly uriDir: string;
  readonly toBag: string;
  /** The wiki the INGEST runs in (a wiki's working layer other than the daemon's); absent: daemon-side. */
  readonly wiki?: string;
  /** Top-level dirs under the folder that carry no layer of their own (`recovery`, `temp`). */
  readonly skipTop: readonly string[];
  /** THE BASES A WORKING WAVE RESTORES (title -> the carrier identity of the canon record its copy forked from), read off each owning face's
   *  bases sidecar: the island stamps each on the copy it lands, so a fork keeps its base across a re-founding. */
  readonly bases?: Readonly<Record<string, string>>;
}

/** What a wave planned and landed. A preview plans alone. */
export interface MirrorLaid {
  /** The carriers the scan read new or moved against the synced base. */
  readonly planned: readonly string[];
  /** The titles the folder's kāpae shadows name. */
  readonly kapae: readonly string[];
  readonly landed: readonly string[];
  /** The kāpae the wave newly raised (one already standing reads nothing). */
  readonly kapaeRaised: readonly string[];
  readonly conflicts: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly refused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly unanswered: readonly string[];
}

/** The doors the mirror leg reaches a vessel through, injectable so a test drives them with no vessel standing. */
export interface MirrorDoors {
  readonly faces: CarryDoors["faces"];
  readonly tempConsented: CarryDoors["tempConsented"];
  readonly heldSlugs: CarryDoors["heldSlugs"];
  readonly mintBag: CarryDoors["mintBag"];
  readonly kahuaLift: CarryDoors["kahuaLift"];
  /** Scan one folder against the synced base and, applied, lay its new and moved carriers through INGEST's gate. */
  readonly lay: (wave: MirrorWave, apply: boolean) => Promise<MirrorLaid>;
  /** Whether a slug's canon stands under the canon source (the holdings leg feeds it; the mirror leg leaves it). */
  readonly sourced: (slug: string) => boolean;
}

// ── refusals and readings ──────────────────────────────────────────────────────────────────────────────────────

/** A refusal the mirror leg raises by name before anything writes; the message carries the cure. */
export class MirrorRefused extends Error {
  override readonly name = "MirrorRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

/** One kahua item the seed would lift: what a person reads before they confirm. */
export interface KahuaPreviewItem {
  readonly handleIndex: number;
  readonly petname: string | null;
  /** The relation whose kahua folder holds the file (the former face's, for an adoption). */
  readonly relation: string;
  readonly title: string;
  /** sha-256 of the item's body. */
  readonly digest: string;
  readonly path: string;
  /** `new`: the stage holds no head of the title; `differs`: it holds one head whose body differs from the file. */
  readonly state: "new" | "differs";
  /** The head a `differs` lift supersedes; null for a first lift. */
  readonly parent: string | null;
}

/** One layer's account. */
export interface MirrorLayerTally {
  readonly mirror: string;
  readonly toBag: string;
  planned: number;
  landed: number;
  kapae: number;
  stoodOff: string[];
  refused: string[];
}

export interface MirrorSeedResult {
  readonly applied: boolean;
  /** Each former face's folders and the face here that carries its pet-name. */
  readonly adoptions: ReadonlyArray<{ readonly relation: string; readonly petname: string; readonly handleIndex: number; readonly toRelation: string }>;
  readonly layers: readonly MirrorLayerTally[];
  /** Draft and temp files placed back (or planned), and those a different file blocked. */
  readonly files: { placed: number; planned: number; stoodOff: string[] };
  readonly kahua: {
    readonly preview: readonly KahuaPreviewItem[];
    readonly lifted: ReadonlyArray<{ readonly title: string; readonly cid: string; readonly handleIndex: number }>;
    readonly pending: readonly KahuaPreviewItem[];
    readonly refused: readonly string[];
  };
  readonly ashes: ReadonlyArray<{ readonly relation: string; readonly moved: readonly string[] }>;
  readonly ashesLeft: ReadonlyArray<{ readonly relation: string; readonly why: string }>;
  /**
   * THE FACES THAT WAIT THEIR TURN: each face whose folders (its own, or a former face's it adopts) stand on disk while another
   * face stands worn. Nothing of theirs laid into any layer; their folders stay until their own seed lands them.
   */
  readonly waiting: ReadonlyArray<{ readonly handleIndex: number; readonly petname: string | null; readonly relations: readonly string[] }>;
  /** Each face folder the seed refused by name (unlabelled, unmatched, doubly named, unread): it landed nothing, and the rest went on. */
  readonly refusals: ReadonlyArray<{ readonly relation: string; readonly code: string; readonly message: string }>;
  readonly minted: readonly string[];
  /** Whether the projections root held any mirror the leg reads. */
  readonly any: boolean;
}

// ── kahua pending ──────────────────────────────────────────────────────────────────────────────────────────────

export const KAHUA_PENDING_FILE = "kahua-pending.json";
const KAHUA_PENDING_SCHEMA = "lar-kahua-pending/1";

/** `<root>/config/kahua-pending.json`: the config class survives a restart and a reset, and never sits in the hearth. */
export function kahuaPendingPath(): string {
  return join(larConfigHome(), KAHUA_PENDING_FILE);
}

/** The kahua items standing pending for a hand, as the last seed previewed them. */
export function readKahuaPending(): KahuaPreviewItem[] {
  try {
    const raw = JSON.parse(readFileSync(kahuaPendingPath(), "utf8")) as { schema?: unknown; items?: unknown };
    return raw.schema === KAHUA_PENDING_SCHEMA && Array.isArray(raw.items) ? (raw.items as KahuaPreviewItem[]) : [];
  } catch { return []; }
}

function writeKahuaPending(items: readonly KahuaPreviewItem[]): void {
  const path = kahuaPendingPath();
  if (items.length === 0) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteFileSync(path, `${JSON.stringify({ schema: KAHUA_PENDING_SCHEMA, items }, null, 2)}\n`, undefined, { mode: 0o600 });
}

/** The words a person types to confirm a kahua lift: the count itself. */
export function kahuaConfirmPrompt(count: number): string {
  return `lift ${count} kahua item(s) under the faces named above, each signed by its face? type ${count} to confirm: `;
}

// ── the files ──────────────────────────────────────────────────────────────────────────────────────────────────

const isStray = (rel: string): boolean => rel.includes(".lar-tmp-");
const folders = (dir: string): string[] => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort(); } catch { return []; } };

/** Every plain file under `dir` (posix rel paths, sorted), the top dirs `skipTop` names left out; an absent dir reads empty. */
export function mirrorFiles(dir: string, skipTop: readonly string[] = []): string[] {
  const out: string[] = [];
  const visit = (abs: string, rel: string): void => {
    let names: string[];
    try { names = readdirSync(abs).sort(); } catch { return; }
    for (const name of names) {
      const a = join(abs, name), r = rel === "" ? name : `${rel}/${name}`;
      if (rel === "" && skipTop.includes(name)) continue;
      const st = lstatSync(a);
      if (st.isDirectory()) visit(a, r);
      else if (st.isFile() && !isStray(r)) out.push(r);
    }
  };
  visit(dir, "");
  return out;
}

/**
 * Copy each file from `from` into `to` where none stands. A file there with the same bytes reads placed already; one with
 * other bytes stands off (left as it stands, its rel path named). Applied alone; a preview counts.
 */
function placeFiles(from: string, to: string, rels: readonly string[], apply: boolean): { copied: number; planned: number; stoodOff: string[] } {
  let copied = 0, planned = 0;
  const stoodOff: string[] = [];
  for (const rel of rels) {
    const src = join(from, ...rel.split("/")), dest = join(to, ...rel.split("/"));
    if (existsSync(dest)) {
      if (!readFileSync(dest).equals(readFileSync(src))) stoodOff.push(rel);
      continue;
    }
    planned++;
    if (!apply) continue;
    mkdirSync(dirname(dest), { recursive: true });
    const tmp = `${dest}.lar-tmp-${randomBytes(4).toString("hex")}`;
    copyFileSync(src, tmp);
    try { renameSync(tmp, dest); } finally { rmSync(tmp, { force: true }); }
    copied++;
  }
  return { copied, planned, stoodOff };
}

/** A kahua stage file read as a lift: its title, body, lift fields, taint and sources. Null for bytes that name no item. */
export function readKahuaFile(text: string): { title: string; text: string; fields: Record<string, string>; taint: string[]; sources: CarryKahuaHead["sources"] } | null {
  const parsed = parseTidCarrier(text);
  if (parsed === null) return null;
  // A carrier the projector writes ends its body with one newline the stage's body never held.
  const body = (parsed["text"] ?? "").replace(/\n$/, "");
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) if (k !== "title" && k !== "text" && !k.startsWith("kahua-")) fields[k] = v;
  const list = (raw: string | undefined): unknown[] => { try { const v = JSON.parse(raw ?? "[]") as unknown; return Array.isArray(v) ? v : []; } catch { return []; } };
  const taint = list(parsed["kahua-taint"]).filter((t): t is string => typeof t === "string");
  const sources = list(parsed["kahua-sources"]).filter((s): s is { title: string; revision: string } =>
    typeof s === "object" && s !== null && typeof (s as Record<string, unknown>)["title"] === "string" && typeof (s as Record<string, unknown>)["revision"] === "string")
    .map((s) => ({ title: s.title, revision: s.revision }));
  return { title: parsed.title, text: body, fields, taint, sources };
}

// ── the leg ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SeedMirrorsOpts {
  readonly apply: boolean;
  readonly doors: MirrorDoors;
  /** `--lift-kahua <N>`: lift the previewed kahua items when N equals their count; a wrong count refuses. */
  readonly liftKahua?: number | null;
  /** A person at a TTY, shown the preview, types the count (`kahuaConfirmPrompt`); absent: no hand confirms. */
  readonly confirmKahua?: (count: number, preview: readonly KahuaPreviewItem[]) => Promise<boolean>;
  /** Skip every layer and read kahua alone (`lares shore lift-kahua`). */
  readonly kahuaOnly?: boolean;
}

/**
 * Lay every mirror under the projections root back into the one layer it mirrors. Every refusal raises before anything
 * writes ({@link MirrorRefused}); a preview (`apply` false) plans every act and writes nothing.
 */
export async function seedMirrors(opts: SeedMirrorsOpts): Promise<MirrorSeedResult> {
  const { apply, doors } = opts;
  const projections = larProjectionsHome();
  const wikisDir = join(projections, "wikis"), bagsDir = join(projections, "bags");
  const wikiFolders = folders(wikisDir), bagFolders = folders(bagsDir);
  const relOf = (name: string): string | null => isDaemonFaceFolder(name) ? name.slice("daemon-".length) : isKahuaFaceFolder(name) ? name.slice("kahua-".length) : null;
  const relations = [...new Set([...wikiFolders, ...bagFolders].map(relOf).filter((r): r is string => r !== null))].sort();
  const houseBags = bagFolders.filter((n) => relOf(n) === null && !isPrivateProjectionSlug(n) && !doors.sourced(n));
  const houseWikis = wikiFolders.filter((n) => relOf(n) === null && !isPrivateProjectionSlug(n) && !doors.sourced(n));
  const empty: MirrorSeedResult = { applied: apply, adoptions: [], layers: [], files: { placed: 0, planned: 0, stoodOff: [] }, kahua: { preview: [], lifted: [], pending: [], refused: [] }, ashes: [], ashesLeft: [], waiting: [], refusals: [], minted: [], any: false };
  if (relations.length === 0 && (opts.kahuaOnly || houseBags.length + houseWikis.length === 0)) return empty;

  // ── THE FACE MAP: each relation's folders land on the face that wears it, or on the ONE face carrying its pet-name. ──
  let faces: CarryVesselFace[] = [];
  if (relations.length > 0) {
    try { faces = await doors.faces(); }
    catch (e) { throw new MirrorRefused("seed-faces-unread", `the projections root holds face folders and the faces this vessel wears would not read (${e instanceof Error ? e.message : String(e)}): stand the vessel and unlock its key (\`lares vessel stand\`, then \`lares vault unlock\`), and seed again`); }
  }
  const byRelation = new Map<string, CarryVesselFace>();
  for (const f of faces) if (f.relation !== null) byRelation.set(f.relation, f);
  const target = new Map<string, CarryVesselFace>();
  const adoptions: Array<{ relation: string; petname: string; handleIndex: number; toRelation: string }> = [];
  // ONE FOLDER'S REFUSAL NEVER HALTS THE REST: an unlabelled, unmatched or doubly-named folder records its line and lands
  // nothing, and the seed goes on for every other folder.
  const refusals: Array<{ relation: string; code: string; message: string }> = [];
  const refuse = (relation: string, code: string, message: string): void => { refusals.push({ relation, code, message: `${code}: ${message}` }); };
  // A face that stands SHUT (it reads no relation) waits its turn for the folders its label names: wear it and seed again.
  const shutWaiting = new Map<number, { handleIndex: number; petname: string | null; relations: string[] }>();
  for (const r of relations) {
    const worn = byRelation.get(r);
    if (worn !== undefined) { target.set(r, worn); continue; }
    const label = readFaceLabel(r, projections);
    const held = [wikiFolders.includes(daemonFaceFolder(r)) ? join(wikisDir, daemonFaceFolder(r)) : null, bagFolders.includes(daemonFaceFolder(r)) ? join(bagsDir, daemonFaceFolder(r)) : null, bagFolders.includes(kahuaFaceFolder(r)) ? join(bagsDir, kahuaFaceFolder(r)) : null].filter((p): p is string => p !== null);
    if (label === null) { refuse(r, "seed-face-unlabelled", `${held.join(", ")}: this folder carries no face label (no ${r}.json stands under face-labels), so it reads as no face's mirror and the seed adopts nothing from it; move it aside or remove it, and seed again`); continue; }
    const matches = faces.filter((f) => f.petname === label.petname);
    if (matches.length > 1) { refuse(r, "seed-face-duplicate-petname", `faces ${matches.map((m) => `h${m.handleIndex}`).join(" and ")} on this vessel both carry the pet-name "${label.petname}", which the former face ${r} wore; its memory lands on one face alone, so rename one and seed again`); continue; }
    const face = matches[0];
    if (face === undefined) {
      // A face whose pet-name would not read may carry this label: its folders wait while that stays unknown, and only they.
      const unread = faces.find((f) => f.relation === null && f.petname === null && f.kahuaRefusal !== undefined);
      if (unread !== undefined) { refuse(r, "seed-faces-unread", `the face h${unread.handleIndex} reads no face relation and no pet-name (${unread.kahuaRefusal}), so the seed cannot tell whether the folders of ${r} ("${label.petname}") belong to it: unlock it (\`lares vault unlock --face ${unread.handleIndex}\`) and seed again`); continue; }
      refuse(r, "seed-face-unmatched", `no face on this vessel carries the pet-name "${label.petname}", which the former face ${r} wore (${held.join(", ")}); the seed never lands one face's memory on another's: found it (\`lares persona new ${label.handleIndex} --name '${label.petname}'\`) and seed again`);
      continue;
    }
    if (face.relation === null) {
      const w = shutWaiting.get(face.handleIndex) ?? { handleIndex: face.handleIndex, petname: face.petname, relations: [] };
      w.relations.push(r);
      shutWaiting.set(face.handleIndex, w);
      continue;
    }
    target.set(r, face);
    adoptions.push({ relation: r, petname: label.petname, handleIndex: face.handleIndex, toRelation: face.relation });
  }
  /** The relations whose folders land on a face this seed: refused and shut-waiting folders stay where they stand. */
  const placedRelations = relations.filter((r) => target.has(r));

  // ── THE LIT-FACE GATE: the daemon's working layer holds the WORN face's document alone, so only the worn face's folders lay. ──
  // Every other face waits, named: nothing of its memory lands in any layer, and its folders stay until its own seed lands them.
  const litRelation = litFaceOf(faces)?.relation ?? null;
  const waitingBy = new Map<number, { handleIndex: number; petname: string | null; relations: string[] }>(shutWaiting);
  for (const r of placedRelations) {
    const face = target.get(r);
    if (face === undefined || face.relation === litRelation) continue;
    const w = waitingBy.get(face.handleIndex) ?? { handleIndex: face.handleIndex, petname: face.petname, relations: [] };
    w.relations.push(r);
    waitingBy.set(face.handleIndex, w);
  }
  // A face that waits on its OWN folders alone (no former face adopts onto it) waits only where they hold something its document
  // has not taken: a preview scan (writing nothing) against its synced base, so a face already seeded while worn reads quiet.
  for (const w of [...waitingBy.values()]) {
    if (opts.kahuaOnly || w.relations.some((r) => target.get(r)?.relation !== r)) continue;
    const own = w.relations[0]!;
    let moved = 0;
    for (const [dir, toBag, skipTop] of [[bagsDir, daemonFaceCanonBag(own), []], [wikisDir, wikiSlotUri("daemon", "working"), [TEMP_LAYER_DIR, "recovery"]]] as const) {
      const source = join(dir, daemonFaceFolder(own));
      if (!existsSync(source)) continue;
      const read = await doors.lay({ source, uriDir: dir, toBag, skipTop }, false);
      moved += read.planned.length;                // a kāpae shadow reads on every scan, so carriers alone name a move
    }
    if (moved === 0) waitingBy.delete(w.handleIndex);
  }
  const waiting = [...waitingBy.values()].sort((a, b) => a.handleIndex - b.handleIndex);

  // ── KAHUA: the preview first, and a wrong count refuses before anything writes. ──
  const kahuaPreview: KahuaPreviewItem[] = [];
  const kahuaRefused: string[] = [];
  /** Each kahua refusal by the former relation whose folder held it: an ashes hold reads per face, never across faces. */
  const kahuaRefusedBy = new Map<string, number>();
  const refuseKahua = (r: string, face: CarryVesselFace, line: string): void => {
    kahuaRefused.push(`h${face.handleIndex}${face.petname ? ` ("${face.petname}")` : ""}: ${line}`);
    kahuaRefusedBy.set(r, (kahuaRefusedBy.get(r) ?? 0) + 1);
  };
  const liftOf = new Map<KahuaPreviewItem, NonNullable<ReturnType<typeof readKahuaFile>>>();
  for (const r of placedRelations) {
    const folder = join(bagsDir, kahuaFaceFolder(r));
    if (!bagFolders.includes(kahuaFaceFolder(r))) continue;
    const face = target.get(r)!;
    for (const rel of mirrorFiles(folder)) {
      if (rel.endsWith(".meta") || rel.endsWith(KAPAE_EXT)) continue;
      const path = join(folder, ...rel.split("/"));
      const item = readKahuaFile(readFileSync(path, "utf8"));
      if (item === null) { refuseKahua(r, face, `${path} (names no kahua item)`); continue; }
      const digest = sha256Hex(item.text);
      if (face.kahua === null) { refuseKahua(r, face, `${item.title} (its stage would not read: ${face.kahuaRefusal ?? "unread"})`); continue; }
      const standing = face.kahua.filter((h) => h.title === item.title);
      if (standing.some((h) => sha256Hex(h.text) === digest)) continue;          // the stage already holds this body
      if (standing.length > 1) { refuseKahua(r, face, `${item.title} (the stage holds ${standing.length} sibling heads; settle them by hand)`); continue; }
      const p: KahuaPreviewItem = { handleIndex: face.handleIndex, petname: face.petname, relation: r, title: item.title, digest, path, state: standing.length === 0 ? "new" : "differs", parent: standing[0]?.cid ?? null };
      // Two files of one title and body (an old face's folder and the new one's) lift once.
      if (kahuaPreview.some((q) => q.handleIndex === p.handleIndex && q.title === p.title && q.digest === p.digest)) continue;
      kahuaPreview.push(p);
      liftOf.set(p, item);
    }
  }
  const liftKahua = opts.liftKahua ?? null;
  if (apply && liftKahua !== null && liftKahua !== kahuaPreview.length) {
    throw new MirrorRefused("seed-kahua-count", `--lift-kahua ${liftKahua} names ${liftKahua} item(s) and the preview counts ${kahuaPreview.length}; nothing lifted and nothing wrote: read the preview (\`lares vessel seed\`) and name its count`);
  }

  const layers: MirrorLayerTally[] = [];
  const files = { placed: 0, planned: 0, stoodOff: [] as string[] };
  const minted: string[] = [];
  /** The relations whose landing left something standing, each with why. */
  const partial = new Map<string, string>();
  const markPartial = (r: string, why: string): void => { if (!partial.has(r)) partial.set(r, why); };

  if (!opts.kahuaOnly) {
    const consented = new Set(doors.tempConsented());
    const runWave = async (wave: MirrorWave, label: string, owners: readonly string[] = []): Promise<void> => {
      const laid = await doors.lay(wave, apply);
      const t: MirrorLayerTally = { mirror: label, toBag: wave.toBag, planned: laid.planned.length, landed: laid.landed.length, kapae: laid.kapaeRaised.length, stoodOff: [], refused: [] };
      for (const c of laid.conflicts) t.stoodOff.push(`${c.uri} (${c.why})`);
      for (const c of laid.refused) t.refused.push(`${c.uri} (${c.why})`);
      for (const u of laid.unanswered) t.refused.push(`${u} (no answer; seed again)`);
      if (t.planned + t.landed + t.kapae + t.stoodOff.length + t.refused.length > 0 || laid.kapae.length > 0) layers.push(t);
      if (t.stoodOff.length + t.refused.length > 0) for (const r of owners) markPartial(r, `${label} left ${t.stoodOff.length} stand-off(s) and ${t.refused.length} refusal(s)`);
    };

    // FACE FOLDERS, per target face: adopted folders copy in first, then the face's own folder lays, canon before working.
    const byTarget = new Map<string, string[]>();
    for (const r of placedRelations) { const to = target.get(r)!.relation!; byTarget.set(to, [...(byTarget.get(to) ?? []), r]); }
    for (const [to, owners] of [...byTarget].sort(([a], [b]) => (a < b ? -1 : 1))) {
      // A face that stands unworn places nothing into any layer, and its former folders stay (no ashes) until it is worn.
      if (to !== litRelation) { for (const r of owners) markPartial(r, wearItLine(target.get(r)!, "seed")); continue; }
      for (const kind of ["canon", "working"] as const) {
        const dir = kind === "canon" ? bagsDir : wikisDir;
        const skipTop = kind === "working" ? [TEMP_LAYER_DIR, "recovery"] : [];
        const toBag = kind === "canon" ? daemonFaceCanonBag(to) : wikiSlotUri("daemon", "working");
        // A working wave restores each copy's fork base off the owning faces' sidecars (the face's own wins a title both name).
        const bases: Record<string, string> = {};
        if (kind === "working") for (const r of [...owners.filter((r) => r !== to), to]) Object.assign(bases, readFaceBases(r, projections));
        const withBases = Object.keys(bases).length > 0 ? { bases } : {};
        const dest = join(dir, daemonFaceFolder(to));
        const sources = owners.filter((r) => existsSync(join(dir, daemonFaceFolder(r))));
        for (const r of sources.filter((r) => r !== to)) {
          const from = join(dir, daemonFaceFolder(r));
          const placed = placeFiles(from, dest, mirrorFiles(from, skipTop), apply);
          for (const rel of placed.stoodOff) {
            const uri = mirrorDirFileToUri(dir, join(from, ...rel.split("/"))) ?? rel;
            files.stoodOff.push(`${uri} (${kind}: a different file stands in ${dest}; left as it stands)`);
            markPartial(r, `${uri} stands off in ${dest}`);
          }
          // A preview reads the former face's folder as the source: its files have not copied yet.
          if (!apply) await runWave({ source: from, uriDir: dir, toBag, skipTop, ...withBases }, `${kind} ${daemonFaceFolder(r)} -> h${target.get(r)!.handleIndex}`, [r]);
        }
        // The face's own folder (holding, once applied, what the adoptions copied in) lays through the one gate.
        if (existsSync(dest)) {
          await runWave({ source: dest, uriDir: dir, toBag, skipTop, ...withBases }, `${kind} ${daemonFaceFolder(to)}`, owners);
        }
      }
      // Drafts and consented temp: files beside the new face's working folder, where none stands.
      for (const r of owners.filter((r) => r !== to)) {
        for (const sub of ["recovery", ...(consented.has("daemon") ? [TEMP_LAYER_DIR] : [])]) {
          const from = join(wikisDir, daemonFaceFolder(r), sub);
          const placed = placeFiles(from, join(wikisDir, daemonFaceFolder(to), sub), mirrorFiles(from), apply);
          files.placed += placed.copied; files.planned += placed.planned;
          for (const rel of placed.stoodOff) { files.stoodOff.push(`${join(from, rel)} (a different file stands there; left as it stands)`); markPartial(r, `${sub}/${rel} stands off`); }
        }
        if (!consented.has("daemon") && existsSync(join(wikisDir, daemonFaceFolder(r), TEMP_LAYER_DIR))) markPartial(r, `its temp folder stands with no consent row (projection.temp.daemon)`);
      }
    }

    // HOUSE BAGS (canon) before HOUSE WIKIS (working): a slug this vessel does not hold mints first, through CREATE.
    if (houseBags.length + houseWikis.length > 0) {
      const held = await doors.heldSlugs();
      for (const slug of [...new Set([...houseBags, ...houseWikis])].sort()) {
        if (held.has(slug)) continue;
        minted.push(wikiBagUri(slug));
        if (apply) await doors.mintBag(wikiBagUri(slug));
      }
    }
    for (const slug of houseBags) await runWave({ source: join(bagsDir, slug), uriDir: bagsDir, toBag: wikiBagUri(slug), skipTop: [] }, `bag ${slug}`);
    for (const slug of houseWikis) await runWave({ source: join(wikisDir, slug), uriDir: wikisDir, toBag: wikiSlotUri(slug, "working"), wiki: slug, skipTop: ["recovery", TEMP_LAYER_DIR] }, `wiki ${slug}`);
  }

  // ── KAHUA LIFTS, on the operator's confirmed count alone. ──
  const lifted: Array<{ title: string; cid: string; handleIndex: number }> = [];
  let pending: KahuaPreviewItem[] = [];
  if (kahuaPreview.length > 0 && apply) {
    const confirmed = liftKahua !== null ? liftKahua === kahuaPreview.length
      : opts.confirmKahua !== undefined ? await opts.confirmKahua(kahuaPreview.length, kahuaPreview) : false;
    if (confirmed) {
      for (const p of kahuaPreview) {
        const item = liftOf.get(p)!;
        try {
          const { cid } = await doors.kahuaLift(p.handleIndex, { title: item.title, text: item.text, fields: item.fields, taint: item.taint, sources: item.sources, parent: p.parent });
          lifted.push({ title: p.title, cid, handleIndex: p.handleIndex });
        } catch (e) { refuseKahua(p.relation, target.get(p.relation)!, `${p.title} (${e instanceof Error ? e.message : String(e)})`); pending.push(p); }
      }
    } else pending = [...kahuaPreview];
    writeKahuaPending(pending);
  } else if (apply && kahuaPreview.length === 0) writeKahuaPending([]);
  const stillWaiting = apply ? pending : kahuaPreview;
  for (const p of stillWaiting) markPartial(p.relation, `${stillWaiting.filter((q) => q.relation === p.relation).length} kahua item(s) wait for a hand`);
  for (const [r, n] of kahuaRefusedBy) if (target.get(r)?.relation !== r) markPartial(r, `${n} kahua item(s) of h${target.get(r)!.handleIndex} refused`);

  // ── ASHES: an adopted face whose landing left nothing pending. ──
  const ashes: Array<{ relation: string; moved: string[] }> = [];
  const ashesLeft: Array<{ relation: string; why: string }> = [];
  for (const a of adoptions) {
    const why = partial.get(a.relation);
    if (why !== undefined) { ashesLeft.push({ relation: a.relation, why }); continue; }
    if (!apply) continue;
    const moved = moveFaceToAshes(projections, a.relation);
    if ("left" in moved) ashesLeft.push({ relation: a.relation, why: moved.left });
    else ashes.push({ relation: a.relation, moved: [...moved.moved] });
  }

  return { applied: apply, adoptions, layers, files, kahua: { preview: kahuaPreview, lifted, pending: stillWaiting, refused: kahuaRefused }, ashes, ashesLeft, waiting, refusals, minted, any: true };
}

/** The lines a person reads for a mirror leg's result. */
export function mirrorLines(r: MirrorSeedResult): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  if (!r.any) return { out, err };
  for (const a of r.adoptions) out.push(`mirrors: the former face ${a.relation} ("${a.petname}") adopts onto h${a.handleIndex} (${a.toRelation})`);
  for (const x of r.refusals) err.push(`mirrors: refused ${x.message}`);
  for (const w of r.waiting) out.push(`mirrors: ${wearItLine(w, "seed")}; its folders (${w.relations.join(", ")}) stay as they stand, and nothing of its memory laid into any layer`);
  for (const b of r.minted) out.push(`  ${r.applied ? "minted" : "would mint"} ${b} (this vessel held no such wiki)`);
  for (const t of r.layers) {
    out.push(`  ${t.mirror} -> ${t.toBag}: ${r.applied ? `landed ${t.landed}` : `would land ${t.planned}`}${t.kapae > 0 ? ` · kāpae ${t.kapae}` : ""} · stood off ${t.stoodOff.length} · refused ${t.refused.length}`);
    for (const s of t.stoodOff) err.push(`    stands off: ${s}`);
    for (const s of t.refused) err.push(`    refused: ${s}`);
  }
  if (r.files.placed + r.files.planned > 0) out.push(`  drafts and temp: ${r.applied ? `placed ${r.files.placed}` : `would place ${r.files.planned}`}`);
  for (const s of r.files.stoodOff) err.push(`    stands off: ${s}`);
  if (r.kahua.preview.length > 0) {
    out.push(`  kahua: ${r.kahua.preview.length} item(s) the seed would lift, each under its face's grant:`);
    for (const p of r.kahua.preview) out.push(`    h${p.handleIndex}${p.petname ? ` ("${p.petname}")` : ""}  ${p.title}  sha256:${p.digest.slice(0, 16)}  ${p.state === "differs" ? "differs from the standing head" : "new"}`);
  }
  for (const l of r.kahua.lifted) out.push(`  kahua: lifted ${l.title} under h${l.handleIndex} (${l.cid.slice(0, 16)})`);
  if (r.kahua.pending.length > 0) {
    const n = r.kahua.pending.length;
    out.push(`  kahua: ${n} item(s) stand pending; nothing lifts on --yes alone: lift with \`lares vessel seed --apply --lift-kahua ${n}\` or \`lares shore lift-kahua --count ${n}\``);
  }
  for (const s of r.kahua.refused) err.push(`    kahua refused: ${s}`);
  for (const a of r.ashes) { out.push(`  ashes: the former face ${a.relation}'s folders move out of the live mirror set:`); for (const m of a.moved) out.push(`    ${m}`); }
  for (const a of r.ashesLeft) out.push(`  ashes: the former face ${a.relation}'s folders stay where they stand: ${a.why}`);
  return { out, err };
}

/** Whether a result left anything standing a hand must answer. */
export function mirrorsLeftWork(r: MirrorSeedResult): boolean {
  return r.refusals.length > 0 || r.layers.some((t) => t.stoodOff.length + t.refused.length > 0) || r.files.stoodOff.length > 0 || r.kahua.refused.length > 0;
}

// ── the live doors ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lay one folder through INGEST's three-way gate against the vessel's synced base: a carrier whose disk equals its base
 * takes no wave (the second seed lands nothing), a moved one lands, and one whose records moved too stands off. The wave
 * rides unattended, so a file that holds no base over records that say something else stands off rather than adopting.
 */
export async function liveLay(wave: MirrorWave, apply: boolean): Promise<MirrorLaid> {
  const tree = openSyncedTree();
  const abs = mirrorFiles(wave.source, wave.skipTop).filter((r) => !r.endsWith(".meta")).map((r) => join(wave.source, ...r.split("/")));
  const scan = scanFiles(wave.source, abs, wave.toBag, tree, (_r, f) => mirrorDirFileToUri(wave.uriDir, f));
  const bases = wave.bases ?? {};
  const candidates = candidatesOf(scan.rows).map((r) => (bases[r.uri] !== undefined ? { ...r, overrideBase: bases[r.uri]! } : r));
  const kapae = scan.shadows ?? [];
  const refused = [
    ...scan.rows.filter((r) => r.status === "non-nfc").map((r) => ({ uri: r.uri, why: "non-NFC bytes" })),
    ...(scan.refusedShadows ?? []).map((r) => ({ uri: r.file, why: r.refusal })),
  ];
  const read: MirrorLaid = { planned: candidates.map((c) => c.uri), kapae, landed: [], kapaeRaised: [], conflicts: [], refused, unanswered: [] };
  if (!apply || (candidates.length === 0 && kapae.length === 0)) return read;
  const settled = await settleIngest({
    source: wave.source, toBag: wave.toBag, candidates, did: await vesselDid(), unattended: true,
    ...(wave.wiki !== undefined ? { inWiki: true, wiki: wave.wiki } : {}), ...(kapae.length > 0 ? { kapae } : {}),
  }, tree);
  if (settled.first.status === "error") {
    const why = settled.first.errorMessage ?? "INGEST refused";
    return { ...read, refused: [...refused, ...candidates.map((c) => ({ uri: c.uri, why })), ...kapae.map((t) => ({ uri: t, why }))] };
  }
  const k = (summaryOutput(settled.first) as { kapae?: { raised?: unknown; refused?: unknown } } | null)?.kapae;
  return {
    ...read,
    landed: [...settled.landed],
    kapaeRaised: Array.isArray(k?.raised) ? k.raised.map(String) : [],
    conflicts: settled.conflicts.map((c) => ({ uri: c.uri, why: c.why })),
    refused: [...refused, ...settled.refused.map((c) => ({ uri: c.uri, why: c.why })),
      ...(Array.isArray(k?.refused) ? (k.refused as Array<Record<string, unknown>>).map((r) => ({ uri: String(r["uri"]), why: String(r["code"]) })) : [])],
    unanswered: [...settled.unanswered],
  };
}

export const LIVE_MIRROR_DOORS: MirrorDoors = {
  faces: LIVE_CARRY_DOORS.faces,
  tempConsented: LIVE_CARRY_DOORS.tempConsented,
  heldSlugs: LIVE_CARRY_DOORS.heldSlugs,
  mintBag: LIVE_CARRY_DOORS.mintBag,
  kahuaLift: LIVE_CARRY_DOORS.kahuaLift,
  lay: liveLay,
  sourced: (slug) => { try { return canonIsDisk({ holding: slug, source: join(daemonBagsDir(), slug) }); } catch { return false; } },
};
