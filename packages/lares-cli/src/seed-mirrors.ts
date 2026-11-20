/**
 * seed-mirrors — the lay's second leg: every disk mirror under the projections root laid back into the ONE layer it
 * mirrors, through INGEST's three-way gate.
 *
 * THE LAW. A lay lays every disk mirror back into the one layer it mirrors (disk equal to the base: nothing; the disk
 * moved: it lands; both moved: a stand-off at the shore, within that one layer), and a second lay lands nothing:
 *
 *   projections/faces/<pet name>/wiki   -> that face's daemon WORKING (`wikis/daemon/working`); a kāpae shadow raises as a kāpae
 *   projections/faces/<pet name>/canon  -> that face's daemon canon (`bags/daemon-<F>`)
 *   projections/faces/<pet name>/stage  -> that face's kahua stage, by the operator's hand alone (below)
 *   projections/realms/<realm pet name>/bags/<slug> -> that bag's canon (a plain projections/bags/<bag> too)
 *   projections/realms/<realm pet name>/wikis/<slug> -> that wiki's ONE workbench (`wikis/<slug>/working`), once for its
 *                                     document, at the wear of a face that holds a writer's seat there (or of the face that stands it first)
 *   <canon source>/../wikis/<slug> -> a sourced wiki's one workbench, beside its canon source, by the same law
 *   projections/faces/<pet name>/personal/<slug> -> that face's own personal layer of that wiki (`wikis/<slug>/personal`): its
 *                                     overlay, the layer a face that holds no writer's seat in the wiki's workbench writes
 *   faces/<pet name>/recovery, temp -> nothing: drafts and temp files rest as files (an import places them back)
 *   projections/ashes/**           -> nothing: never read back, never projected into
 *
 * Canon lays before working (a working copy forks its override base off the canon under it). A canon pour never writes
 * working; only a working layer's OWN mirror flows back into it, and the top layer always shadows: nothing retracts,
 * nothing stands off against a lower layer, and the lay's canon leg only warns where canon stands fresher.
 *
 * THE FACE ROOT CARRIES ACROSS A RE-FOUND (face-pools #/shape). A face's private planes rest in one root keyed by its pet name,
 * and a re-founding keeps the projections root, so the face re-minted under the same pet name finds its root where it stands:
 * the lay lays it in place, and nothing adopts, copies or moves. Each root lands on the ONE face whose pet name makes that
 * folder, else the lay refuses THAT root by name and lands nothing of it (no such face, two such faces, or a face whose pet
 * name meets another face's folder without case: a face's private memory never lands on another person's face), and goes on
 * for every other root. A face standing shut waits for its root; a face whose pet-name would not read blocks only the roots no
 * other face claims. So a tear-out with no export recovers from disk alone. A working wave restores each copy's fork base off
 * every bases sidecar the face's pet name ever labelled.
 *
 * THE LIT SET. One lay lays every OPEN face's working and face-canon folders, each into that face's own layer: the daemon mount's through the ordinary wave, every other open face's through a wave naming that face
 * (`MirrorWave.face`), which the island lands only where the vessel's device table names that face as the document's owner and
 * never on the daemon mount. A face that stands SHUT places nothing into any layer: the lay names it ("<pet-name> stays shut:
 * `lares vault unlock --face N`, then lay again"), an expected state rather than a stand-off, and its root stays as it stands
 * until its own lay lands it. No face's private memory ever lands in another face. Kahua lifts sign per face under that
 * face's own grant, so they ride every face.
 *
 * A WORKBENCH LAYS ONCE, FOR ITS DOCUMENT (cabal-realm#/the-workbench; operator, 2026-11-14: "most wikis should NOT seed
 * per-face because shared crdts"). A wiki's workbench stands as ONE document on a vessel with ONE folder, so the lay lays
 * that folder once, through the daemon mount's island, where the daemon mount holds a writer's seat in the workbench (`benchSeat`)
 * or stands the wiki first on this founding. Under a face that holds no writer's seat the folder waits by name for a seated
 * writer's wear, nothing of it lands in that face's `personal` layer, nor does the wiki mint into that face's catalog (a face
 * lists a wiki it stood or one a share row carried to it), and the lay exits 0. AFTER A RE-FOUNDING the share rows
 * (`config/share.tid`, vessel-private) name each shared wiki's owner by pet-name: the wiki mints again and its folders lay at
 * that owner's wear alone, and every other face waits by name; then the lay lands the shares again, seating each named face
 * by pet-name. A face's personal layer lays at that face's own wear.
 *
 * KAHUA LIFTS BY THE OPERATOR'S HAND, WITH EYES. The lay previews every kahua item it would lift per face (title, body
 * digest, face; a file that differs from a standing head reads `differs`), then lifts them under the target face's grant,
 * keyed by title and body digest, signed by that face, ONLY on a typed confirmation naming the count (a TTY) or
 * `--lift-kahua <N>` with N equal to the previewed count. A bare `--yes` lifts nothing in kahua; a wrong count refuses
 * before anything writes. Unconfirmed items stand pending (`kahua-pending.json` under the config home), listed by
 * `lares shore` and liftable later with the same count rule (`lares shore lift-kahua --count <N>`).
 *
 * ASHES. The lay moves nothing to ashes: a root whose pet name no face carries refuses by name and stays where it stands, for
 * the operator to found that face again, rename one onto it, or burn it (`ashes.ts` serves a burned pet name alone).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { daemonFaceCanonBag, wikiBagUri, wikiSlotUri } from "@lararium/mesh";
import {
  larProjectionsHome, larConfigHome, isPrivateProjectionSlug, KAPAE_EXT, TEMP_LAYER_DIR, parseTidCarrier, atomicWriteFileSync, daemonBagsDir,
  FACES_PROJECTION_DIR, FACE_PLANES, faceSegmentRefusal, labelledRelations, readFaceLabel, readFaceBases,
  mirrorFiles, siteWaveFile, liveLay as layWave, type MirrorWave, type MirrorLaid, realmFoldersOnDisk } from "@lararium/node";
import { parseShareFile, type ShareEntry } from "@lararium/mesh";
import { LIVE_BUNDLE_DOORS, mountFaceOf, unlockItLine, FACE_LAYER_WAITS, type BundleDoors, type BundleVesselFace } from "./commands/house-bundle.js";
import { LIVE_SHARE_DOORS, landShares } from "./share-doors.js";
import { runVerb } from "./verb-call.js";
import { skipLines, submitIngest, type SubmitIngestOpts, type ScanSkip } from "./ingest-core.js";
import { summaryOutput, type SubmitResult } from "./verb-result.js";
import { vesselDid } from "./env.js";
import { canonIsDisk } from "./holdings.js";
import { sha256Hex, type BundleKahuaHead } from "./bundle-manifest.js";

// ── the doors ──────────────────────────────────────────────────────────────────────────────────────────────────

/** One mirror folder laid into the one layer it mirrors, and what its wave planned and landed (`@lararium/node` ingest-scan). */
export type { MirrorWave, MirrorLaid } from "@lararium/node";

