/**
 * `lares export <dest>` · `lares import <dest>` — the operator's AUTHORED memory carried across a re-founding.
 *
 * A re-founding clears `<root>/hearth` and mints new keys, so the daemon wiki's working layer and each face's kahua
 * stage come up empty under a new face relation F. This pair carries what the operator wrote across that line as
 * CONTENT, never as identity: no key, signature, CRDT history or AID travels, and the import writes NEW changes under
 * the new face's authority. The sensoriums (captured conversation memory, `<root>/sensoriums`) survive by where they
 * stand and never enter a bundle. Control records rest in the vessel control document and never travel in a bundle;
 * the daemon wiki travels through the face's root (`faces/<pet name>/`): its working (`wiki/`) and canon (`canon/`)
 * mirrors, and kahua through its `stage/`.
 *
 * EXPORT (a vessel that holds a disk store and wears its faces, standing):
 *   1. refuses a dest inside the house root or the workspace, or one that already stands (the config home takes one, and so
 *      does a bound workspace for the keep rite that names it, `../rite-keep.ts`);
 *   2. reads the census (`lares vessel census`): an unsettled carrier, a held save or an unanswered line refuses by name,
 *      unless `--accept-omissions` names the export partial, and then each lands in the manifest's omissions;
 *   3. maps each face root (`faces/<pet name>`) to the face whose pet name makes it; a face that holds memory and no
 *      pet-name, two that share one, or a root no face carries (without --accept-omissions), refuses;
 *   4. (ONE ROW SET FOR ONE DOCUMENT: a wiki's workbench travels once, from its one folder, a sourced wiki's beside its canon
 *      source included, with the vessel-private share rows that name its owner and its seats by pet-name in the sealed re-declare list;
 *      a face-private document, `personal` layers among them, travels for its one face.)
 *      copies face working and canon mirrors, granted draft recovery files, consented temp carriers, kahua stage carriers and the stage's standing heads; every
 *      other wiki's working, draft and consented temp files; house-minted bags (a user wiki's own canon among them); and
 *      lists the acquired library's collections by index digest (the originals survive in place and never travel);
 *   5. writes `manifest.json`, `re-declare.sealed` (the roster sealed to the keep pair's public half, `../keep-seat.ts`, asking for
 *      no credential; with every user wiki the catalog holds, by slug, so a wiki that holds no page still carries) and
 *      `keep-seat.json` (the pair: its public half and the slot tree its secret opens from under the human's routes), reads every
 *      byte back against the manifest, and only then moves
 *      the bundle into place.
 *
 * IMPORT (previews by default; `--apply` writes):
 *   1. verifies the whole bundle before touching anything (`verifyBundle`), and opens the keep seat it carries with the passphrase
 *      or paper sheet the human supplies, then the roster (a wrong route refuses by name, before anything moves); at the end of a
 *      whole apply, a house that rests no keep pair seats the bundle's, so its next keep seals to the same pair;
 *   2. replays the re-declare list as fresh acts (pet-name, Handle, seat and chair) where the vessel's face holds none;
 *   3. maps each bundle face's pet-name to the ONE face on this vessel that carries it, refusing by name where none or
 *      two do (never a silent merge into another face's memory);
 *   4. re-pours working rows into the new face's daemon wiki through the ingest gesture (unattended, so a diverged id
 *      stands off through the Confluence gate and never overwrites), raising each kāpae a shadow speaks;
 *   5. re-lifts each kahua head under the new face's grant, keyed by title + body digest (a title already holding that
 *      digest reads landed, a title holding a body the bundle never carried stands off);
 *   6. lands draft and temp files back in the face's root (`faces/<pet name>/recovery/<slug>`, `temp/<slug>`) where none
 *      stands (a different file there stands off); re-pours the daemon canon into `bags/daemon-<F>`, each house-minted bag into its bag and each other wiki's working rows into its working layer
 *      through the same gesture, minting first (CREATE) any slug this vessel does not hold, named in the preview; a wiki
 *      another face owns, or whose workbench another face's realm binds, mints nothing under a face that holds no writer's
 *      seat there (that face reads it only through what a share row grants).
 *   A WORKBENCH LANDS ONCE, where the daemon mount holds a writer's seat in it or stands the wiki first (its owner, where a share
 *   row names one); under any other face its rows wait by name. Each face's `personal` rows land at that face's own wear. The
 *   share rows the bundle carries write into `config/share.tid` where none stands for the slug, and the shares land again.
 *   A journal under `<root>/config/carry-journal/<bundle-id>.<faces>.ndjson` (the bundle and the target faces' relations) records
 *   each landed act: an interrupted import re-enters to the same end, a second import of the same bundle onto the same faces
 *   lands nothing, and the same bundle walked onto fresh faces after a re-founding imports afresh.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { wikiBagUri, wikiSlotUri, daemonFaceCanonBag, KAHUA_BAG, defaultChairLabel, declarePersonaHandle, renameOwnPersona, ownPersonaPetname, standForKahuSeat, carrierFormOf, parseShareFile, serializeShareFile, SHARE_CONFIG_FILE, type ShareEntry } from "@lararium/mesh";
import {
  larHouseRoot, larProjectionsHome, larConfigHome, mirrorDirFileToUri, projectedFileTitle, SyncedTree, TEMP_LAYER_DIR,
  KAPAE_EXT, readKapaeShadow, isPrivateProjectionSlug, loadLaresConfig, tempConsentedSlugs, daemonBagsDir, FACES_PROJECTION_DIR, FACE_PLANES, faceRoot, faceSegmentRefusal,
  listCollections, libraryCollectionDir, atomicWriteFileSync, parseTidCarrier, houseIgnored,
} from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { readCensus, censusLine, type CensusReading } from "./census.js";
import { scanFiles, candidatesOf, settleIngest, openSyncedTree, carriedBasesOf, type ScanRow } from "../ingest-core.js";
import { discoverHoldings, canonIsDisk } from "../holdings.js";
import { summaryOutput } from "../verb-result.js";
import { vesselDid, larBagsDir } from "../env.js";
import { runVerb } from "../verb-call.js";
import { newChangeId, newRequestId, taskContentId } from "@lararium/mesh";
import { storeVerb, storeFailure } from "../store-door.js";
import { readPersonaRoots, sealedPetnameStore, sealedDeclarationStore } from "../sealed-records.js";
import { writeFaceLabels, readFaceBases, labelFaceAtNaming, faceRelationOnStage } from "../face-labels.js";
import { makeFleetPetnameStore, makeFleetDeclarationStore } from "../daemon-persona-store.js";
import {
  BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, KEEP_SEAT_FILE, KAHUA_HEADS_FILE, bundleIdOf, sha256Hex, zeroCounts, verifyBundle, openBundle, rosterView, readBundleSeat, BundleVerifyRefused,
  type BundleDiskManifest, type BundleFaceKey, type BundleFile, type BundleKahuaHead, type BundleManifest, type BundleOmission, type BundleRedeclare,
  type BundleRedeclareFace, type BundleRow, type BundleShareEntry, type VerifiedBundle,
} from "../bundle-manifest.js";
import { LIVE_SHARE_DOORS, landShares, shareSetArgs } from "../share-doors.js";
import { KeepSeatRefused, adoptKeepSeat, bundleSeatText, keepSeatForCut, liveKeepRoute, openKeepSeat, sealRosterForCut } from "../keep-seat.js";
import type { Credential } from "@lararium/mesh";

/** A keep seat refusal, as the bundle verbs name it. */
async function seatAct<T>(act: () => Promise<T>): Promise<T> {
  try { return await act(); } catch (e) { if (e instanceof KeepSeatRefused) throw new BundleRefused(e.code, e.detail); throw e; }
}

/** One document a keep left to another holder (`BundleManifest.elsewhere`). */
type BundleElsewhere = NonNullable<BundleManifest["elsewhere"]>[number];


/** One face this vessel wears, as the doors read it. */
export interface BundleVesselFace {
  readonly handleIndex: number;
  readonly petname: string | null;
  /** The face relation F its private folders carry, read off its verified log; null where the log pins none. */
  readonly relation: string | null;
  readonly handle: string | null;
  readonly seat: boolean;
  readonly chair: string | null;
  /** The stage's standing heads, or null where the stage would not read (`kahuaRefusal` says why). */
  readonly kahua: readonly BundleKahuaHead[] | null;
  readonly kahuaRefusal?: string;
  /** The store door's name for that refusal (`storeFailure`): `vessel-locked`, `daemon-unreachable`, … */
  readonly kahuaRefusalCode?: string;
  /**
   * Whether this face stands as the composition's daemon mount (lit and proved): the daemon's working layer holds the mount's
   * document alone. Absent where the door answered no such reading (a direct holder).
   */
  readonly mounted?: boolean;
}

/**
 * THE WORN FACE: the one face whose private mirrors lay through the ordinary wave (the daemon's working layer holds its document);
 * every other OPEN face lays through a wave that names it (the lit set), and a shut face waits until it opens (`lares vault unlock
 * --face N`). No face's private memory ever lands in another face. Where the vessel named which face it wears, that face (or none);
 * where no door answered the reading (a direct holder), the one face carrying a relation, else none.
 */
export function mountFaceOf(faces: readonly BundleVesselFace[]): BundleVesselFace | null {
  const mounted = faces.filter((f) => f.mounted === true && f.relation !== null);
  if (mounted.length === 1) return mounted[0]!;
  if (faces.some((f) => f.mounted !== undefined)) return null;
  const related = faces.filter((f) => f.relation !== null);
  return related.length === 1 ? related[0]! : null;
}

/**
 * The island's answers that name an EXPECTED WAIT for a face-named wave: it resolves no document of the face's own
 * (`face-unresolved`), or the face's own layer rests sealed under its own key and no peer opens it (`document-unavailable`).
 * Either way the face's memory lays at its own wear, and the wave landed nothing anywhere.
 */
export const FACE_LAYER_WAITS = /\bface-unresolved\b|\bdocument-unavailable\b/;

/**
 * A WHOLE-WAVE REFUSAL, FOLDED INTO ROWS: where INGEST refuses a wave whole (the island answers one error for the act), each
 * candidate and each kapae shadow it carried reads refused under that one answer. The lay's lay door and the import's ingest
 * door both fold through here, so a wave the island refuses whole reads alike at both: a face-named wave refused with a
 * `FACE_LAYER_WAITS` answer waits by name, and any other refusal stands named row by row, never a bare throw.
 */
export function foldWaveRefusal(why: string, candidates: ReadonlyArray<{ readonly uri: string }>, kapae: readonly string[]): {
  readonly refused: Array<{ uri: string; why: string }>; readonly kapaeRefused: Array<{ uri: string; why: string }>;
} {
  return { refused: candidates.map((c) => ({ uri: c.uri, why })), kapaeRefused: kapae.map((t) => ({ uri: t, why })) };
}

/** The words a SHUT face reads: unlock it, then lay (or import) again. A named expected state, never a stand-off, and it
 *  never blocks the faces that stand open (THE LIT SET: one lay lays every open face, each in its own layer). */
export function unlockItLine(face: { readonly handleIndex: number; readonly petname: string | null }, verb: "lay" | "import"): string {
  return `${face.petname ?? `h${face.handleIndex}`} stays shut: \`lares vault unlock --face ${face.handleIndex}\`, then ${verb} again`;
}

/**
 * THE NAME A CARRIED FILE TRAVELS UNDER: the `lar:` address its mirror path sites (`mirrorDirFileToUri`), else, for a FOREIGN
 * title (one that owns no uri-path, which the projector sites at TiddlyWiki's flattened default: `plain note.tid`), the title
 * its own native form states (`projectedFileTitle`: a `.tid` field block, a `.json` record, a content file's `.meta`). A
 * self-title inside the `lar:` family never stands in for a siting that derives none, so a misplaced carrier stays skipped by
 * name and never re-addresses itself; a kāpae shadow and a `.meta` sidecar name no record of their own.
 */