/** The doors the mirror leg reaches a vessel through, injectable so a test drives them with no vessel standing. */
export interface MirrorDoors {
  readonly faces: BundleDoors["faces"];
  readonly tempConsented: BundleDoors["tempConsented"];
  readonly heldSlugs: BundleDoors["heldSlugs"];
  readonly mintBag: BundleDoors["mintBag"];
  readonly mintWiki?: BundleDoors["mintWiki"];
  readonly kahuaLift: BundleDoors["kahuaLift"];
  /** Scan one folder against the synced base and, applied, lay its new and moved carriers through INGEST's gate. */
  readonly lay: (wave: MirrorWave, apply: boolean) => Promise<MirrorLaid>;
  /** Whether a slug's canon stands under the canon source (the holdings leg feeds it; the mirror leg leaves it). */
  readonly sourced: (slug: string) => boolean;
  /** The `wikis` dir beside the canon source, where a sourced wiki's one workbench folder rests; null: none stands. */
  readonly canonWikis?: () => string | null;
  /**
   * The daemon mount's seat on a wiki's workbench (`workbench-seat`): its write layer there, and whether the vessel's ledger binds
   * the slug at all on this founding. Absent (a rig with no roster): the daemon mount writes every workbench.
   */
  readonly benchSeat?: (slug: string) => Promise<{ readonly writeSlot: "working" | "personal" | null; readonly bound: boolean }>;
  /** The share rows the vessel-private file holds (`config/share.tid`); absent: none. */
  readonly shareRows?: () => readonly ShareEntry[];
  /** Land the shares again (`share-apply`), seating each named face by pet-name; null where no vessel answers. Absent: no landing. */
  readonly landShares?: () => Promise<Record<string, unknown> | null>;
}

// ── refusals and readings ──────────────────────────────────────────────────────────────────────────────────────

/** A refusal the mirror leg raises by name before anything writes; the message carries the cure. */
export class MirrorRefused extends Error {
  override readonly name = "MirrorRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

/** One kahua item the lay would lift: what a person reads before they confirm. */
export interface KahuaPreviewItem {
  readonly handleIndex: number;
  readonly petname: string | null;
  /** The face root whose stage holds the file (`faces/<pet name>`): its pet-name segment. */
  readonly folder: string;
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
  /** The files the wave read no carrier from, each with why. */
  skipped: ScanSkip[];
}

export interface MirrorSeedResult {
  readonly applied: boolean;
  readonly layers: readonly MirrorLayerTally[];
  readonly kahua: {
    readonly preview: readonly KahuaPreviewItem[];
    readonly lifted: ReadonlyArray<{ readonly title: string; readonly cid: string; readonly handleIndex: number }>;
    readonly pending: readonly KahuaPreviewItem[];
    /** The items of an open face the vessel does not wear: each lifts at its own face's wear, and stays at the shore until then. */
    readonly waiting: readonly KahuaPreviewItem[];
    readonly refused: readonly string[];
  };
  /**
   * THE FACES THAT WAIT THEIR TURN: each face whose root stands on disk while that face stands SHUT, or (`why: "unresolved"`)
   * stands open where the island resolves no layer of its own for a wave naming it (`face-unresolved`), or (`why: "unworn"`)
   * stands open and unworn while its personal layers wait for its own wear. `folders` names the folders that wait. Nothing of theirs
   * laid into any layer; their folders stay until their own lay lands them.
   */
  readonly waiting: ReadonlyArray<{ readonly handleIndex: number; readonly petname: string | null; readonly folders: readonly string[]; readonly why?: "unresolved" | "unworn" }>;
  /**
   * THE WORKBENCH FOLDERS THAT WAIT: each wiki whose one folder (or whose canon folder) holds a carrier new or moved while the
   * daemon mount may not lay it: `writer` (the daemon mount holds no writer's seat there: a seated writer's wear lays it) or `owner`
   * (a share row names another face as the wiki's owner, and no face stood the wiki on this founding yet). Nothing of the
   * folder landed anywhere.
   */
  readonly benchWaiting: ReadonlyArray<{ readonly slug: string; readonly folder: string; readonly why: "writer" | "owner"; readonly owner?: string }>;
  /** What the closing share landing answered (`share-apply`), where the lay ran one. */
  readonly shares?: {
    readonly granted: number;
    /** Of the granted, how many moved something this landing (`share-apply`'s `moved`); a replay moves none, and the lay says nothing for it. */
    readonly moved: number;
    readonly carried: number; readonly pending: number;
    readonly workbenches: ReadonlyArray<{ readonly slug: string; readonly members: number; readonly founded: boolean; readonly seated: number; readonly removed: number }>;
  };
  /** Each face root the lay refused by name (unmatched, doubly named, colliding, unread), by its folder: it landed nothing, and the rest went on. */
  readonly refusals: ReadonlyArray<{ readonly face: string; readonly code: string; readonly message: string }>;
  readonly minted: readonly string[];
  /** Whether the projections root held any mirror the leg reads. */
  readonly any: boolean;
}

// ── kahua pending ──────────────────────────────────────────────────────────────────────────────────────────────

export const KAHUA_PENDING_FILE = "kahua-pending.json";
const KAHUA_PENDING_SCHEMA = "lar-kahua-pending";

/** `<root>/config/kahua-pending.json`: the config class survives a restart and a reset, and never sits in the hearth. */
export function kahuaPendingPath(): string {
  return join(larConfigHome(), KAHUA_PENDING_FILE);
}

/** The kahua items standing pending for a hand, as the last lay previewed them. */
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

const folders = (dir: string): string[] => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort(); } catch { return []; } };