export function carriedFileTitle(mirrorDir: string, file: string): string | null {
  const uri = mirrorDirFileToUri(mirrorDir, file);
  if (uri !== null) return uri;
  const ext = extname(file);
  if (ext === "" || ext === ".meta" || ext === KAPAE_EXT) return null;
  const title = projectedFileTitle(file, ext, existsSync(`${file}.meta`));
  return typeof title === "string" && title !== "" && !title.startsWith("lar:") ? title : null;
}

/** A view-state carrier of a `personal` layer (a `$:/` title: the story list, a fold state): it never travels. */
const isViewState = (rel: string): boolean => (rel.split("/").pop() ?? "").startsWith("$__");

/** What one ingest wave settled, as the export and import read it. */
export interface BundleIngestAnswer {
  readonly landed: readonly string[];
  readonly conflicts: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly refused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly unanswered: readonly string[];
  readonly kapaeRaised: readonly string[];
  readonly kapaeRefused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
}

/** The doors the two verbs reach a vessel through, injectable so a test drives them with no vessel standing. */
export interface BundleDoors {
  readonly census: () => Promise<CensusReading>;
  readonly faces: () => Promise<BundleVesselFace[]>;
  readonly tempConsented: () => readonly string[];
  readonly rename: (handleIndex: number, petname: string) => Promise<void>;
  readonly declareHandle: (handleIndex: number, handle: string) => Promise<void>;
  readonly standSeat: (handleIndex: number, chair: string | null) => Promise<void>;
  /** `face`: THE FACE-NAMED WAVE, the open face (not the mount) whose own layer takes it; the island lands it only where that
   *  face owns the document (`face-unresolved`, `ingest-face-foreign` otherwise), never on the daemon mount. */
  readonly ingest: (wave: { readonly source: string; readonly toBag: string; readonly candidates: readonly ScanRow[]; readonly kapae: readonly string[]; readonly inWiki?: boolean; readonly wiki?: string; readonly face?: number }) => Promise<BundleIngestAnswer>;
  /** The wiki slugs this vessel's catalog registers. */
  readonly heldSlugs: () => Promise<ReadonlySet<string>>;
  /** The USER wikis this vessel's catalog registers (`list-wikis`, kind `user`), by slug: each carries, a wiki with no page among them. Absent: none travels. */
  readonly userWikis?: () => Promise<readonly string[]>;
  /** Mint a bag through the existing CREATE road. It stands the bag alone: no recipe row, so no wiki answers to the slug. */
  readonly mintBag: (bagUri: string) => Promise<void>;
  /** Mint a WIKI through the wiki door (`init-wiki`: its canon, its draft and its recipe row), idempotent. Absent: `mintBag`. */
  readonly mintWiki?: (slug: string) => Promise<void>;
  /**
   * The disk-sourced holdings whose canon this vessel never laid (no synced base stands for any carrier of the bag).
   * An import lands its rows over laid canon alone, so it refuses while one stands unlaid. Absent: no guard.
   */
  readonly unseeded?: () => readonly string[];
  /**
   * The override base (`meta.overrideBase`) each working copy of one layer names, by title: the export carries them
   * beside the files, since a base never projects. Absent: rows carry none.
   */
  readonly overrideBases?: (workingBag: string) => Promise<Readonly<Record<string, string>>>;
  /** The `wikis` dir beside the canon source, where a sourced wiki's one workbench folder rests; null: none stands. */
  readonly canonWikis?: () => string | null;
  /**
   * The wikis this vessel holds that stand COLD (no island mounts them now). A put a face made into a cold wiki rests in its
   * layer and projects nowhere until that face wakes the wiki, so the export names each cold wiki. Absent: none reads.
   */
  readonly coldWikis?: () => Promise<readonly string[]>;
  /** Whether a slug's canon stands under the canon source. Absent: none does. */
  readonly sourced?: (slug: string) => boolean;
  /** The daemon mount's seat on a wiki's workbench (`workbench-seat`). Absent (a rig with no roster): the daemon mount writes every workbench. */
  readonly benchSeat?: (slug: string) => Promise<{ readonly writeSlot: "working" | "personal" | null; readonly bound: boolean }>;
  /** The vessel-private share rows (`config/share.tid`), read and written whole. Absent: no rows travel and none land. */
  readonly shareRows?: { read(): readonly ShareEntry[]; write(rows: readonly ShareEntry[]): void };
  /** The route a restore opens the bundle's keep seat with (a passphrase, a paper sheet). Absent: the terminal asks
   *  (`liveKeepRoute`), and a root a harness staged with no terminal offers the published test route. */
  readonly keepRoute?: () => Promise<readonly Credential[]>;
  /**
   * Write one share row into the standing vessel's control document (`share-set`), its owner by pet-name beside it. The vessel
   * reconciles `config/share.tid` only at its boot and the landing (`share-apply`) reads the control document, so a row written
   * to the file alone owes no grant until the next boot, when the owner's half may stand shut. Absent: the file alone.
   */
  readonly shareSet?: (row: ShareEntry) => Promise<void>;
  /** Land the shares again (`share-apply`); null where no vessel answers. */
  readonly landShares?: () => Promise<Record<string, unknown> | null>;
  readonly kahuaLift: (handleIndex: number, lift: { readonly title: string; readonly text: string; readonly fields: Readonly<Record<string, string>>; readonly taint: readonly string[]; readonly sources: BundleKahuaHead["sources"]; readonly parent: string | null }) => Promise<{ readonly cid: string }>;
}

// ── the live doors ─────────────────────────────────────────────────────────────────────────────────────────────

function fleetStores() {
  return { petnames: makeFleetPetnameStore(sealedPetnameStore()), declarations: makeFleetDeclarationStore(sealedDeclarationStore()) };
}

async function liveFaces(): Promise<BundleVesselFace[]> {
  const { petnames, declarations } = fleetStores();
  const out: BundleVesselFace[] = [];
  for (const { handleIndex } of (await readPersonaRoots()).roots) {
    const declaration = await declarations.get(handleIndex);
    let kahua: BundleKahuaHead[] | null = null, relation: string | null = null, kahuaRefusal: string | undefined, kahuaRefusalCode: string | undefined, mounted: boolean | undefined;
    try {
      const { output } = await storeVerb("kahua-read", { face: handleIndex, action: "list" });
      relation = typeof output["relation"] === "string" ? output["relation"] : null;
      if (typeof output["mounted"] === "boolean") mounted = output["mounted"];
      const items = Array.isArray(output["items"]) ? (output["items"] as Array<{ heads?: unknown }>) : [];
      kahua = items.flatMap((item) => (Array.isArray(item.heads) ? item.heads as BundleKahuaHead[] : []))
        .map((h) => ({ title: h.title, cid: h.cid, text: h.text, fields: { ...h.fields }, taint: [...h.taint], sources: h.sources.map((s) => ({ title: s.title, revision: s.revision })) }));
    } catch (e) { kahuaRefusal = e instanceof Error ? e.message : String(e); kahuaRefusalCode = storeFailure(e).code; }
    out.push({
      handleIndex, petname: (await petnames.get(handleIndex)) ?? null, relation,
      handle: declaration?.handle ?? null, seat: declaration?.seat === true,
      chair: declaration?.seat === true ? declaration.chair?.trim() || defaultChairLabel(handleIndex) : null,
      kahua, ...(kahuaRefusal !== undefined ? { kahuaRefusal } : {}), ...(kahuaRefusalCode !== undefined ? { kahuaRefusalCode } : {}),
      ...(mounted !== undefined ? { mounted } : {}),
    });
  }
  // THE FACE LABELS: each named face's relation and pet-name rest in plaintext outside the hearth, so a lay after a
  // re-founding keeps each copy's fork base from disk alone (`face-labels.ts`).
  writeFaceLabels(out);
  return out;
}

export const LIVE_BUNDLE_DOORS: BundleDoors = {
  census: () => readCensus(),
  faces: liveFaces,
  tempConsented: () => tempConsentedSlugs(loadLaresConfig()),
  rename: async (i, petname) => {
    const formerPetname = await ownPersonaPetname(fleetStores().petnames, i).catch(() => undefined) ?? null;
    await renameOwnPersona(fleetStores().petnames, i, petname);
    // A carried rename names the face too: its label follows the pet-name it now wears.
    await labelFaceAtNaming({ handleIndex: i, petname, formerPetname }, faceRelationOnStage);
  },
  declareHandle: async (i, handle) => declarePersonaHandle(fleetStores().declarations, i, handle),
  standSeat: async (i, chair) => standForKahuSeat(fleetStores().declarations, i, true, chair ?? undefined),
  ingest: async (wave) => {
    // A tree held in memory: the gesture pins no base at a bundle path, and the projector pins its own where it writes.
    const settled = await settleIngest({ source: wave.source, toBag: wave.toBag, candidates: wave.candidates, did: await vesselDid(), unattended: true,
      ...(wave.inWiki === true ? { inWiki: true } : {}), ...(wave.wiki !== undefined ? { wiki: wave.wiki } : {}),
      ...(wave.kapae.length > 0 ? { kapae: wave.kapae } : {}), ...(wave.face !== undefined ? { face: wave.face } : {}) }, new SyncedTree(null));
    if (settled.first.status === "error") {
      return { landed: [], unanswered: [], conflicts: [], kapaeRaised: [], ...foldWaveRefusal(settled.first.errorMessage ?? "INGEST refused", wave.candidates, wave.kapae) };
    }
    const kapae = (summaryOutput(settled.first) as { kapae?: { raised?: unknown; standing?: unknown; refused?: unknown } } | null)?.kapae;
    const list = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);
    return {
      landed: [...settled.landed], unanswered: [...settled.unanswered],
      conflicts: settled.conflicts.map((c) => ({ uri: c.uri, why: c.why })), refused: settled.refused.map((c) => ({ uri: c.uri, why: c.why })),
      kapaeRaised: [...list(kapae?.raised), ...list(kapae?.standing)],
      kapaeRefused: (Array.isArray(kapae?.refused) ? kapae.refused as Array<Record<string, unknown>> : []).map((r) => ({ uri: String(r["uri"]), why: String(r["code"]) })),
    };
  },
  heldSlugs: async () => {
    const r = await runVerb("list-wikis", {}, await vesselDid());
    if (r.status === "error") throw new Error(r.errorMessage ?? "list-wikis refused");
    const wikis = (summaryOutput(r) as { wikis?: Array<{ slug?: unknown }> } | null)?.wikis ?? [];
    return new Set(wikis.map((w) => String(w.slug)));
  },
  userWikis: async () => {
    const r = await runVerb("list-wikis", {}, await vesselDid());
    if (r.status === "error") throw new Error(r.errorMessage ?? "list-wikis refused");
    const wikis = (summaryOutput(r) as { wikis?: Array<{ slug?: unknown; kind?: unknown }> } | null)?.wikis ?? [];
    return wikis.filter((w) => w.kind === "user").map((w) => String(w.slug)).sort();
  },
  mintBag: async (bagUri) => {
    // The CREATE road `lares act CREATE --bag` walks (`act.ts`): the catalog plane, a fresh change nonce in the effect key.
    const actionArgs = { bag: bagUri, plane: "catalog" };
    const effectKey = await taskContentId({ subject: bagUri, command: "CREATE", args: actionArgs, nonce: newChangeId() });
    const r = await runVerb("CREATE", actionArgs, await vesselDid(), { requestId: newRequestId(), effectKey });
    if (r.status === "error") throw new Error(r.errorMessage ?? `CREATE ${bagUri} refused`);
  },
  mintWiki: async (slug) => {
    const r = await runVerb("init-wiki", { slug }, await vesselDid());
    if (r.status === "error") throw new Error(r.errorMessage ?? `init-wiki ${slug} refused`);
  },
  unseeded: () => {
    const tree = openSyncedTree();
    const seededBags = new Set(tree.rows().map((r) => r.bagId));
    return discoverHoldings(larBagsDir()).filter((h) => { try { return canonIsDisk(h); } catch { return false; } })
      .filter((h) => !seededBags.has(h.toBag)).map((h) => h.holding);
  },
  canonWikis: () => { try { return join(dirname(resolve(daemonBagsDir())), "wikis"); } catch { return null; } },
  // The wikis the catalog names (`list-wikis`) that no island runs now (`wiki-active`): the daemon wiki always stands.
  coldWikis: async () => {
    const did = await vesselDid();
    const listed = await runVerb("list-wikis", {}, did);
    const active = await runVerb("wiki-active", {}, did);
    if (listed.status === "error" || active.status === "error") return [];
    const wikis = ((summaryOutput(listed) as { wikis?: Array<{ slug?: unknown }> } | null)?.wikis ?? []).map((w) => String(w.slug));
    const live = new Set(((summaryOutput(active) as { active?: unknown } | null)?.active as unknown[] | undefined ?? []).map(String));
    return wikis.filter((slug) => slug !== "daemon" && !live.has(slug)).sort();
  },
  sourced: (slug) => { try { return canonIsDisk({ holding: slug, source: join(daemonBagsDir(), slug) }); } catch { return false; } },
  benchSeat: async (slug) => {
    const out = summaryOutput(await runVerb("workbench-seat", { slug }, await vesselDid())) as { writeSlot?: unknown; bound?: unknown } | null;
    return { writeSlot: out?.writeSlot === "working" || out?.writeSlot === "personal" ? out.writeSlot : null, bound: out?.bound === true };
  },
  shareRows: {
    read: () => { try { const text = LIVE_SHARE_DOORS.file.read(); return text === null ? [] : parseShareFile(text); } catch { return []; } },
    write: (rows) => LIVE_SHARE_DOORS.file.write(serializeShareFile(rows)),
  },
  landShares: async () => landShares(LIVE_SHARE_DOORS, await LIVE_SHARE_DOORS.faces()),
  shareSet: async (row) => { await LIVE_SHARE_DOORS.verb("share-set", shareSetArgs(row)); },
  overrideBases: async (workingBag) => {
    const out: Record<string, string> = {};
    let after: string | null = null;
    for (;;) {
      const r = await runVerb("override-bases", { bag: workingBag, ...(after !== null ? { after } : {}) }, await vesselDid());
      if (r.status === "error") throw new Error(r.errorMessage ?? "override-bases refused");
      const page = (summaryOutput(r) ?? {}) as { bases?: Array<{ title?: unknown; base?: unknown }>; next?: unknown };
      for (const b of page.bases ?? []) if (typeof b.title === "string" && typeof b.base === "string") out[b.title] = b.base;
      if (typeof page.next !== "string" || page.next === after) return out;
      after = page.next;
    }
  },
  // A RE-LIFT STAGES FIRST: the head lands in the new face's local canon (bags/daemon-<F>, unsigned), and the lift names
  // that staged row by its digest, as every lift does; the person's eyes rode the preview and its typed count upstream.
  kahuaLift: async (face, lift) => {
    const staged = (await storeVerb("kahua-stage", { face, title: lift.title, text: lift.text, fields: lift.fields })).output;
    if (typeof staged["digest"] !== "string") throw new Error(`kahua-stage answered no digest for ${lift.title}`);
    const { output } = await storeVerb("kahua-lift", { face, title: lift.title, digest: staged["digest"], taint: lift.taint, sources: lift.sources, parent: lift.parent });
    if (typeof output["cid"] !== "string") throw new Error(`kahua-lift answered no cid for ${lift.title}`);
    return { cid: output["cid"] };
  },
};

// ── shared ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A refusal the verbs raise by name; the message carries the cure. */
export class BundleRefused extends Error {
  override readonly name = "BundleRefused";
  constructor(readonly code: string, message: string) { super(`${code}: ${message}`); }
}

/** A path as the filesystem resolves it: the nearest standing ancestor's real path, with the rest appended, so a link
 *  that leads into the house reads as inside it. */
function realish(path: string): string {
  let head = resolve(path);
  const tail: string[] = [];
  for (;;) {
    try { return join(realpathSync(head), ...tail.reverse()); } catch { /* not standing yet */ }
    const parent = dirname(head);
    if (parent === head) return resolve(path);
    tail.push(basename(head));
    head = parent;
  }
}
const inside = (base: string, path: string): boolean => {
  const b = realish(base), p = realish(path);
  return p === b || p.startsWith(b + sep);
};

/**
 * Every plain file under `dir` (posix rel paths, sorted), each link or special file named apart; an absent dir reads empty. A
 * `.git` a mirror holds (a repo someone made there) stays out whole, named apart: the house never held a byte of it, and its
 * commits carry authorship.
 */
function plainFiles(dir: string): { files: string[]; odd: string[]; repos: string[] } {
  const files: string[] = [], odd: string[] = [], repos: string[] = [];
  const visit = (abs: string, rel: string): void => {
    let names: string[];
    try { names = readdirSync(abs).sort(); } catch { return; }
    for (const name of names) {
      const a = join(abs, name), r = rel === "" ? name : `${rel}/${name}`;
      if (name === ".git") { repos.push(r); continue; }
      const st = lstatSync(a);
      if (st.isDirectory()) visit(a, r);
      else if (st.isFile()) files.push(r);
      else odd.push(r);
    }
  };
  visit(dir, "");
  return { files, odd, repos };
}

const isStray = (rel: string): boolean => rel.includes(".lar-tmp-");

// ── export ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** What an export wrote. */
export interface HouseExportResult { readonly dest: string; readonly manifest: BundleManifest }

/**
 * Write a bundle at `dest`. Throws {@link BundleRefused} naming what stays unsettled, unclaimed or unkeyed; with
 * `acceptOmissions` an unsettled census and an unclaimed folder land in the manifest's omissions instead.
 */