/** Every plain file under a mirror dir, the top dirs named and every path `HOUSE_IGNORED` names left out (`@lararium/node`). */
export { mirrorFiles };

/** A kahua stage file read as a lift: its title, body, lift fields, taint and sources. Null for bytes that name no item. */
export function readKahuaFile(text: string): { title: string; text: string; fields: Record<string, string>; taint: string[]; sources: BundleKahuaHead["sources"] } | null {
  const parsed = parseTidCarrier(text);
  if (parsed === null) return null;
  // THE BODY RIDES BYTE FOR BYTE: the projector writes a stage carrier's body as it stands and adds no newline, so a trailing
  // newline belongs to the body. (A walked re-lift dropped it, and every later import stood that row off against the bundle.)
  const body = parsed["text"] ?? "";
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
  const bagsDir = join(projections, "bags"), facesDir = join(projections, FACES_PROJECTION_DIR);
  // A REALM'S FOLDERS (`realms/<realm pet name>/wikis/<slug>`, `/bags/<slug>`): each workbench and each canon bag the disk holds,
  // read off the disk alone, each slug with the plane base its address derives against.
  const onDisk = realmFoldersOnDisk(projections);
  const wikiBase = new Map(onDisk.filter((f) => f.plane === "wikis").map((f) => [f.slug, f.base] as [string, string]));
  const bagBase = new Map<string, string>([...folders(bagsDir).map((n) => [n, bagsDir] as [string, string]), ...onDisk.filter((f) => f.plane === "bags").map((f) => [f.slug, f.base] as [string, string])]);
  const wikiFolders = [...wikiBase.keys()], bagFolders = [...bagBase.keys()].sort();
  // EACH FACE'S ONE ROOT (`faces/<pet name>/`): its daemon working layer, its daemon canon, its kahua stage and its personal layers.
  // Its `recovery/` and `temp/` hold drafts and temp files that place back as files, never through a layer: the lay reads neither.
  const faceFolders = folders(facesDir).filter((seg) => mirrorFiles(join(facesDir, seg), [FACE_PLANES.recovery, FACE_PLANES.temp]).length > 0);
  // A SOURCED WIKI'S ONE WORKBENCH FOLDER rests beside the canon source (`<source>/../wikis/<slug>`).
  const canonWikis = opts.kahuaOnly ? null : doors.canonWikis?.() ?? null;
  const sourcedBenches = canonWikis === null || resolve(canonWikis) === resolve(join(projections, "wikis")) ? []
    : folders(canonWikis).filter((n) => doors.sourced(n) && mirrorFiles(join(canonWikis, n), ["recovery", TEMP_LAYER_DIR]).length > 0);
  const houseBags = bagFolders.filter((n) => !isPrivateProjectionSlug(n) && !doors.sourced(n));
  const houseWikis = wikiFolders.filter((n) => !isPrivateProjectionSlug(n) && !doors.sourced(n));
  const empty: MirrorSeedResult = { applied: apply, layers: [], kahua: { preview: [], lifted: [], pending: [], waiting: [], refused: [] }, waiting: [], refusals: [], minted: [], any: false, benchWaiting: [] };
  if (faceFolders.length === 0 && (opts.kahuaOnly || houseBags.length + houseWikis.length + sourcedBenches.length === 0)) return empty;

  // ── THE FACE MAP: each face root lands on the ONE face whose pet name makes that folder. ──
  let faces: BundleVesselFace[] = [];
  try { faces = await doors.faces(); }
  catch (e) { throw new MirrorRefused("seed-faces-unread", `the projections root holds mirrors and the faces this vessel wears would not read (${e instanceof Error ? e.message : String(e)}): stand the vessel and unlock its key (\`lares vessel stand\`, then \`lares vault unlock\`), and lay again`); }
  /** The folder each face's pet name makes, or the segment rule's refusal (another face's case-twin among them). */
  const named = faces.filter((f) => f.petname !== null && f.petname !== "");
  const segmentOf = new Map<number, { segment: string } | { code: string; why: string }>();
  for (const f of named) {
    const others = named.filter((o) => o.handleIndex !== f.handleIndex).map((o) => o.petname!.normalize("NFC")).filter((o) => faceSegmentRefusal(o) === null);
    const refused = faceSegmentRefusal(f.petname, others);
    segmentOf.set(f.handleIndex, refused === null ? { segment: f.petname!.normalize("NFC") } : refused);
  }
  /** Each face root this lay lays, by its folder, with the face it lands on. */
  const target = new Map<string, BundleVesselFace>();
  // ONE FOLDER'S REFUSAL NEVER HALTS THE REST: an unmatched, doubly-named or colliding folder records its line and lands
  // nothing, and the lay goes on for every other folder.
  const refusals: Array<{ face: string; code: string; message: string }> = [];
  const refuse = (face: string, code: string, message: string): void => { refusals.push({ face, code, message: `${code}: ${message}` }); };
  // A face that stands SHUT (it reads no relation) waits its turn for its root: wear it and lay again.
  const shutWaiting = new Map<number, { handleIndex: number; petname: string | null; folders: string[] }>();
  for (const seg of faceFolders) {
    const root = join(facesDir, seg);
    const matches = named.filter((f) => f.petname!.normalize("NFC") === seg.normalize("NFC"));
    if (matches.length > 1) { refuse(seg, "seed-face-duplicate-petname", `faces ${matches.map((m) => `h${m.handleIndex}`).join(" and ")} on this vessel both carry the pet-name "${seg}", which names the face root ${root}; one face's memory lands on one face alone, so rename one and lay again`); continue; }
    const face = matches[0];
    if (face === undefined) {
      // A face whose pet-name would not read may carry this folder: it waits while that stays unknown, and only it.
      const unread = faces.find((f) => f.relation === null && f.petname === null && f.kahuaRefusal !== undefined);
      if (unread !== undefined) { refuse(seg, "seed-faces-unread", `the face h${unread.handleIndex} reads no face relation and no pet-name (${unread.kahuaRefusal}), so the lay cannot tell whether the face root ${root} belongs to it: unlock it (\`lares vault unlock --face ${unread.handleIndex}\`) and lay again`); continue; }
      refuse(seg, "seed-face-unmatched", `no face on this vessel carries the pet-name "${seg}", which names the face root ${root}; the lay never lands one face's memory on another's: found it (\`lares persona new <N> --name '${seg}'\`), or rename the face that should hold it, and lay again`);
      continue;
    }
    const site = segmentOf.get(face.handleIndex);
    if (site !== undefined && !("segment" in site)) { refuse(seg, site.code, `${site.why} (the face root ${root} lands nothing until it does)`); continue; }
    if (face.relation === null) {
      const w = shutWaiting.get(face.handleIndex) ?? { handleIndex: face.handleIndex, petname: face.petname, folders: [] };
      w.folders.push(root);
      shutWaiting.set(face.handleIndex, w);
      continue;
    }
    target.set(seg, face);
  }
  /** The face roots that land on a face this lay: refused and shut-waiting roots stay where they stand. */
  const placed = faceFolders.filter((seg) => target.has(seg));

  // ── THE LIT SET: every OPEN face's root lays in one lay, each into that face's own layer. ──
  // The daemon mount's ride the ordinary wave (the daemon's working layer holds its document); each other open face's ride a wave
  // naming that face, which the island lands only where that face owns the document, never on the daemon mount. A SHUT face waits,
  // named: nothing of its memory lands anywhere, its root stays until its own lay lands it, and it never blocks the rest.
  const litRelation = mountFaceOf(faces)?.relation ?? null;
  const faceArgOf = (face: BundleVesselFace): { face?: number } => face.relation === litRelation ? {} : { face: face.handleIndex };
  // An open face whose named wave the island resolves no layer for (`face-unresolved`) waits by name, as a shut face does.
  const unresolved = new Map<number, { handleIndex: number; petname: string | null; folders: string[]; why: "unresolved" }>();
  // An open face that stands unworn waits for its own wear with its personal layers: a wiki's island stands over the daemon mount's personal document alone.
  const unworn = new Map<number, { handleIndex: number; petname: string | null; folders: string[]; why: "unworn" }>();
  const waitingNow = () => [...shutWaiting.values(), ...unresolved.values(), ...unworn.values()].sort((a, b) => a.handleIndex - b.handleIndex);

  // ── KAHUA: the preview first, and a wrong count refuses before anything writes. ──
  const kahuaPreview: KahuaPreviewItem[] = [];
  const kahuaRefused: string[] = [];
  const refuseKahua = (face: BundleVesselFace, line: string): void => { kahuaRefused.push(`h${face.handleIndex}${face.petname ? ` ("${face.petname}")` : ""}: ${line}`); };
  const liftOf = new Map<KahuaPreviewItem, NonNullable<ReturnType<typeof readKahuaFile>>>();
  for (const seg of placed) {
    const folder = join(facesDir, seg, FACE_PLANES.stage);
    const face = target.get(seg)!;
    for (const rel of mirrorFiles(folder)) {
      if (rel.endsWith(".meta") || rel.endsWith(KAPAE_EXT)) continue;
      const path = join(folder, ...rel.split("/"));
      const item = readKahuaFile(readFileSync(path, "utf8"));
      if (item === null) { refuseKahua(face, `${path} (names no kahua item)`); continue; }
      const digest = sha256Hex(item.text);
      if (face.kahua === null) { refuseKahua(face, `${item.title} (its stage would not read: ${face.kahuaRefusal ?? "unread"})`); continue; }
      const standing = face.kahua.filter((h) => h.title === item.title);
      if (standing.some((h) => sha256Hex(h.text) === digest)) continue;          // the stage already holds this body
      if (standing.length > 1) { refuseKahua(face, `${item.title} (the stage holds ${standing.length} sibling heads; settle them by hand)`); continue; }
      const p: KahuaPreviewItem = { handleIndex: face.handleIndex, petname: face.petname, folder: seg, title: item.title, digest, path, state: standing.length === 0 ? "new" : "differs", parent: standing[0]?.cid ?? null };
      if (kahuaPreview.some((q) => q.handleIndex === p.handleIndex && q.title === p.title && q.digest === p.digest)) continue;
      kahuaPreview.push(p);
      liftOf.set(p, item);
    }
  }
  // A LIFT RIDES THE DAEMON MOUNT: a face's local canon rests sealed under its own key and its hand signs under its own
  // grant, so the vessel lifts for the face it mounts alone (`chore-face-not-mounted`). An item of another open face waits by name at the
  // shore; the count a hand confirms names what this wear lifts. Where no door reads which face stands as the mount, every item lifts.
  const mountIndex = faces.some((f) => f.mounted !== undefined) ? (mountFaceOf(faces)?.handleIndex ?? null) : undefined;
  const liftsHere = (p: KahuaPreviewItem): boolean => mountIndex === undefined || p.handleIndex === mountIndex;
  const kahuaLiftable = kahuaPreview.filter(liftsHere);
  const kahuaElsewhere = kahuaPreview.filter((p) => !liftsHere(p));
  const liftKahua = opts.liftKahua ?? null;
  if (apply && liftKahua !== null && liftKahua !== kahuaLiftable.length) {
    throw new MirrorRefused("seed-kahua-count", `--lift-kahua ${liftKahua} names ${liftKahua} item(s) and the preview counts ${kahuaLiftable.length} this wear lifts${kahuaElsewhere.length > 0 ? ` (${kahuaElsewhere.length} more wait for their own face's wear)` : ""}; nothing lifted and nothing wrote: read the preview (\`lares vessel seed\`) and name its count`);
  }

  const layers: MirrorLayerTally[] = [];
  const benchWaiting: Array<{ slug: string; folder: string; why: "writer" | "owner"; owner?: string }> = [];
  let shares: MirrorSeedResult["shares"];
  const minted: string[] = [];

  if (!opts.kahuaOnly) {
    const runWave = async (wave: MirrorWave, label: string): Promise<void> => {
      const laid = await doors.lay(wave, apply);
      // A WAVE NAMING A FACE THE ISLAND OPENS NO LAYER FOR lands nothing anywhere: the face waits by name, never a refusal flood.
      // The island answers `face-unresolved` where it resolves no document for the face, and `document-unavailable` where the
      // face's own layer rests sealed under its own key (a lit sibling's daemon layer opens at its own wear): one expected wait.
      if (wave.face !== undefined && laid.landed.length === 0 && laid.refused.length > 0 && laid.refused.every((c) => FACE_LAYER_WAITS.test(c.why))) {
        const face = [...target.values()].find((f) => f.handleIndex === wave.face);
        const w = unresolved.get(wave.face) ?? { handleIndex: wave.face, petname: face?.petname ?? null, folders: [], why: "unresolved" as const };
        if (!w.folders.includes(wave.source)) w.folders.push(wave.source);
        unresolved.set(wave.face, w);
        return;
      }
      const t: MirrorLayerTally = { mirror: label, toBag: wave.toBag, planned: laid.planned.length, landed: laid.landed.length, kapae: laid.kapaeRaised.length, stoodOff: [], refused: [], skipped: [...(laid.skipped ?? [])] };
      for (const c of laid.conflicts) t.stoodOff.push(`${c.uri} (${c.why})`);
      for (const c of laid.refused) t.refused.push(`${c.uri} (${c.why})`);
      for (const u of laid.unanswered) t.refused.push(`${u} (no answer; lay again)`);
      if (t.planned + t.landed + t.kapae + t.stoodOff.length + t.refused.length + t.skipped.length > 0 || laid.kapae.length > 0) layers.push(t);
    };

    // EACH FACE ROOT lays where it stands, canon before working: the pet name carries across a re-found, so the re-minted
    // face's root IS the former face's root, and nothing copies or moves. A working wave restores each copy's fork base off
    // every bases sidecar its pet name ever labelled (the face's own relation wins a title both name).
    for (const seg of placed) {
      const face = target.get(seg)!;
      const root = join(facesDir, seg);
      const faceArg = faceArgOf(face);
      for (const kind of ["canon", "working"] as const) {
        const source = join(root, kind === "canon" ? FACE_PLANES.canon : FACE_PLANES.wiki);
        if (!existsSync(source)) continue;
        const skipTop = kind === "working" ? [TEMP_LAYER_DIR] : [];
        const toBag = kind === "canon" ? daemonFaceCanonBag(face.relation!) : wikiSlotUri("daemon", "working");
        const bases: Record<string, string> = {};
        if (kind === "working") {
          const former = labelledRelations(projections).filter((r) => r !== face.relation && readFaceLabel(r, projections)?.petname.normalize("NFC") === seg);
          for (const r of [...former, face.relation!]) Object.assign(bases, readFaceBases(r, projections));
        }
        await runWave({ source, uriDir: root, toBag, skipTop, ...(Object.keys(bases).length > 0 ? { bases } : {}), ...faceArg }, `${kind} ${seg}`);
      }
    }

    // HOUSE BAGS (canon) before WORKBENCHES (working): a slug this vessel does not hold mints first, through CREATE.
    // THE OWNER GATE: a share row names a shared wiki's owner by pet-name. Where no face stood the wiki on this founding yet,
    // it mints and lays at THAT face's wear alone, so a re-founding never hands a wiki to whichever face lays first.
    const mountFace = mountFaceOf(faces);
    const shareRows = doors.shareRows?.() ?? [];
    const ownerOf = (slug: string): string | null => shareRows.find((r) => r.kind === "wiki" && r.slug === slug)?.owner ?? null;
    const seatOf = async (slug: string): Promise<{ writeSlot: "working" | "personal" | null; bound: boolean }> =>
      litRelation === null || doors.benchSeat === undefined ? { writeSlot: "working", bound: true } : doors.benchSeat(slug);
    /** Why the daemon mount may not lay this wiki's folders now, or null where it may. */
    const benchGate = async (slug: string): Promise<{ why: "writer" | "owner"; owner?: string } | null> => {
      if (litRelation === null) return null;                          // no face mounted: the veil floor's own working document takes it
      const seat = await seatOf(slug);
      if (seat.bound) return seat.writeSlot === "working" ? null : { why: "writer" };
      const owner = ownerOf(slug);
      return owner !== null && mountFace?.petname !== owner ? { why: "owner", owner } : null;
    };
    const waitBench = (slug: string, folder: string, gate: { why: "writer" | "owner"; owner?: string }): void => {
      if (!benchWaiting.some((w) => w.folder === folder)) benchWaiting.push({ slug, folder, why: gate.why, ...(gate.owner !== undefined ? { owner: gate.owner } : {}) });
    };
    const gates = new Map<string, { why: "writer" | "owner"; owner?: string } | null>();
    const gateOf = async (slug: string) => { if (!gates.has(slug)) gates.set(slug, await benchGate(slug)); return gates.get(slug)!; };
    // A SHARED WIKI MINTS FROM ITS SHARE ROW, at its owner's wear, even where no page of it reached a mirror (a face's put into
    // a wiki it never woke projects nowhere until the wake): the row names the wiki, so the wiki stands again for its faces.
    const sharedWikis = shareRows.filter((r) => r.kind === "wiki" && !isPrivateProjectionSlug(r.slug) && !doors.sourced(r.slug)).map((r) => r.slug);
    const mintable = [...new Set([...houseBags, ...houseWikis, ...sharedWikis])].sort();
    const held = mintable.length > 0 ? await doors.heldSlugs() : new Set<string>();
    /** The slugs this lay minted (or would mint, in a preview): each stands for the waves after it. */
    const mintedSlugs = new Set<string>();
    for (const slug of mintable) {
      if (held.has(slug)) continue;
      // A wiki another face owns mints at that face's wear, and a wiki another face's realm already binds (this face holds no
      // writer's seat there) stands in the house already: nothing of either mints under this face, whose catalog names such a
      // wiki only where a share row carried it (the landing hands over the wiki's recipe row by reference).
      if ((await gateOf(slug)) !== null) continue;
      // A shared wiki with no folder mints under the daemon mount alone: the floor founds no realm for it.
      if (!houseBags.includes(slug) && !houseWikis.includes(slug) && litRelation === null) continue;
      mintedSlugs.add(slug);
      minted.push(wikiBagUri(slug));
      // A WIKI mints through the wiki door (`init-wiki`), so its recipe row stands and `--recipe <slug>` answers; a plain bag
      // through CREATE, which stands the bag alone.
      const asWiki = doors.mintWiki !== undefined && (houseWikis.includes(slug) || shareRows.some((r) => r.kind === "wiki" && r.slug === slug));
      if (apply) await (asWiki ? doors.mintWiki!(slug) : doors.mintBag(wikiBagUri(slug)));
    }
    for (const slug of houseBags) {
      const gate = held.has(slug) ? null : await gateOf(slug);
      const base = bagBase.get(slug)!;
      if (gate?.why === "owner") { waitBench(slug, join(base, slug), gate); continue; }
      await runWave({ source: join(base, slug), uriDir: base, toBag: wikiBagUri(slug), skipTop: [] }, `bag ${slug}`);
    }
    // ONE FOLDER FOR A WORKBENCH, LAID ONCE FOR ITS DOCUMENT: `<projections>/realms/<realm pet name>/wikis/<slug>`, and a sourced wiki's beside its canon
    // source. The daemon mount's island lays it where that face holds a writer's seat (or stands the wiki first); under any other
    // face the folder waits by name where it holds a carrier new or moved against its base, and nothing of it lands.
    const skipBench = ["recovery", TEMP_LAYER_DIR];
    const benchFolders = [
      ...houseWikis.map((slug) => ({ slug, source: join(wikiBase.get(slug)!, slug), uriDir: wikiBase.get(slug)!, label: `workbench ${slug}` })),
      ...(canonWikis === null ? [] : sourcedBenches.map((slug) => ({ slug, source: join(canonWikis, slug), uriDir: canonWikis, label: `workbench ${slug} (beside the canon source)` }))),
    ];
    for (const b of benchFolders) {
      if (mirrorFiles(b.source, skipBench).length === 0) continue;
      const wave: MirrorWave = { source: b.source, uriDir: b.uriDir, toBag: wikiSlotUri(b.slug, "working"), wiki: b.slug, skipTop: skipBench };
      const gate = await gateOf(b.slug);
      if (gate !== null) {
        // A folder that stands settled against its base draws no line at every lay; an unminted owner's wiki always waits.
        const read = gate.why === "owner" ? null : await doors.lay(wave, false);
        if (read === null || read.planned.length + read.kapae.length > 0) waitBench(b.slug, b.source, gate);
        continue;
      }
      await runWave(wave, b.label);
    }
    // THE SHARES LAND AGAIN, before any face's personal layer lays: each shared wiki's seats come back by pet-name once its
    // owner's wear stood it, and the landing lifts each row carried for the worn face into its own catalog half, so a reader's
    // own wear mounts the wiki its page lays into.
    if (apply && doors.landShares !== undefined && shareRows.length > 0) {
      const applied = await doors.landShares().catch(() => null);
      if (applied !== null) {
        const benches = Array.isArray(applied["workbenches"]) ? applied["workbenches"] as Array<Record<string, unknown>> : [];
        const granted = Number(applied["granted"] ?? 0);
        shares = {
          granted, moved: Number(applied["moved"] ?? granted), carried: Number(applied["carried"] ?? 0), pending: Number(applied["pending"] ?? 0),
          workbenches: benches.map((w) => ({ slug: String(w["slug"]), members: Number(w["members"] ?? 0), founded: w["founded"] === true, seated: Number(w["seated"] ?? 0), removed: Array.isArray(w["removed"]) ? w["removed"].length : 0 })),
        };
      }
    }
    const waitUnworn = (face: { handleIndex: number; petname: string | null }, folder: string): void => {
      const w = unworn.get(face.handleIndex) ?? { handleIndex: face.handleIndex, petname: face.petname, folders: [], why: "unworn" as const };
      if (!w.folders.includes(folder)) w.folders.push(folder);
      unworn.set(face.handleIndex, w);
    };
    // EACH FACE'S PERSONAL LAYERS (cabal-realm#/the-workbench; operator ruling 2026-11-11 "Personal can absorb the new caps."):
    // `faces/<pet name>/personal/<slug>` lays back into that face's own personal layer of the wiki, the daemon mount's through the
    // ordinary wave. It never lays into a shared workbench. IT LAYS AT ITS OWN FACE'S WEAR: a wiki's island stands over the
    // daemon mount's personal document and the vessel grants the personal mirror to the daemon mount's root alone, so an open face
    // that stands unworn waits by name where its personal layer holds a carrier new or moved against its base.
    for (const seg of placed) {
      const face = target.get(seg)!;
      const personalDir = join(facesDir, seg, FACE_PLANES.personal);
      for (const slug of folders(personalDir)) {
        const folder = join(personalDir, slug);
        if (face.relation !== litRelation) {
          const read = await doors.lay({ source: folder, uriDir: personalDir, toBag: wikiSlotUri(slug, "personal"), wiki: slug, skipTop: [] }, false);
          if (read.planned.length + read.kapae.length === 0) continue;
          waitUnworn(face, folder);
          continue;
        }
        // A PERSONAL LAYER OF A WIKI THAT STANDS UNMINTED WAITS FOR THE WIKI: a share row names its owner, and the wiki re-stands at
        // that owner's wear; until then this face's page of it lays nowhere, and the folder stays as it stands. The wiki STANDS
        // where this lay minted it, the worn face's catalog names it, or the vessel's ledger binds its workbench (its owner's
        // earlier wear stood it on this founding), whichever face's catalog the share landing reached so far.
        const owner = ownerOf(slug);
        const stands = async (): Promise<boolean> => mintedSlugs.has(slug) || held.has(slug) || (await doors.heldSlugs()).has(slug) || (await seatOf(slug)).bound;
        if (owner !== null && mountFace?.petname !== owner && !doors.sourced(slug) && !(await stands())) {
          if (mirrorFiles(folder).length === 0) continue;
          waitBench(slug, folder, { why: "owner", owner });
          continue;
        }
        await runWave({ source: folder, uriDir: personalDir, toBag: wikiSlotUri(slug, "personal"), wiki: slug, skipTop: [] }, `personal layer ${slug} of ${seg}`);
      }
    }
  }

  // ── KAHUA LIFTS, on the operator's confirmed count alone. ──
  const lifted: Array<{ title: string; cid: string; handleIndex: number }> = [];
  let pending: KahuaPreviewItem[] = [];
  if (kahuaPreview.length > 0 && apply) {
    const confirmed = kahuaLiftable.length === 0 ? false
      : liftKahua !== null ? liftKahua === kahuaLiftable.length
      : opts.confirmKahua !== undefined ? await opts.confirmKahua(kahuaLiftable.length, kahuaLiftable) : false;
    if (confirmed) {
      for (const p of kahuaLiftable) {
        const item = liftOf.get(p)!;
        try {
          const { cid } = await doors.kahuaLift(p.handleIndex, { title: item.title, text: item.text, fields: item.fields, taint: item.taint, sources: item.sources, parent: p.parent });
          lifted.push({ title: p.title, cid, handleIndex: p.handleIndex });
        } catch (e) { refuseKahua(target.get(p.folder)!, `${p.title} (${e instanceof Error ? e.message : String(e)})`); pending.push(p); }
      }
    } else pending = [...kahuaLiftable];
    // The shore keeps what this wear left unlifted and what waits for another face's wear.
    writeKahuaPending([...pending, ...kahuaElsewhere]);
  } else if (apply && kahuaPreview.length === 0) writeKahuaPending([]);
  const stillWaiting = apply ? pending : kahuaLiftable;

  return { applied: apply, layers, kahua: { preview: kahuaPreview, lifted, pending: stillWaiting, waiting: kahuaElsewhere, refused: kahuaRefused }, waiting: waitingNow(), refusals, minted, any: true, benchWaiting, ...(shares !== undefined ? { shares } : {}) };
}

/** The lines a person reads for a mirror leg's result. */
export function mirrorLines(r: MirrorSeedResult): { out: string[]; err: string[] } {
  const out: string[] = [], err: string[] = [];
  if (!r.any) return { out, err };
  for (const x of r.refusals) err.push(`mirrors: refused ${x.message}`);
  for (const w of r.waiting) {
    out.push(w.why === "unworn"
      ? `mirrors: ${w.petname ?? `h${w.handleIndex}`} stands unworn, and a face's own layer of a wiki lays at that face's wear: wear it (\`lares vault unlock --face ${w.handleIndex}\`) and lay again; its folders (${w.folders.join(", ")}) stay as they stand, and none of their files laid into another face's layer`
      : w.why === "unresolved"
      ? `mirrors: ${w.petname ?? `h${w.handleIndex}`} stands open, and its own layer lays at its own face's wear (this island opens no daemon layer of its own for it under another face): wear it (\`lares vault unlock --face ${w.handleIndex}\`) and lay again; its folders (${w.folders.join(", ")}) stay as they stand`
      : `mirrors: ${unlockItLine(w, "lay")}; its folders (${w.folders.join(", ")}) stay as they stand, and nothing of its memory laid into any layer`);
  }
  for (const w of r.benchWaiting) {
    out.push(w.why === "owner"
      ? `mirrors: the wiki ${w.slug} re-stands at its owner's wear: wear ${w.owner} (\`lares vault unlock --face N\`) and lay again; ${w.folder} stays as it stands, and nothing of it landed under this face`
      : `mirrors: the workbench of ${w.slug} lays once, at the wear of a face that holds a writer's seat there: this face holds none, so ${w.folder} stays as it stands and nothing of it landed in this face's layers; wear a seated writer and lay again`);
  }
  // A LANDING THAT MOVED NOTHING SAYS NOTHING: the line names grants that moved, grants that wait, and seats that changed.
  const benchMoved = (w: { readonly founded: boolean; readonly seated: number; readonly removed: number }): boolean => w.founded || w.seated > 0 || w.removed > 0;
  if (r.shares !== undefined && (r.shares.moved + r.shares.pending > 0 || r.shares.workbenches.some(benchMoved))) {
    const benches = r.shares.workbenches.filter(benchMoved);
    out.push(`  shares: landed ${r.shares.moved} grant(s)${r.shares.moved > 0 && r.shares.carried > 0 ? ` (${r.shares.carried} reach their grantee at that face's next wear)` : ""}${r.shares.pending > 0 ? `; ${r.shares.pending} wait for a shut face` : ""}${benches.length > 0 ? `; workbench seats: ${benches.map((w) => `${w.slug} (${w.members} member face(s)${w.founded ? ", founded now" : ""}${w.seated > 0 ? `, ${w.seated} seated now` : ""}${w.removed > 0 ? `, ${w.removed} unseated` : ""})`).join(", ")}` : ""}`);
  }
  for (const b of r.minted) out.push(`  ${r.applied ? "minted" : "would mint"} ${b} (this vessel held no such wiki)`);
  for (const t of r.layers) {
    out.push(`  ${t.mirror} -> ${t.toBag}: ${r.applied ? `landed ${t.landed}` : `would land ${t.planned}`}${t.kapae > 0 ? ` · kāpae ${t.kapae}` : ""} · stood off ${t.stoodOff.length} · refused ${t.refused.length}${t.skipped.length > 0 ? ` · skipped ${t.skipped.length}` : ""}`);
    for (const s of t.stoodOff) err.push(`    stands off: ${s}`);
    for (const s of t.refused) err.push(`    refused: ${s}`);
    for (const line of skipLines(t.skipped)) err.push(`    ${line}`);
  }
  if (r.kahua.preview.length > 0) {
    out.push(`  kahua: ${r.kahua.preview.length} item(s) the lay would lift, each under its face's grant:`);
    for (const p of r.kahua.preview) out.push(`    h${p.handleIndex}${p.petname ? ` ("${p.petname}")` : ""}  ${p.title}  sha256:${p.digest.slice(0, 16)}  ${p.state === "differs" ? "differs from the standing head" : "new"}${r.kahua.waiting.includes(p) ? "  (waits for its own face's wear)" : ""}`);
  }
  // AN ITEM OF AN OPEN, UNWORN FACE WAITS BY NAME: its canon and its hand open at its own wear, and the exit reads green.
  for (const handleIndex of [...new Set(r.kahua.waiting.map((p) => p.handleIndex))].sort((a, b) => a - b)) {
    const theirs = r.kahua.waiting.filter((p) => p.handleIndex === handleIndex);
    out.push(`  kahua: ${theirs[0]!.petname ?? `h${handleIndex}`} (h${handleIndex}) keeps ${theirs.length} item(s) at the shore, and each lifts at its own face's wear: wear it (\`lares vault unlock --face ${handleIndex}\`), lay, and lift with \`lares vessel lay --apply --lift-kahua ${theirs.length}\``);
  }
  for (const l of r.kahua.lifted) out.push(`  kahua: lifted ${l.title} under h${l.handleIndex} (${l.cid.slice(0, 16)})`);
  if (r.kahua.pending.length > 0) {
    const n = r.kahua.pending.length;
    out.push(`  kahua: ${n} item(s) stand pending; nothing lifts on --yes alone: lift with \`lares vessel lay --apply --lift-kahua ${n}\` or \`lares shore lift-kahua --count ${n}\``);
  }
  for (const s of r.kahua.refused) err.push(`    kahua refused: ${s}`);
  return { out, err };
}

/** Whether a result left anything standing a hand must answer. */
export function mirrorsLeftWork(r: MirrorSeedResult): boolean {
  return r.refusals.length > 0 || r.layers.some((t) => t.stoodOff.length + t.refused.length > 0) || r.kahua.refused.length > 0;
}

// ── the live doors ─────────────────────────────────────────────────────────────────────────────────────────────

/** The two ports a live lay reaches the vessel by: the vessel's DID and the INGEST submit. A test lends its own. */
export interface LayPorts {
  readonly did: () => Promise<string>;
  readonly submit: (o: SubmitIngestOpts) => Promise<SubmitResult>;
}
export const LIVE_LAY_PORTS: LayPorts = { did: vesselDid, submit: submitIngest };

/** The title a wave's file reads back under, or why it reads none (`@lararium/node` ingest-scan). */
export { siteWaveFile };

/**
 * Lay one folder through INGEST's three-way gate against the vessel's synced base (`@lararium/node` ingest-scan), over the
 * verb socket unless a caller lends its own ports.
 */
export function liveLay(wave: MirrorWave, apply: boolean, ports: LayPorts = LIVE_LAY_PORTS): Promise<MirrorLaid> {
  return layWave(wave, apply, ports);
}

export const LIVE_MIRROR_DOORS: MirrorDoors = {
  faces: LIVE_BUNDLE_DOORS.faces,
  tempConsented: LIVE_BUNDLE_DOORS.tempConsented,
  heldSlugs: LIVE_BUNDLE_DOORS.heldSlugs,
  mintBag: LIVE_BUNDLE_DOORS.mintBag,
  ...(LIVE_BUNDLE_DOORS.mintWiki ? { mintWiki: LIVE_BUNDLE_DOORS.mintWiki } : {}),
  kahuaLift: LIVE_BUNDLE_DOORS.kahuaLift,
  lay: liveLay,
  sourced: (slug) => { try { return canonIsDisk({ holding: slug, source: join(daemonBagsDir(), slug) }); } catch { return false; } },
  canonWikis: () => { try { return join(dirname(resolve(daemonBagsDir())), "wikis"); } catch { return null; } },
  benchSeat: async (slug) => {
    const out = summaryOutput(await runVerb("workbench-seat", { slug }, await vesselDid())) as { writeSlot?: unknown; bound?: unknown } | null;
    return { writeSlot: out?.writeSlot === "working" || out?.writeSlot === "personal" ? out.writeSlot : null, bound: out?.bound === true };
  },
  shareRows: () => { try { const text = LIVE_SHARE_DOORS.file.read(); return text === null ? [] : parseShareFile(text); } catch { return []; } },
  landShares: async () => landShares(LIVE_SHARE_DOORS, await LIVE_SHARE_DOORS.faces()),
};