export async function houseExport(dest: string, opts: { readonly acceptOmissions: boolean; readonly doors: BundleDoors;
  /** A BOUND WORKSPACE the calling act names (the keep rite, which spends a lei for it): a dest inside this one directory rests
   *  there though it stands under the house root. A bare export names none, so a workspace takes no bundle without that act. */
  readonly workspace?: string;
  /** The cold wikis the keep rite held before this cut (`../rite-keep.ts`, the wake): each projected its pages first, so the
   *  cut names none of them cold. A bare export names none. */
  readonly woken?: readonly string[];
  /** THE KEEP CUTS HOUSE-ONLY CONTENT (the keep rite alone): a workbench whose mirror rests inside the checkout, which git holds,
   *  stays out of the files and lands under the manifest's `elsewhere`. A bare export carries every workbench, as before. */
  readonly houseOnly?: boolean }): Promise<HouseExportResult> {
  const { doors, acceptOmissions } = opts;
  const target = resolve(dest);
  const house = larHouseRoot();
  // THE CONFIG HOME TAKES A BUNDLE: a reset clears the hearth alone and keeps config, and the container binds config to the host
  // (`/lar/config` ← `$LARES_HOUSE/config`), so a bundle exported through the shim rests where the host reads it and the
  // re-founding never reaches (the vault backup's own precedent). Every other house class refuses.
  if (inside(house, target) && !inside(larConfigHome(), target) && !(opts.workspace !== undefined && inside(opts.workspace, target))) throw new BundleRefused("carry-dest-inside-house", `${target} stands inside the house root ${resolve(house)}; a bundle carries memory across a re-founding, so it rests outside the house, or under its config home ${resolve(larConfigHome())}, which a reset keeps`);
  if (inside(repoRoot, target)) throw new BundleRefused("carry-dest-inside-workspace", `${target} stands inside the workspace ${repoRoot}; a bundle holds private memory and never rests in a tracked tree`);
  if (existsSync(target)) throw new BundleRefused("carry-dest-stands", `${target} already stands; name a fresh path, and the export never writes over one`);
  const omissions: BundleOmission[] = [];

  // A SETTLED PROJECTION FIRST: what the census names would leave out of the copy.
  const census = await doors.census();
  if (!census.clean) {
    const lines = [...census.items.map(censusLine), ...census.unanswered.map((u) => `unanswered  ${u.part}: ${u.why}`)];
    if (!acceptOmissions) throw new BundleRefused("carry-unsettled", `the census names ${lines.length} item(s) the projection has not settled, so a copy now would leave them out:\n  ${lines.join("\n  ")}\nsettle them (unlock the vault, let the projector drain) and export again, or pass --accept-omissions for an explicitly partial bundle`);
    const held = census.items.filter((i) => i.kind === "held-save").map(censusLine);
    const carriers = census.items.filter((i) => i.kind === "carrier").map(censusLine);
    if (held.length > 0) omissions.push({ kind: "held-saves", detail: "saves the sealed rest holds in memory, never on disk", items: held, count: held.length });
    if (carriers.length > 0) omissions.push({ kind: "unsettled-carriers", detail: "carriers the disk projector had not settled", items: carriers, count: carriers.length });
    if (census.unanswered.length > 0) omissions.push({ kind: "census-unanswered", detail: "census lines that could not answer", items: census.unanswered.map((u) => `${u.part}: ${u.why}`) });
  }

  const faces = await doors.faces();
  const projections = larProjectionsHome();
  const wikisDir = join(projections, "wikis"), bagsDir = join(projections, "bags"), facesDir = join(projections, FACES_PROJECTION_DIR);
  const folders = (dir: string): string[] => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch { return []; } };
  /** The face whose pet name makes a face root's folder (`faces/<pet name>`), or null where none does. */
  const faceOfRoot = (seg: string): BundleVesselFace | null => faces.find((f) => f.petname !== null && f.relation !== null && f.petname.normalize("NFC") === seg.normalize("NFC")) ?? null;
  // A FACE ROOT NO FACE THIS VESSEL WEARS CLAIMS: a face whose key stands shut, or a face whose pet name no standing face carries. The
  // refusal names each root and the step that clears it.
  const unclaimedFolders: string[] = folders(facesDir).filter((seg) => faceOfRoot(seg) === null).map((seg) => join(facesDir, seg));
  const unclaimed = unclaimedFolders.length;
  if (unclaimed > 0) {
    if (!acceptOmissions) throw new BundleRefused("carry-unclaimed-face-folder", `${unclaimed} face root(s) belong to no face this vessel wears:\n  ${unclaimedFolders.join("\n  ")}\n`
      + `each holds a face's private memory in cleartext: a face whose key stands shut (unlock every face and export again), or a face whose pet name no standing face carries (found it again under that pet name, or rename the face that should hold it). `
      + `For a face you mean to burn, move its root out of the house root (\`mv <folder> <a place outside ${resolve(house)}>\`) and export again; `
      + `or export with --accept-omissions to leave them where they stand, out of the bundle`);
    // A face root's folder spells its pet name, and the manifest rides in clear beside the sealed roster: the omission counts the
    // roots and names none (the refusal above names each, on this house's own terminal).
    omissions.push({ kind: "unclaimed-face-folders", detail: "face roots no face this vessel wears claims; they stay under the projections root", count: unclaimed });
  }

  // THE FACES KEY BY PET-NAME. A face that carries memory needs one, and no two may share it.
  const carries = (f: BundleVesselFace): boolean => f.relation !== null && ((f.petname !== null && faceSegmentRefusal(f.petname) === null && existsSync(faceRoot(projections, f.petname))) || (f.kahua?.length ?? 0) > 0);
  for (const f of faces) {
    if (carries(f) && (f.petname === null || f.petname.trim() === "")) throw new BundleRefused("carry-face-unnamed", `the face at h${f.handleIndex} carries memory and no pet-name, and a bundle keys each face by its pet-name: name it (\`lares persona new ${f.handleIndex} --name '<label>'\`) and export again`);
    if (f.kahuaRefusal !== undefined && f.relation === null && !acceptOmissions) throw new BundleRefused("carry-face-unread", `the face at h${f.handleIndex} would not read its stage or relation (${f.kahuaRefusal}); unlock it, or export with --accept-omissions to leave its memory behind`);
    if (f.kahuaRefusal !== undefined) omissions.push({ kind: "face-unread", detail: `the face at h${f.handleIndex} would not read its stage: ${f.kahuaRefusal}` });
  }
  const named = faces.filter((f) => f.petname !== null && f.petname.trim() !== "").sort((a, b) => a.handleIndex - b.handleIndex);
  const seenNames = new Map<string, number>();
  for (const f of named) {
    const prior = seenNames.get(f.petname!);
    if (prior !== undefined) throw new BundleRefused("carry-face-duplicate-petname", `the faces at h${prior} and h${f.handleIndex} both carry the pet-name "${f.petname}", and a bundle keys each face by its pet-name alone: rename one and export again`);
    seenNames.set(f.petname!, f.handleIndex);
    // A pet name that makes no face folder (or meets another face's without case) holds no root to carry: name the cure.
    const refused = carries(f) ? faceSegmentRefusal(f.petname, named.filter((o) => o !== f).map((o) => o.petname!)) : null;
    if (refused !== null) throw new BundleRefused("carry-face-segment", `the face at h${f.handleIndex} ("${f.petname}"): ${refused.code}: ${refused.why}`);
  }
  // THE BUNDLE NAMES EACH FACE BY ITS PATH KEY ALONE: the pet-names ride the sealed re-declare list.
  const bundleFaces: BundleFaceKey[] = named.map((_f, i) => ({ key: `f${i}` }));
  const keyOf = new Map(named.map((f, i) => [f.handleIndex, `f${i}`] as const));

  // THE OVERRIDE BASES: a base rides the record's meta envelope and never projects, so the export reads it by title and
  // carries it on the working row. Each face's daemon working rows read that FACE's bases sidecar (the vessel keeps it off the
  // working slots the owner table files under the face's group), never the face the daemon wears now; another wiki's working
  // rows read the daemon's override-bases read.
  const basesOf = new Map<string, Readonly<Record<string, string>>>();
  const baseFor = async (workingBag: string): Promise<Readonly<Record<string, string>>> => {
    if (!doors.overrideBases) return {};
    const held = basesOf.get(workingBag);
    if (held) return held;
    let read: Readonly<Record<string, string>> = {};
    try { read = await doors.overrideBases(workingBag); }
    catch (e) { omissions.push({ kind: "override-bases-unread", detail: `the daemon's override-bases read did not answer for ${workingBag} (${e instanceof Error ? e.message : String(e)}): the daemon may not reach that layer. Its working rows travel WITHOUT their override bases, and each copy forks a fresh base off the canon standing where it lands, so canon's fresher-than-the-copy warning may stay silent for them after the import` }); }
    basesOf.set(workingBag, read);
    return read;
  };
  // A CARRIER'S FAMILY TRAVELS WHOLE: each fragment record of a working copy forked its own base, so the row carries the
  // root's and every fragment's (`carriedBasesOf`), and canon that moves a fragment under a still root still reads fresher.
  const withBase = (row: Omit<BundleRow, "sha256" | "path">, bases: Readonly<Record<string, string>>): Omit<BundleRow, "sha256" | "path"> =>
    row.title !== null ? { ...row, ...carriedBasesOf(row.title, bases) } : row;

  // THE COPY PLAN: source abs path -> bundle rel path, with the row each file makes.
  const plan: Array<{ from: string; to: string; row: Omit<BundleRow, "sha256" | "path"> | null }> = [];
  const tempBytes: Record<string, number> = {};
  const consented = new Set(doors.tempConsented());
  let strays = 0, odd = 0;
  const repos: string[] = [];
  const addTree = (srcDir: string, toDir: string, rowOf: (rel: string, abs: string) => Omit<BundleRow, "sha256" | "path"> | null, skipTop: readonly string[] = []): void => {
    const listed = plainFiles(srcDir);
    odd += listed.odd.length;
    repos.push(...listed.repos.map((r) => `${toDir}/${r}`));
    for (const rel of listed.files) {
      if (skipTop.includes(rel.split("/")[0]!)) continue;
      if (houseIgnored(rel) !== null) continue;          // HOUSE_IGNORED: a workspace's `.git`, the shore's renders, orphan folders, atomic temps
      if (isStray(rel)) { strays++; continue; }
      const abs = join(srcDir, ...rel.split("/"));
      plan.push({ from: abs, to: `${toDir}/${rel}`, row: rowOf(rel, abs) });
    }
  };
  // EACH FACE ROOT (`faces/<pet name>/`), for its one face: the daemon working layer, its canon, its stage, its margins, and the
  // drafts and consented temp its hand left in each wiki. A view-state carrier of a margin (a `$:/` title: the story list, a fold
  // state) stays behind: the face that lands the bundle keeps its own.
  for (const f of named) {
    if (f.relation === null || faceSegmentRefusal(f.petname) !== null) continue;
    const root = faceRoot(projections, f.petname!);
    if (!existsSync(root)) continue;
    const fk = keyOf.get(f.handleIndex)!;
    const faceBases = readFaceBases(f.relation, projections);
    const wiki = join(root, FACE_PLANES.wiki);
    addTree(wiki, `faces/${fk}/working`, (rel, abs) => {
      if (rel.endsWith(KAPAE_EXT)) {
        const read = readKapaeShadow(readFileSync(abs, "utf8"));
        return { face: fk, bag: wikiSlotUri("daemon", "working"), layer: "kapae", title: "title" in read ? read.title : null, rowKey: null };
      }
      return withBase({ face: fk, bag: wikiSlotUri("daemon", "working"), layer: "working", title: carriedFileTitle(root, abs), rowKey: null }, faceBases);
    }, [TEMP_LAYER_DIR]);
    if (consented.has("daemon")) {
      addTree(join(wiki, TEMP_LAYER_DIR), `faces/${fk}/temp/daemon`, (_rel, abs) => {
        const bag = wikiSlotUri("daemon", "temp");
        tempBytes[bag] = (tempBytes[bag] ?? 0) + lstatSync(abs).size;
        return { face: fk, bag, layer: "temp", title: null, rowKey: null };
      });
    } else if (existsSync(join(wiki, TEMP_LAYER_DIR))) omissions.push({ kind: "temp-unconsented", detail: `the daemon wiki's temp folder stands with no consent row (projection.temp.daemon); it stays behind` });
    addTree(join(root, FACE_PLANES.canon), `faces/${fk}/canon`, (_rel, abs) => ({ face: fk, bag: daemonFaceCanonBag(f.relation!), layer: "daemon-canon", title: carriedFileTitle(root, abs), rowKey: null }));
    addTree(join(root, FACE_PLANES.stage), `faces/${fk}/kahua`, () => ({ face: fk, bag: KAHUA_BAG, layer: "kahua-carrier", title: null, rowKey: null }));
    const margins = join(root, FACE_PLANES.margins);
    for (const slug of folders(margins)) {
      const listed = plainFiles(join(margins, slug));
      odd += listed.odd.length;
      repos.push(...listed.repos.map((r) => `faces/${fk}/personal/${slug}/${r}`));
      for (const rel of listed.files) {
        if (isStray(rel)) { strays++; continue; }
        if (isViewState(rel) || houseIgnored(rel) !== null) continue;
        const abs = join(margins, slug, ...rel.split("/"));
        plan.push({ from: abs, to: `faces/${fk}/personal/${slug}/${rel}`, row: { face: fk, bag: wikiSlotUri(slug, "personal"), layer: "personal", title: carriedFileTitle(margins, abs), rowKey: null } });
      }
    }
    for (const slug of folders(join(root, FACE_PLANES.recovery))) addTree(join(root, FACE_PLANES.recovery, slug), `faces/${fk}/drafts/${slug}`, () => ({ face: fk, bag: wikiSlotUri(slug, "draft"), layer: "draft", title: null, rowKey: null }));
    for (const slug of folders(join(root, FACE_PLANES.temp))) {
      if (!consented.has(slug)) { omissions.push({ kind: "temp-unconsented", detail: `the ${slug} wiki's temp folder of face ${fk} stands with no consent row (projection.temp.${slug}); it stays behind` }); continue; }
      addTree(join(root, FACE_PLANES.temp, slug), `faces/${fk}/temp/${slug}`, (_rel, abs) => {
        const bag = wikiSlotUri(slug, "temp");
        tempBytes[bag] = (tempBytes[bag] ?? 0) + lstatSync(abs).size;
        return { face: fk, bag, layer: "temp", title: null, rowKey: null };
      });
    }
  }
  for (const name of folders(wikisDir)) {
    const src = join(wikisDir, name);
    if (isPrivateProjectionSlug(name)) continue;
    const wikiBases = await baseFor(wikiSlotUri(name, "working"));
    addTree(src, `wikis/${name}/working`, (_rel, abs) => withBase({ face: null, bag: wikiSlotUri(name, "working"), layer: "wiki-working", title: carriedFileTitle(wikisDir, abs), rowKey: null }, wikiBases), ["recovery", TEMP_LAYER_DIR]);
  }
  // A SOURCED WIKI'S ONE WORKBENCH FOLDER rests beside its canon source: the same one row set, from that folder. A KEEP reads
  // where the folder rests: inside the checkout git holds it, so the keep names it under `elsewhere` and carries none of it.
  const canonWikis = doors.canonWikis?.() ?? null;
  const elsewhere: BundleElsewhere[] = [];
  if (canonWikis !== null && resolve(canonWikis) !== resolve(wikisDir)) {
    for (const name of folders(canonWikis)) {
      if (doors.sourced?.(name) !== true || isPrivateProjectionSlug(name)) continue;
      const bench = join(canonWikis, name);
      if (opts.houseOnly === true && inside(repoRoot, bench)) {
        elsewhere.push({ slug: name, layer: "wiki-working", bag: wikiSlotUri(name, "working"), holder: "checkout", path: relative(realish(repoRoot), realish(bench)).split(sep).join("/") });
        continue;
      }
      const wikiBases = await baseFor(wikiSlotUri(name, "working"));
      addTree(join(canonWikis, name), `wikis/${name}/working`, (_rel, abs) => withBase({ face: null, bag: wikiSlotUri(name, "working"), layer: "wiki-working", title: carriedFileTitle(canonWikis, abs), rowKey: null }, wikiBases), ["recovery", TEMP_LAYER_DIR]);
    }
  }
  for (const name of folders(bagsDir)) {
    const src = join(bagsDir, name);
    if (name === "daemon") {
      // This directory has no disk mirror grant, so its files stay out of the house bundle.
      continue;
    }
    if (isPrivateProjectionSlug(name)) continue;
    addTree(src, `bags/${name}`, (_rel, abs) => ({ face: null, bag: wikiBagUri(name), layer: "bag", title: carriedFileTitle(bagsDir, abs), rowKey: null }));
  }
  // A COLD WIKI'S PUTS RIDE NO MIRROR (cabal-realm#/the-workbench, OWED): the copy reads disk, so it names what disk cannot show.
  const woken = new Set(opts.woken ?? []);
  const cold = (doors.coldWikis ? await doors.coldWikis().catch(() => [] as readonly string[]) : []).filter((slug) => !woken.has(slug));
  if (cold.length > 0) omissions.push({ kind: "cold-wikis", detail: `${[...cold].sort().join(", ")} stand${cold.length === 1 ? "s" : ""} cold (no island mounts ${cold.length === 1 ? "it" : "them"} now): a page a face put into a cold wiki since its last wake rests in its layer and projected nowhere, so no such page travels. Wearing each face that wrote there, wake the wiki (\`lares wiki hold <slug>\`), then export again`, items: [...cold].sort(), count: cold.length });
  // A WIKI THAT HOLDS NO PAGE carries by its catalog row alone; a sourced wiki rides git with its canon, and the daemon wiki is each face's own.
  let userWikis: string[] = [];
  if (doors.userWikis) {
    try { userWikis = [...(await doors.userWikis())].filter((slug) => slug !== "daemon" && doors.sourced?.(slug) !== true && !isPrivateProjectionSlug(slug)).sort(); }
    catch (e) { throw new BundleRefused("carry-wikis-unread", `the catalog's wiki list would not read (${e instanceof Error ? e.message : String(e)}), so a wiki that holds no page would stay behind unnamed: stand the vessel and export again`); }
  }
  if (strays > 0) omissions.push({ kind: "atomic-write-strays", detail: "orphan *.lar-tmp-* files an atomic write left; none carries a record", count: strays });
  if (repos.length > 0) omissions.push({ kind: "mirror-repos", detail: "a `.git` inside a mirror: the house never held a byte of it, and its commits carry authorship, so none travels", items: [...repos].sort(), count: repos.length });
  if (odd > 0) omissions.push({ kind: "links-or-special-files", detail: "entries under the projections root that stand as neither a plain file nor a directory", count: odd });
  omissions.push({ kind: "parallel-drafts", detail: "another place's unmerged drafts rest in its draft floor doc (wikis/<slug>/drafts/<did>) and project nowhere; no door names them yet, so none travels" });

  // THE KEEP PAIR the roster seals to, read before any byte stages: a house that rests none refuses the cut by name.
  const seat = await seatAct(keepSeatForCut);
  // WRITE BESIDE THE DEST, VERIFY, THEN MOVE INTO PLACE.
  const staging = join(dirname(target), `.${basename(target)}.lar-tmp-${randomBytes(6).toString("hex")}`);
  mkdirSync(staging, { recursive: true });
  try {
    const files: BundleFile[] = [];
    const rows: BundleRow[] = [];
    const counts = zeroCounts();
    const put = (rel: string, bytes: Buffer | string): BundleFile => {
      const abs = join(staging, ...rel.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, bytes, { flag: "wx" });
      const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;
      const file = { path: rel, sha256: sha256Hex(buf), bytes: buf.length };
      files.push(file);
      return file;
    };
    for (const p of plan) {
      const abs = join(staging, ...p.to.split("/"));
      mkdirSync(dirname(abs), { recursive: true });
      copyFileSync(p.from, abs);
      const buf = readFileSync(abs);
      files.push({ path: p.to, sha256: sha256Hex(buf), bytes: buf.length });
      if (p.row !== null && !p.to.endsWith(".meta")) { rows.push({ ...p.row, sha256: sha256Hex(buf), path: p.to }); counts[p.row.layer]++; }
    }
    for (const f of named) {
      if (!f.kahua || f.kahua.length === 0) continue;
      const fk = keyOf.get(f.handleIndex)!;
      const heads = [...f.kahua].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.cid < b.cid ? -1 : 1));
      const file = put(`faces/${fk}/${KAHUA_HEADS_FILE}`, `${JSON.stringify(heads, null, 2)}\n`);
      for (const h of heads) { rows.push({ face: fk, bag: KAHUA_BAG, layer: "kahua-head", title: h.title, rowKey: h.cid, sha256: sha256Hex(h.text), path: file.path }); counts["kahua-head"]++; }
    }
    const redeclare: BundleRedeclare = {
      schema: BUNDLE_SCHEMA,
      faces: named.map((f): BundleRedeclareFace => ({ face: keyOf.get(f.handleIndex)!, handleIndex: f.handleIndex, petname: f.petname!, handle: f.handle, seat: f.seat, chair: f.seat ? f.chair : null })),
      // THE SHARE ROWS travel with the workbenches they seat: owner and seats by pet-name, sealed with the faces they name.
      ...((): { shares?: BundleShareEntry[] } => { const rows = doors.shareRows?.read() ?? []; return rows.length > 0 ? { shares: rows.map((r) => ({ ...r })) } : {}; })(),
      // EVERY USER WIKI, by slug: a wiki stands before it holds a page, so one with no workbench row still re-stands at the import.
      ...(userWikis.length > 0 ? { wikis: userWikis } : {}),
    };
    // THE ROSTER RIDES SEALED to the keep pair's public half: a remote the bundle reaches crosses to another vessel, and the cut
    // asks for no credential. The pair rides beside it, its secret wrapped under the human's routes.
    put(REDECLARE_FILE, sealRosterForCut(seat, redeclare));
    put(KEEP_SEAT_FILE, bundleSeatText(seat));
    files.sort((a, b) => (a.path < b.path ? -1 : 1));
    const manifest: BundleDiskManifest = { schema: BUNDLE_SCHEMA, bundleId: bundleIdOf(files), faces: bundleFaces, files, rows, counts, tempBytes, omissions, library: libraryListing(), ...(opts.houseOnly === true ? { elsewhere } : {}) };
    writeFileSync(join(staging, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    // Every byte read back against the manifest, the seat read whole, and the roster read against the manifest, before the bundle
    // takes its name.
    const verified = verifyBundle(staging);
    readBundleSeat(verified);
    const opened = rosterView(verified, redeclare);
    renameSync(staging, target);
    return { dest: target, manifest: opened.manifest };
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    throw e;
  }
}

/**
 * What the acquired library held, by collection, with its index carrier's digest. The originals survive a re-founding in
 * place (`<root>/library`, outside the hearth) and never enter a bundle; this listing lets a reader see what stood there.
 */
function libraryListing(): Array<{ readonly collection: string; readonly indexSha256: string | null }> {
  let collections: string[];
  try { collections = listCollections(); } catch { return []; }
  return collections.map((collection) => {
    let indexSha256: string | null = null;
    try { indexSha256 = sha256Hex(readFileSync(join(libraryCollectionDir(collection), "index.mem"))); } catch { /* no index yet */ }
    return { collection, indexSha256 };
  });
}


/**
 * The record a carrier file holds, as the fields its carrier form reads, or null where the bytes name no record this reader
 * parses: a `.tid` (its block, then the text), a `.json` (a one-element array of field strings), or a content file beside its
 * `.meta` sidecar (the sidecar's block, the file as the text). One trailing newline the projector writes never counts.
 */
export function carrierRecordOf(file: string, bytes: Buffer, meta: Buffer | null): Record<string, string> | null {
  const text = bytes.toString("utf8");
  const trim = (t: string): string => t.replace(/\n$/, "");
  if (file.endsWith(".tid")) {
    const fields = parseTidCarrier(text);
    return fields === null ? null : { ...fields, text: trim(fields["text"] ?? "") };
  }
  if (file.endsWith(".json")) {
    try {
      const v = JSON.parse(text) as unknown;
      const one = Array.isArray(v) && v.length === 1 ? v[0] : null;
      if (one === null || typeof one !== "object") return null;
      return Object.fromEntries(Object.entries(one as Record<string, unknown>).map(([k, x]) => [k, String(x)]));
    } catch { return null; }
  }
  if (meta === null) return null;
  const fields = parseTidCarrier(`${meta.toString("utf8").replace(/\n+$/, "")}\n\n`);
  return fields === null ? null : { ...fields, text: trim(text) };
}

/** Whether two carrier files hold one record: their carrier forms (`carrierFormOf`) agree. Bytes that parse to no record read false. */
export function sameCarrierRecord(a: Record<string, string> | null, b: Record<string, string> | null): boolean {
  if (a === null || b === null) return false;
  const fa = carrierFormOf(a), fb = carrierFormOf(b);
  return fa.body === fb.body && (fa.meta ?? null) === (fb.meta ?? null);
}

// ── import ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `<root>/config/carry-journal/<bundle-id>.<faces>.ndjson`. The config class survives a restart (the run class stands in tmpfs
 * inside the container, and an interrupted import must find its journal again) and never sits in the hearth.
 *
 * THE JOURNAL KEYS BY THE BUNDLE AND THE FACES IT LANDS ON: `<faces>` digests the sorted relations of the target faces. A reset
 * keeps config, so a journal keyed by the bundle alone would read every act landed when the same bundle walks onto FRESH faces
 * after a re-founding, and the import would land nothing; keyed by the target relations too, a re-walk imports afresh, while
 * a second import onto the same faces still lands nothing.
 */
export function bundleJournalPath(bundleId: string, targetRelations: readonly string[]): string {
  const faces = sha256Hex([...targetRelations].sort().join("\n")).slice(0, 16);
  return join(larConfigHome(), "carry-journal", `${bundleId}.${faces}.ndjson`);
}

interface Journal { readonly done: Map<string, string>; mark(key: string, value: string): void }

function openJournal(bundleId: string, targetRelations: readonly string[], write: boolean): Journal {
  const path = bundleJournalPath(bundleId, targetRelations);
  const done = new Map<string, string>();
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (line.trim() === "") continue;
      try { const r = JSON.parse(line) as { key?: unknown; value?: unknown }; if (typeof r.key === "string") done.set(r.key, String(r.value ?? "")); } catch { /* a torn last line */ }
    }
  } catch { /* no journal yet */ }
  return {
    done,
    mark(key, value) {
      done.set(key, value);
      if (!write) return;
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, `${JSON.stringify({ key, value })}\n`);
    },
  };
}

/**
 * One class's outcome. EVERY BUNDLE ROW COUNTS SOMEWHERE: landed, already standing, standing off, refused, or `waiting`: a row
 * of a face that stands open and unworn (its daemon rows, its `personal` rows, its kahua heads), which lands at that face's
 * own wear. A waiting row names its face in the result and never reads as a refusal.
 */
export interface BundleTally { landed: number; already: number; stoodOff: string[]; refused: string[]; planned: number; waiting: number }
const tally = (): BundleTally => ({ landed: 0, already: 0, stoodOff: [], refused: [], planned: 0, waiting: 0 });

export interface HouseImportResult {
  readonly bundleId: string;
  readonly applied: boolean;
  /** Bundle face pet-name -> the handle index it lands on. */
  readonly faceMap: Readonly<Record<string, number>>;
  readonly redeclare: readonly string[];
  readonly tallies: Readonly<Record<"working" | "kapae" | "faceCanon" | "kahua" | "draft" | "temp" | "bag" | "wikiWorking" | "personal", BundleTally>>;
  /** Each workbench (or the canon of a wiki another face owns) whose rows wait: `writer` (the daemon mount holds no writer's seat
   *  there) or `owner` (a share row names another face as the wiki's owner, and no face stood it here yet). Nothing of it landed. */
  readonly benchWaiting: ReadonlyArray<{ readonly slug: string; readonly why: "writer" | "owner"; readonly owner?: string }>;
  /** Each bundle face whose `personal` rows wait for that face's own wear; or, naming `wiki` and its `owner`, whose margin of a
   *  wiki no face stood here yet waits for that owner's wear to mint it. */
  readonly personalWaiting: ReadonlyArray<{ readonly petname: string; readonly handleIndex: number; readonly wiki?: string; readonly owner?: string }>;
  /** Each bundle face whose kahua heads wait for that face's own wear (a lift signs under its own grant), with how many. */
  readonly kahuaWaiting: ReadonlyArray<{ readonly petname: string; readonly handleIndex: number; readonly heads: number }>;
  /** Each bundle face whose daemon rows (working, face canon) the island opened no layer for under this wear: they land at its own. */
  readonly daemonWaiting: ReadonlyArray<{ readonly petname: string; readonly handleIndex: number }>;
  /** The share rows the bundle carried that this vessel's file held none of (written on apply), and the landing's answer. */
  readonly shares: { readonly written: readonly string[]; readonly landed: boolean };
  /** The bags (and the wikis they open as) this import mints, or would mint in a preview, before it re-pours them. */
  readonly minted: readonly string[];
  readonly skipped: readonly string[];
  /** The bundle faces whose face here stands SHUT: nothing of theirs laid into any layer; unlock each and import again. */
  readonly waiting: ReadonlyArray<{ readonly petname: string; readonly handleIndex: number }>;
  /** What a preview names that the apply would refuse (an unlaid canon), each with its cure. */
  readonly warnings: readonly string[];
}

/**
 * Import the bundle at `src`. The bundle verifies whole before anything moves; preview (`apply` false) reads the vessel
 * and plans every act, and writes nothing. Throws {@link BundleRefused} (or {@link BundleVerifyRefused}) by name.
 */
/** The store door's names for a vessel that stands down or locked: a face reads no relation under any of them. */
const SHUT_VESSEL_CODES: ReadonlySet<string> = new Set(["vessel-locked", "daemon-unreachable", "vessel-composing"]);

export async function houseImport(src: string, opts: { readonly apply: boolean; readonly doors: BundleDoors }): Promise<HouseImportResult> {
  const { doors, apply } = opts;
  const sealed = verifyBundle(resolve(src));
  // THE ROSTER OPENS UNDER THE KEEP SEAT THE BUNDLE CARRIES: the human's passphrase or paper sheet opens its secret, then the
  // roster. A route that opens no slot refuses by name, before anything moves; no key file crosses by hand.
  const seat = readBundleSeat(sealed);
  const route = await seatAct(doors.keepRoute ?? liveKeepRoute);
  const opening = await openKeepSeat(seat, route);
  if (opening.reading !== "opens") {
    throw new BundleRefused("keep-route-refused", opening.reading === "seat-torn"
      ? "a slot of the bundle's keep seat opened a secret that answers another pair: the seat stands torn; restore from another keep"
      : "the route presented opens no slot of the bundle's keep seat: present the steward's passphrase or paper sheet the keep sealed under, then import again");
  }
  let bundle: VerifiedBundle;
  try { bundle = openBundle(sealed, opening.secret); } finally { opening.secret.fill(0); }
  const { manifest, redeclare } = bundle;
  // THE ORDER GUARD: the walk runs found -> up -> lay -> import. An import lands its rows over the canon the lay
  // laid, so its bag rows meet the checkout's canon at INGEST's three-way gate and stand off where they diverge; over
  // an unlaid canon the import's rows would land as the canon itself, and the lay after would stand off against
  // them. It refuses by name rather than laying canon itself: a lay asks the operator to grade new canon, and an import
  // never takes that answer for them.
  // A PREVIEW READS THE SAME GUARD AS A WARNING: it names what the apply would refuse, and plans on.
  const unseeded = doors.unseeded ? doors.unseeded() : [];
  const unseededWhy = `the canon of ${unseeded.join(", ")} stands unlaid on this vessel, and an import lands over laid canon alone: run \`lares vessel lay --apply\` first, then import again`;
  if (apply && unseeded.length > 0) throw new BundleRefused("carry-canon-unseeded", unseededWhy);
  const warnings: string[] = unseeded.length > 0 ? [`carry-canon-unseeded: ${unseededWhy}`] : [];
  const projections = larProjectionsHome();
  let faces = await doors.faces();

  // RE-DECLARE FIRST: each bundle face finds the ONE face here that carries its pet-name, or names one by its index.
  const acts: string[] = [];
  const planned: Array<{ row: BundleRedeclareFace; handleIndex: number; rename: boolean; handle: boolean; seat: boolean }> = [];
  for (const row of redeclare.faces) {
    const matches = faces.filter((f) => f.petname === row.petname);
    if (matches.length > 1) throw new BundleRefused("carry-face-duplicate-petname", `faces ${matches.map((m) => `h${m.handleIndex}`).join(" and ")} on this vessel both carry the pet-name "${row.petname}"; the bundle's memory for it lands on one face alone, so rename one and import again`);
    let target = matches[0];
    let rename = false;
    if (target === undefined) {
      const at = faces.find((f) => f.handleIndex === row.handleIndex);
      if (at === undefined) throw new BundleRefused("carry-face-unmatched", `no face on this vessel carries the pet-name "${row.petname}", and none stands at h${row.handleIndex} to carry it: found it (\`lares persona new ${row.handleIndex} --name '${row.petname}'\`) and import again`);
      if (at.petname !== null) throw new BundleRefused("carry-face-unmatched", `no face on this vessel carries the pet-name "${row.petname}", and the face at h${row.handleIndex} carries "${at.petname}"; the bundle never merges one face's memory into another's: name the face that should carry "${row.petname}" and import again`);
      target = at;
      rename = true;
    }
    if (row.handle !== null && target.handle !== null && target.handle !== row.handle) throw new BundleRefused("carry-redeclare-diverged", `the face "${row.petname}" declares the Handle "${target.handle}" here and "${row.handle}" in the bundle; the import never overwrites a declaration`);
    if (row.seat && target.seat && row.chair !== null && target.chair !== null && target.chair !== row.chair) throw new BundleRefused("carry-redeclare-diverged", `the face "${row.petname}" stands for the chair "${target.chair}" here and "${row.chair}" in the bundle; the import never overwrites a declaration`);
    planned.push({ row, handleIndex: target.handleIndex, rename, handle: row.handle !== null && target.handle === null, seat: row.seat && !target.seat });
  }
  for (const p of planned) {
    if (p.rename) acts.push(`h${p.handleIndex}: pet-name "${p.row.petname}"`);
    if (p.handle) acts.push(`h${p.handleIndex}: Handle "${p.row.handle}"`);
    if (p.seat) acts.push(`h${p.handleIndex}: stands for the chair "${p.row.chair ?? defaultChairLabel(p.handleIndex)}"`);
  }
  if (apply) {
    for (const p of planned) {
      if (p.rename) await doors.rename(p.handleIndex, p.row.petname);
      if (p.handle) await doors.declareHandle(p.handleIndex, p.row.handle!);
      if (p.seat) await doors.standSeat(p.handleIndex, p.row.chair);
    }
    if (planned.some((p) => p.rename || p.handle || p.seat)) faces = await doors.faces();
  }

  // THE FACE MAP: pet-name -> the face here, which must wear a relation for its folders.
  const faceMap: Record<string, number> = {};
  const target = new Map<string, BundleVesselFace>();
  for (const bf of manifest.faces) {
    const p = planned.find((x) => x.row.face === bf.key)!;
    const face = faces.find((f) => f.handleIndex === p.handleIndex)!;
    // A face that reads no relation while ANOTHER face stands worn waits its turn (the lit-face gate below), never refuses.
    if (face.relation === null && mountFaceOf(faces) === null) {
      // A face reads no relation while its vessel stands down or locked: the cure reads "up, then unlock", before anything else.
      const shut = face.kahuaRefusalCode !== undefined && SHUT_VESSEL_CODES.has(face.kahuaRefusalCode);
      throw new BundleRefused("carry-face-unworn", shut
        ? `the face h${face.handleIndex} ("${bf.petname}") reads no face relation because the vessel's key stands shut or no vessel answers (${face.kahuaRefusal}): run up and vault unlock first (\`tools/lares-container.sh up\` or \`lares vessel stand\`, then \`lares vault unlock\`), and import again`
        : `the face h${face.handleIndex} ("${bf.petname}") pins no face relation, so its daemon wiki has no folder to land in: stand the vessel wearing it and import again${face.kahuaRefusal ? ` (${face.kahuaRefusal})` : ""}`);
    }
    faceMap[bf.petname] = face.handleIndex;
    target.set(bf.key, face);
  }
  // EACH BUNDLE FACE LANDS IN THE ROOT ITS PET NAME MAKES (`faces/<pet name>`): a name that makes none refuses before anything moves.
  for (const bf of manifest.faces) {
    const refused = faceSegmentRefusal(bf.petname, manifest.faces.filter((o) => o.key !== bf.key).map((o) => o.petname));
    if (refused !== null) throw new BundleRefused("carry-face-segment", `the bundle face "${bf.petname}": ${refused.code}: ${refused.why}`);
  }
  const faceRootOf = (bf: { readonly petname: string }): string => faceRoot(projections, bf.petname);
  // The journal opens once the faces it lands on stand named: the bundle and the target relations key it.
  const journal = openJournal(manifest.bundleId, [...target.values()].map((f) => f.relation).filter((r): r is string => r !== null), apply);
  if (apply) for (const p of planned) journal.mark(`redeclare:${p.row.face}`, `h${p.handleIndex}`);

  // THE LIT SET, as the lay reads it: every bundle face whose face here stands OPEN lands its working and face-canon rows (and
  // its drafts and temp) in that face's own layer: the daemon mount's through the ordinary wave, each other open face's through a
  // wave naming it (the island lands it only where that face owns the document, never on the daemon mount). A bundle face whose
  // face here stands SHUT waits, named; nothing of its memory lands anywhere. Kahua heads lift each under its own face's grant.
  const litRelation = mountFaceOf(faces)?.relation ?? null;
  const unworn = new Set(manifest.faces.filter((bf) => target.get(bf.key)!.relation === null).map((bf) => bf.key));
  const faceArgOf = (bf: { readonly key: string }): { face?: number } => {
    const face = target.get(bf.key)!;
    return face.relation === litRelation ? {} : { face: face.handleIndex };
  };
  const waiting = manifest.faces.filter((bf) => unworn.has(bf.key)).map((bf) => ({ petname: bf.petname, handleIndex: target.get(bf.key)!.handleIndex }));

  const tallies = { working: tally(), kapae: tally(), faceCanon: tally(), kahua: tally(), draft: tally(), temp: tally(), bag: tally(), wikiWorking: tally(), personal: tally() };
  // THE SHARE ROWS THE BUNDLE CARRIED (vessel-private; owner and seats by pet-name): a slug this vessel's file holds no row for
  // takes the bundle's row, and a row that stands here stays as it stands. They gate the mint below and land again at the close.
  const benchWaiting: Array<{ slug: string; why: "writer" | "owner"; owner?: string }> = [];
  const personalWaiting: Array<{ petname: string; handleIndex: number; wiki?: string; owner?: string }> = [];
  const kahuaWaiting: Array<{ petname: string; handleIndex: number; heads: number }> = [];
  const daemonWaiting: Array<{ petname: string; handleIndex: number }> = [];
  const standingShares = [...(doors.shareRows?.read() ?? [])];
  const carriedShares = (redeclare.shares ?? []).filter((r) => !standingShares.some((x) => x.slug === r.slug));
  const allShares: ShareEntry[] = [...standingShares, ...carriedShares.map((r): ShareEntry => ({ ...r }))];
  if (apply && carriedShares.length > 0 && doors.shareRows) doors.shareRows.write(allShares);
  // THE CARRIED ROWS REACH THE CONTROL DOCUMENT NOW, beside the file: this wear's landing reads them, so the owner's own wear
  // owes each grant and carries each reader's catalog row to that reader's next wear, before its margin mounts the wiki.
  if (apply && doors.shareSet !== undefined) {
    for (const r of carriedShares) {
      try { await doors.shareSet(r); }
      catch (e) { warnings.push(`carry-share-unset: the share row of ${r.slug} rests in config/${SHARE_CONFIG_FILE} alone (${e instanceof Error ? e.message : String(e)}); the vessel's next boot reconciles it, and \`lares ${r.kind} share ${r.slug}\` lands it at its owner's wear`); }
    }
  }
  const mountPet = mountFaceOf(faces)?.petname ?? null;
  const gates = new Map<string, { why: "writer" | "owner"; owner?: string } | null>();
  /** Why the daemon mount may not land this wiki's workbench (or mint the wiki) now, or null where it may. */
  const gateOf = async (slug: string): Promise<{ why: "writer" | "owner"; owner?: string } | null> => {
    if (gates.has(slug)) return gates.get(slug)!;
    let gate: { why: "writer" | "owner"; owner?: string } | null = null;
    if (mountFaceOf(faces) !== null && doors.benchSeat !== undefined) {
      const seat = await doors.benchSeat(slug);
      const owner = allShares.find((r) => r.kind === "wiki" && r.slug === slug)?.owner ?? null;
      if (seat.bound) gate = seat.writeSlot === "working" ? null : { why: "writer" };
      else gate = owner !== null && mountPet !== owner ? { why: "owner", owner } : null;
    }
    gates.set(slug, gate);
    return gate;
  };
  const waitBench = (slug: string, gate: { why: "writer" | "owner"; owner?: string }): void => {
    if (!benchWaiting.some((w) => w.slug === slug)) benchWaiting.push({ slug, why: gate.why, ...(gate.owner !== undefined ? { owner: gate.owner } : {}) });
  };
  const minted: string[] = [];
  const skipped: string[] = [];

  // THE OVERRIDE BASE TRAVELS: a working row names the carrier identity of the canon record its copy forked from (and each
  // fragment's, `familyBases`), and its carrier carries them, so the island stamps each on the record it lands and canon's
  // fresher-than-the-copy warning still reads after the round trip.
  const baseByFile = new Map<string, Pick<ScanRow, "overrideBase" | "familyBases">>();
  for (const row of manifest.rows) {
    if (row.overrideBase === undefined && row.familyBases === undefined) continue;
    baseByFile.set(join(bundle.root, ...row.path.split("/")), { ...(row.overrideBase !== undefined ? { overrideBase: row.overrideBase } : {}), ...(row.familyBases !== undefined ? { familyBases: row.familyBases } : {}) });
  }

  // An import restores each file into its mirror, then ingest reads it there so the placement ward sees the bag's own mirror.
  const wave = async (sourceDir: string, uriDir: string, mirrorDir: string, toBag: string, carried: readonly string[], keyPrefix: string, workTally: BundleTally, kapaeTally: BundleTally | null, wiki: string | null = null, freshLayer = false, faceArg: { face?: number } = {}): Promise<void> => {
    // HOUSE_IGNORED: a bundle an older export wrote may carry a mirror's `.git/` or a stand-off render; none of it restores.
    const files: string[] = [];
    for (const f of carried) { if (houseIgnored(relative(sourceDir, join(bundle.root, ...f.split("/")))) === null) files.push(f); else skipped.push(join(bundle.root, ...f.split("/"))); }
    if (files.length === 0) return;
    const scan = scanFiles(bundle.root, files.map((f) => join(bundle.root, ...f.split("/"))), toBag, new SyncedTree(null), (_r, file) => carriedFileTitle(uriDir, file));
    for (const s of scan.skipped) if (!s.file.endsWith(".meta")) skipped.push(s.file);
    for (const r of scan.refusedShadows ?? []) kapaeTally?.refused.push(`${r.file} (${r.refusal})`);
    const keyed = (r: ScanRow): string => `${keyPrefix}:${r.uri}:${r.diskHash}`;
    let candidates = candidatesOf(scan.rows).filter((r) => { if (journal.done.has(keyed(r))) { workTally.already++; return false; } return true; })
      .map((r): ScanRow => { const bases = baseByFile.get(r.file); return bases !== undefined ? { ...r, ...bases } : r; });
    for (const r of scan.rows) if (r.status === "non-nfc") workTally.refused.push(`${r.uri} (non-NFC bytes)`);
    const shadowTally = kapaeTally ?? workTally;
    let kapae = (scan.shadows ?? []).filter((t) => { if (journal.done.has(`${keyPrefix}:kapae:${t}`)) { shadowTally.already++; return false; } return true; });
    const wanted = new Set([...candidates.map((r) => r.uri), ...kapae]);
    // A MIRROR FILE THAT DIFFERS IN BYTES reads by the RECORD it holds, never by its bytes: one record in another framing
    // (a field order, a trailing newline) reads already landed, and a different record rides on to INGEST's three-way gate
    // with the mirror's file left as it stands. No stand-off ever rests on byte drift alone. A preview reads the same.
    const differing = new Map<string, { from: string; to: string }>();
    const pending: Array<{ uri: string; to: string; bytes: Buffer }> = [];
    /** Each wanted uri, and whether the mirror holds every one of its files. */
    const held = new Map<string, boolean>();
    for (const f of files) {
      const from = join(bundle.root, ...f.split("/"));
      const uri = carriedFileTitle(uriDir, from.endsWith(".meta") ? from.slice(0, -5) : from);
      if (!uri || !wanted.has(uri)) continue;
      const to = join(mirrorDir, relative(sourceDir, from));
      const bytes = readFileSync(from);
      if (existsSync(to)) {
        held.set(uri, held.get(uri) ?? true);
        if (!readFileSync(to).equals(bytes)) differing.set(uri, from.endsWith(".meta") ? { from: from.slice(0, -5), to: to.slice(0, -5) } : { from, to });
      } else { held.set(uri, false); pending.push({ uri, to, bytes }); }
    }
    const readMeta = (path: string): Buffer | null => (existsSync(`${path}.meta`) ? readFileSync(`${path}.meta`) : null);
    // The mirror holding every file of a row byte for byte holds its record: already landed (the lay laid it), never planned.
    // A LAYER THIS IMPORT MINTS (a slug the vessel did not hold) holds nothing yet, so its mirror vouches for no record: every
    // row rides to INGEST, and the mirror's own file still stands unwritten over.
    const already = new Set<string>(freshLayer ? [] : [...held].filter(([uri, all]) => all && !differing.has(uri)).map(([uri]) => uri));
    for (const [uri, { from, to }] of differing) {
      if (freshLayer) break;
      if (!existsSync(to)) continue;
      if (from.endsWith(KAPAE_EXT)) {
        const a = readKapaeShadow(readFileSync(from, "utf8")), b = readKapaeShadow(readFileSync(to, "utf8"));
        if ("title" in a && "title" in b && a.title === b.title) already.add(uri);
        continue;
      }
      if (sameCarrierRecord(carrierRecordOf(from, readFileSync(from), readMeta(from)), carrierRecordOf(to, readFileSync(to), readMeta(to)))) already.add(uri);
    }
    for (const r of candidates) if (already.has(r.uri)) { workTally.already++; if (apply) journal.mark(keyed(r), "landed"); }
    for (const t of kapae) if (already.has(t)) { shadowTally.already++; if (apply) journal.mark(`${keyPrefix}:kapae:${t}`, "raised"); }
    candidates = candidates.filter((r) => !already.has(r.uri));
    kapae = kapae.filter((uri) => !already.has(uri));
    workTally.planned += candidates.length;
    shadowTally.planned += kapae.length;
    if (!apply || (candidates.length === 0 && kapae.length === 0)) return;
    for (const { uri, to, bytes } of pending) {
      if (differing.has(uri)) continue;                 // the mirror holds this record in its own file; nothing writes over it
      mkdirSync(dirname(to), { recursive: true });
      atomicWriteFileSync(to, bytes, undefined, { mode: 0o600 });
    }
    // A RESTORED FILE STAYS ONLY WHERE ITS RECORD LANDED: a file this wave restored for a row that waits, stood off, refused
    // or went unanswered leaves the mirror again, since a file standing there reads `already` at the next import and its
    // record never rides to INGEST.
    const unrestore = (kept: ReadonlySet<string>): void => { for (const { uri, to } of pending) if (!differing.has(uri) && !kept.has(uri)) rmSync(to, { force: true }); };
    let answer: BundleIngestAnswer;
    try {
      answer = await doors.ingest({ source: mirrorDir, toBag, candidates, kapae, ...(wiki !== null ? { inWiki: true, wiki } : {}), ...faceArg });
    } catch (e) {
      // A door that throws a whole-wave refusal reads as the folded one where it names a face's wait; any other throw climbs.
      const why = e instanceof Error ? e.message : String(e);
      if (faceArg.face === undefined || !FACE_LAYER_WAITS.test(why)) { unrestore(new Set()); throw e; }
      answer = { landed: [], unanswered: [], conflicts: [], kapaeRaised: [], ...foldWaveRefusal(why, candidates, kapae) };
    }
    // A WAVE NAMING A FACE THE ISLAND OPENS NO LAYER FOR waits by name, as the lay's does: nothing of it landed anywhere.
    const refusedAll = [...answer.refused, ...answer.kapaeRefused];
    if (faceArg.face !== undefined && answer.landed.length === 0 && answer.kapaeRaised.length === 0 && refusedAll.length > 0 && refusedAll.every((c) => FACE_LAYER_WAITS.test(c.why))) {
      workTally.planned -= candidates.length; shadowTally.planned -= kapae.length;
      workTally.waiting += candidates.length; shadowTally.waiting += kapae.length;
      unrestore(new Set());
      const face = [...target.values()].find((f) => f.handleIndex === faceArg.face);
      const bf = manifest.faces.find((b) => target.get(b.key) === face);
      if (face !== undefined && bf !== undefined && !daemonWaiting.some((w) => w.handleIndex === face.handleIndex)) daemonWaiting.push({ petname: bf.petname, handleIndex: face.handleIndex });
      return;
    }
    const landed = new Set(answer.landed);
    unrestore(new Set([...answer.landed, ...answer.kapaeRaised]));
    for (const r of candidates) if (landed.has(r.uri)) { workTally.landed++; journal.mark(keyed(r), "landed"); }
    for (const c of answer.conflicts) workTally.stoodOff.push(`${c.uri} (${c.why})`);
    for (const c of answer.refused) workTally.refused.push(`${c.uri} (${c.why})`);
    for (const u of answer.unanswered) workTally.refused.push(`${u} (no answer; import again)`);
    for (const t of answer.kapaeRaised) { shadowTally.landed++; journal.mark(`${keyPrefix}:kapae:${t}`, "raised"); }
    for (const k of answer.kapaeRefused) shadowTally.refused.push(`${k.uri} (${k.why})`);
  };
  for (const bf of manifest.faces) {
    if (unworn.has(bf.key)) continue;
    const relation = target.get(bf.key)!.relation!;
    for (const kind of ["working", "canon"] as const) {
      const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`faces/${bf.key}/${kind}/`));
      const mirror = join(faceRootOf(bf), kind === "working" ? FACE_PLANES.wiki : FACE_PLANES.canon);
      await wave(join(bundle.root, "faces", bf.key, kind), join(bundle.root, "faces", bf.key), mirror,
        kind === "working" ? wikiSlotUri("daemon", "working") : daemonFaceCanonBag(relation), files,
        `${kind}:${bf.key}`, kind === "working" ? tallies.working : tallies.faceCanon, kind === "working" ? tallies.kapae : null, null, false, faceArgOf(bf));
    }
  }

  // KAHUA HEADS: re-lifted under the new face's grant, keyed by title + body digest.
  for (const bf of manifest.faces) {
    const face = target.get(bf.key)!;
    const heads = bundle.heads.get(bf.key) ?? [];
    if (heads.length === 0) continue;
    if (face.kahua === null && unworn.has(bf.key)) continue;              // a shut face that waits its turn: its heads lift once it opens
    if (face.kahua === null) { tallies.kahua.refused.push(`the stage of h${face.handleIndex} would not read (${face.kahuaRefusal ?? "unread"}); ${heads.length} head(s) wait`); continue; }
    const byTitle = new Map<string, BundleKahuaHead[]>();
    for (const h of heads) byTitle.set(h.title, [...(byTitle.get(h.title) ?? []), h]);
    // A LIFT RIDES THE DAEMON MOUNT (`chore-face-not-mounted`): where the vessel names the face it mounts, a head of any other
    // open face waits by name, and no lift reaches the vessel for it.
    const liftsHere = !faces.some((f) => f.mounted !== undefined) || face.relation === litRelation;
    let waitingHeads = 0;
    for (const [title, bundleHeads] of byTitle) {
      const bundleDigests = new Set(bundleHeads.map((h) => sha256Hex(h.text)));
      const standing = face.kahua.filter((h) => h.title === title);
      const foreign = standing.filter((h) => !bundleDigests.has(sha256Hex(h.text)));
      if (foreign.length > 0) { tallies.kahua.stoodOff.push(`${title} (the stage here holds a body the bundle never carried; lift by hand to settle it)`); continue; }
      const here = new Set(standing.map((h) => sha256Hex(h.text)));
      for (const h of bundleHeads) {
        const digest = sha256Hex(h.text), key = `kahua:${bf.key}:${title}:${digest}`;
        if (here.has(digest) || journal.done.has(key)) { tallies.kahua.already++; continue; }
        if (!liftsHere) { tallies.kahua.waiting++; waitingHeads++; continue; }
        tallies.kahua.planned++;
        if (!apply) continue;
        try {
          // A FIRST LIFT, or a sibling beside a head this bundle carried: never a supersede of a body the stage holds.
          const { cid } = await doors.kahuaLift(face.handleIndex, { title, text: h.text, fields: h.fields, taint: h.taint, sources: h.sources, parent: null });
          journal.mark(key, cid);
          here.add(digest);
          tallies.kahua.landed++;
        } catch (e) { tallies.kahua.refused.push(`${title} (${e instanceof Error ? e.message : String(e)})`); }
      }
    }
    if (waitingHeads > 0) kahuaWaiting.push({ petname: bf.petname, handleIndex: face.handleIndex, heads: waitingHeads });
  }

  // DRAFTS AND TEMP: files land back beside the new face's working folder, where none stands.
  const consented = new Set(doors.tempConsented());
  const place = (from: string, to: string, sha: string, t: BundleTally): void => {
    const key = `file:${to}:${sha}`;
    if (existsSync(to)) {
      if (sha256Hex(readFileSync(to)) === sha) { t.already++; return; }
      t.stoodOff.push(`${to} (a different file stands there; the import never writes over it)`);
      return;
    }
    if (journal.done.has(key)) { t.already++; return; }
    t.planned++;
    if (!apply) return;
    mkdirSync(dirname(to), { recursive: true });
    const tmp = `${to}.lar-tmp-${randomBytes(4).toString("hex")}`;
    copyFileSync(from, tmp);
    try { renameSync(tmp, to); } finally { rmSync(tmp, { force: true }); }
    journal.mark(key, "placed");
    t.landed++;
  };
  // Each lands in its face's root: a draft at `recovery/<slug>`, a shared wiki's temp at `temp/<slug>`, the daemon wiki's temp
  // beside its working layer (`wiki/temp`).
  for (const f of manifest.files) {
    const m = /^faces\/(f[0-9]+)\/(drafts|temp)\/([^/]+)\/(.+)$/.exec(f.path);
    if (!m) continue;
    const [, owner, kind, slug, rest] = m as unknown as [string, string, "drafts" | "temp", string, string];
    if (unworn.has(owner)) continue;
    const root = faceRootOf(manifest.faces.find((b) => b.key === owner)!);
    const t = kind === "drafts" ? tallies.draft : tallies.temp;
    if (kind === "temp" && !consented.has(slug)) { t.stoodOff.push(`${f.path} (no consent row names projection.temp.${slug} on this vessel)`); continue; }
    const to = kind === "drafts" ? join(root, FACE_PLANES.recovery, slug, ...rest.split("/"))
      : slug === "daemon" ? join(root, FACE_PLANES.wiki, TEMP_LAYER_DIR, ...rest.split("/"))
      : join(root, FACE_PLANES.temp, slug, ...rest.split("/"));
    place(join(bundle.root, ...f.path.split("/")), to, f.sha256, t);
  }

  // EVERY OTHER WIKI AND HOUSE-MINTED BAG, by slug: a slug this vessel does not hold mints first, through CREATE.
  const slugsOf = (re: RegExp): string[] => [...new Set(manifest.files.map((f) => re.exec(f.path)?.[1]).filter((s): s is string => s !== undefined))].sort();
  const bagSlugs = slugsOf(/^bags\/([^/]+)\//);
  // A wiki re-stands from its workbench rows or from the catalog row the re-declare list names (a wiki that holds no page).
  const wikiSlugs = [...new Set([...slugsOf(/^wikis\/([^/]+)\/working\//), ...(redeclare.wikis ?? [])])].sort();
  /** The slugs this vessel did not hold before the import: their layers mint fresh, so no mirror file reads already landed there. */
  const freshSlugs = new Set<string>();
  /** The slugs that wait for their owner's wear: nothing of them mints or lands under this face. */
  const unminted = new Set<string>();
  if (bagSlugs.length + wikiSlugs.length > 0) {
    const held = await doors.heldSlugs();
    for (const slug of [...new Set([...bagSlugs, ...wikiSlugs])].sort()) {
      if (held.has(slug)) continue;
      if (doors.sourced?.(slug) === true) continue;
      // A wiki another face owns mints at that face's wear, and a wiki another face's realm already binds (this face holds no
      // writer's seat there) stands in the house already: nothing of either mints under this face, which reads such a wiki only
      // through what a share row grants it (the landing carries the wiki's recipe row by reference).
      const gate = await gateOf(slug);
      if (gate !== null) { waitBench(slug, gate); unminted.add(slug); continue; }
      freshSlugs.add(slug);
      minted.push(wikiBagUri(slug));
      if (!apply || journal.done.has(`mint:${slug}`)) continue;
      // A WIKI mints through the wiki door, so its recipe row stands and `--recipe <slug>` answers; a plain bag through CREATE.
      const asWiki = doors.mintWiki !== undefined && (wikiSlugs.includes(slug) || allShares.some((r) => r.kind === "wiki" && r.slug === slug));
      try { await (asWiki ? doors.mintWiki!(slug) : doors.mintBag(wikiBagUri(slug))); journal.mark(`mint:${slug}`, "minted"); }
      catch (e) { tallies.bag.refused.push(`${wikiBagUri(slug)} (mint refused: ${e instanceof Error ? e.message : String(e)})`); }
    }
  }
  for (const slug of bagSlugs) {
    if (unminted.has(slug)) continue;
    const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`bags/${slug}/`));
    await wave(join(bundle.root, "bags", slug), join(bundle.root, "bags"), join(projections, "bags", slug), wikiBagUri(slug), files, `bag:${slug}`, tallies.bag, null, null, freshSlugs.has(slug));
  }
  // A WORKBENCH LANDS ONCE, FOR ITS DOCUMENT: through the daemon mount's island where that face holds a writer's seat (or stands the
  // wiki first), into its one folder (a sourced wiki's rests beside its canon source). Under any other face its rows wait by name.
  const canonWikis = doors.canonWikis?.() ?? null;
  for (const slug of wikiSlugs) {
    if (unminted.has(slug)) continue;
    const gate = await gateOf(slug);
    if (gate !== null) { waitBench(slug, gate); continue; }
    const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`wikis/${slug}/working/`));
    const mirror = canonWikis !== null && doors.sourced?.(slug) === true ? join(canonWikis, slug) : join(projections, "wikis", slug);
    await wave(join(bundle.root, "wikis", slug, "working"), join(bundle.root, "wikis", slug), mirror, wikiSlotUri(slug, "working"), files, `wiki-working:${slug}`, tallies.wikiWorking, tallies.kapae, slug, freshSlugs.has(slug));
  }
  let heldNow: ReadonlySet<string> | undefined;
  // EACH FACE'S PERSONAL LAYER lands at that face's own wear: the vessel grants the personal mirror to the daemon mount's folder
  // alone, so an open face that stands unworn waits by name, and nothing of its margin lands under another face.
  for (const bf of manifest.faces) {
    const personalFiles = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`faces/${bf.key}/personal/`));
    if (personalFiles.length === 0 || unworn.has(bf.key)) continue;
    const face = target.get(bf.key)!;
    if (face.relation !== litRelation) {
      personalWaiting.push({ petname: bf.petname, handleIndex: face.handleIndex });
      tallies.personal.waiting += manifest.rows.filter((r) => r.layer === "personal" && r.face === bf.petname).length;
      continue;
    }
    const slugs = [...new Set(personalFiles.map((p) => p.split("/")[3]!))].sort();
    for (const slug of slugs) {
      const files = personalFiles.filter((p) => p.startsWith(`faces/${bf.key}/personal/${slug}/`));
      // A MARGIN OF A WIKI NO FACE STOOD HERE WAITS FOR THE WIKI, as the lay's does: a share row names another face its owner,
      // and the wiki mints at that owner's wear; until then this face's margin mounts no wiki and lands nowhere.
      const stands = !unminted.has(slug) && (doors.sourced?.(slug) === true || (heldNow ??= await doors.heldSlugs()).has(slug)
        || (freshSlugs.has(slug) && (!apply || journal.done.has(`mint:${slug}`))));
      const gate = stands ? null : await gateOf(slug);
      if (gate?.why === "owner") {
        waitBench(slug, gate);
        personalWaiting.push({ petname: bf.petname, handleIndex: face.handleIndex, wiki: slug, ...(gate.owner !== undefined ? { owner: gate.owner } : {}) });
        tallies.personal.waiting += manifest.rows.filter((r) => r.layer === "personal" && r.face === bf.petname && r.bag === wikiSlotUri(slug, "personal")).length;
        continue;
      }
      await wave(join(bundle.root, "faces", bf.key, "personal", slug), join(bundle.root, "faces", bf.key, "personal"), join(faceRootOf(bf), FACE_PLANES.margins, slug), wikiSlotUri(slug, "personal"), files, `personal:${bf.key}:${slug}`, tallies.personal, null, slug, false);
    }
  }
  // THE SHARES LAND AGAIN: each shared wiki's seats come back by pet-name, once its owner's wear stood it.
  let sharesLanded = false;
  if (apply && allShares.length > 0 && doors.landShares !== undefined) sharesLanded = (await doors.landShares().catch(() => null)) !== null;

  // THE PAIR SEATS LAST: only a whole apply seats the bundle's keep pair where this house rests none, so a restore that refused
  // anywhere above leaves the house's config as it stood.
  if (apply) adoptKeepSeat(seat);
  return { bundleId: manifest.bundleId, applied: apply, faceMap, redeclare: acts, tallies, skipped, minted, waiting, warnings, benchWaiting, personalWaiting, kahuaWaiting, daemonWaiting, shares: { written: carriedShares.map((r) => r.slug), landed: sharesLanded } };
}

// ── the commands' shared refusal ─────────────────────────────────────────────────────────────────────────────

/** Emit a carry refusal by name; anything else rethrows. */
export function bundleRefusal(args: ParsedArgs, verb: string, err: unknown): number {
  if (err instanceof BundleRefused || err instanceof BundleVerifyRefused) {
    const code = err instanceof BundleRefused ? err.code : "carry-bundle-refused";
    emit(args, { ok: false, error: { code, message: err.message }, human: () => console.error(`lares ${verb}: ${err.message}`) });
    return exitFor("usage");
  }
  throw err;
}

