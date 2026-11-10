/**
 * `lares export <dest>` · `lares import <dest>` — the operator's AUTHORED memory carried across a re-founding.
 *
 * A re-founding clears `<root>/hearth` and mints new keys, so the daemon wiki's working layer and each face's kahua
 * stage come up empty under a new face relation F. This pair carries what the operator wrote across that line as
 * CONTENT, never as identity: no key, signature, CRDT history or AID travels, and the import writes NEW changes under
 * the new face's authority. The sensoriums (captured conversation memory, `<root>/sensoriums`) survive by where they
 * stand and never enter a bundle. Control records rest in the vessel control document and never travel in a bundle;
 * the daemon wiki travels through the face's working (`wikis/daemon-<F>`) and canon (`bags/daemon-<F>`) mirrors,
 * and kahua travels through `bags/kahua-<F>`. Observe renders never travel.
 *
 * EXPORT (a vessel that holds a disk store and wears its faces, standing):
 *   1. refuses a dest inside the house root or the workspace, or one that already stands;
 *   2. reads the census (`lares vessel census`): an unsettled carrier, a held save or an unanswered line refuses by name,
 *      unless `--accept-omissions` names the export partial, and then each lands in the manifest's omissions;
 *   3. maps each face folder (`daemon-<F>`, `kahua-<F>`) to the face that wears it, keyed by PET-NAME; a face that holds
 *      memory and no pet-name, or two that share one, refuses;
 *   4. copies face working and canon mirrors, granted draft recovery files, consented temp carriers, kahua stage carriers and the stage's standing heads; every
 *      other wiki's working, draft and consented temp files; house-minted bags (a user wiki's own canon among them); and
 *      lists the acquired library's collections by index digest (the originals survive in place and never travel);
 *   5. writes `manifest.json` and `re-declare.json`, reads every byte back against the manifest, and only then moves
 *      the bundle into place.
 *
 * IMPORT (previews by default; `--apply` writes):
 *   1. verifies the whole bundle before touching anything (`verifyBundle`);
 *   2. replays the re-declare list as fresh acts (pet-name, Handle, seat and chair) where the vessel's face holds none;
 *   3. maps each bundle face's pet-name to the ONE face on this vessel that carries it, refusing by name where none or
 *      two do (never a silent merge into another face's memory);
 *   4. re-pours working rows into the new face's daemon wiki through the ingest gesture (unattended, so a diverged id
 *      stands off through the Confluence gate and never overwrites), raising each kāpae a shadow speaks;
 *   5. re-lifts each kahua head under the new face's grant, keyed by title + body digest (a title already holding that
 *      digest reads landed, a title holding a body the bundle never carried stands off);
 *   6. lands draft and temp files back where none stands (a different file there stands off); re-pours the daemon canon
 *      into `bags/daemon-<F>`, each house-minted bag into its bag and each other wiki's working rows into its working layer
 *      through the same gesture, minting first (CREATE) any slug this vessel does not hold, named in the preview.
 *   A journal under `<root>/config/carry-journal/<bundle-id>.ndjson` records each landed act: an interrupted import
 *   re-enters to the same end, and a second import of the same bundle lands nothing.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { wikiBagUri, wikiSlotUri, daemonFaceCanonBag, KAHUA_BAG, defaultChairLabel, declarePersonaHandle, renameOwnPersona, standForKahuSeat } from "@lararium/mesh";
import {
  larHouseRoot, larProjectionsHome, larConfigHome, mirrorDirFileToUri, SyncedTree, TEMP_LAYER_DIR,
  KAPAE_EXT, readKapaeShadow, daemonFaceFolder, isDaemonFaceFolder, isKahuaFaceFolder, isPrivateProjectionSlug, loadLaresConfig, tempConsentedSlugs,
  listCollections, libraryCollectionDir, atomicWriteFileSync,
} from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { emit, exitFor } from "../render.js";
import { readCensus, censusLine, type CensusReading } from "./census.js";
import { scanFiles, candidatesOf, settleIngest, type ScanRow } from "../ingest-core.js";
import { summaryOutput } from "../verb-result.js";
import { vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { newChangeId, newRequestId, taskContentId } from "@lararium/mesh";
import { storeVerb } from "../store-door.js";
import { readPersonaRoots, sealedPetnameStore, sealedDeclarationStore } from "../sealed-rows.js";
import { makeFleetPetnameStore, makeFleetDeclarationStore } from "../daemon-persona-store.js";
import {
  CARRY_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, KAHUA_HEADS_FILE, bundleIdOf, sha256Hex, zeroCounts, verifyBundle, CarryBundleRefused,
  type CarryFace, type CarryFile, type CarryKahuaHead, type CarryManifest, type CarryOmission, type CarryRedeclare,
  type CarryRedeclareFace, type CarryRow, type VerifiedBundle,
} from "../carry-manifest.js";


/** One face this vessel wears, as the doors read it. */
export interface CarryVesselFace {
  readonly handleIndex: number;
  readonly petname: string | null;
  /** The face relation F its private folders carry, read off its verified log; null where the log pins none. */
  readonly relation: string | null;
  readonly handle: string | null;
  readonly seat: boolean;
  readonly chair: string | null;
  /** The stage's standing heads, or null where the stage would not read (`kahuaRefusal` says why). */
  readonly kahua: readonly CarryKahuaHead[] | null;
  readonly kahuaRefusal?: string;
}

/** What one ingest wave settled, as the carry verbs read it. */
export interface CarryIngestAnswer {
  readonly landed: readonly string[];
  readonly conflicts: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly refused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
  readonly unanswered: readonly string[];
  readonly kapaeRaised: readonly string[];
  readonly kapaeRefused: ReadonlyArray<{ readonly uri: string; readonly why: string }>;
}

/** The doors the two verbs reach a vessel through, injectable so a test drives them with no vessel standing. */
export interface CarryDoors {
  readonly census: () => Promise<CensusReading>;
  readonly faces: () => Promise<CarryVesselFace[]>;
  readonly tempConsented: () => readonly string[];
  readonly rename: (handleIndex: number, petname: string) => Promise<void>;
  readonly declareHandle: (handleIndex: number, handle: string) => Promise<void>;
  readonly standSeat: (handleIndex: number, chair: string | null) => Promise<void>;
  readonly ingest: (wave: { readonly source: string; readonly toBag: string; readonly candidates: readonly ScanRow[]; readonly kapae: readonly string[]; readonly inWiki?: boolean; readonly wiki?: string }) => Promise<CarryIngestAnswer>;
  /** The wiki slugs this vessel's catalog registers. */
  readonly heldSlugs: () => Promise<ReadonlySet<string>>;
  /** Mint a bag (and the wiki it opens as) through the existing CREATE road. */
  readonly mintBag: (bagUri: string) => Promise<void>;
  readonly kahuaLift: (handleIndex: number, lift: { readonly title: string; readonly text: string; readonly fields: Readonly<Record<string, string>>; readonly taint: readonly string[]; readonly sources: CarryKahuaHead["sources"]; readonly parent: string | null }) => Promise<{ readonly cid: string }>;
}

// ── the live doors ─────────────────────────────────────────────────────────────────────────────────────────────

function fleetStores() {
  return { petnames: makeFleetPetnameStore(sealedPetnameStore()), declarations: makeFleetDeclarationStore(sealedDeclarationStore()) };
}

async function liveFaces(): Promise<CarryVesselFace[]> {
  const { petnames, declarations } = fleetStores();
  const out: CarryVesselFace[] = [];
  for (const { handleIndex } of (await readPersonaRoots()).roots) {
    const declaration = await declarations.get(handleIndex);
    let kahua: CarryKahuaHead[] | null = null, relation: string | null = null, kahuaRefusal: string | undefined;
    try {
      const { output } = await storeVerb("kahua-read", { face: handleIndex, action: "list" });
      relation = typeof output["relation"] === "string" ? output["relation"] : null;
      const items = Array.isArray(output["items"]) ? (output["items"] as Array<{ heads?: unknown }>) : [];
      kahua = items.flatMap((item) => (Array.isArray(item.heads) ? item.heads as CarryKahuaHead[] : []))
        .map((h) => ({ title: h.title, cid: h.cid, text: h.text, fields: { ...h.fields }, taint: [...h.taint], sources: h.sources.map((s) => ({ title: s.title, revision: s.revision })) }));
    } catch (e) { kahuaRefusal = e instanceof Error ? e.message : String(e); }
    out.push({
      handleIndex, petname: (await petnames.get(handleIndex)) ?? null, relation,
      handle: declaration?.handle ?? null, seat: declaration?.seat === true,
      chair: declaration?.seat === true ? declaration.chair?.trim() || defaultChairLabel(handleIndex) : null,
      kahua, ...(kahuaRefusal !== undefined ? { kahuaRefusal } : {}),
    });
  }
  return out;
}

export const LIVE_CARRY_DOORS: CarryDoors = {
  census: () => readCensus(),
  faces: liveFaces,
  tempConsented: () => tempConsentedSlugs(loadLaresConfig()),
  rename: async (i, petname) => renameOwnPersona(fleetStores().petnames, i, petname),
  declareHandle: async (i, handle) => declarePersonaHandle(fleetStores().declarations, i, handle),
  standSeat: async (i, chair) => standForKahuSeat(fleetStores().declarations, i, true, chair ?? undefined),
  ingest: async (wave) => {
    // A tree held in memory: the gesture pins no base at a bundle path, and the projector pins its own where it writes.
    const settled = await settleIngest({ source: wave.source, toBag: wave.toBag, candidates: wave.candidates, did: await vesselDid(), unattended: true,
      ...(wave.inWiki === true ? { inWiki: true } : {}), ...(wave.wiki !== undefined ? { wiki: wave.wiki } : {}),
      ...(wave.kapae.length > 0 ? { kapae: wave.kapae } : {}) }, new SyncedTree(null));
    if (settled.first.status === "error") throw new Error(settled.first.errorMessage ?? "INGEST refused");
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
  mintBag: async (bagUri) => {
    // The CREATE road `lares act CREATE --bag` walks (`act.ts`): the catalog plane, a fresh change nonce in the effect key.
    const actionArgs = { bag: bagUri, plane: "catalog" };
    const effectKey = await taskContentId({ subject: bagUri, command: "CREATE", args: actionArgs, nonce: newChangeId() });
    const r = await runVerb("CREATE", actionArgs, await vesselDid(), { requestId: newRequestId(), effectKey });
    if (r.status === "error") throw new Error(r.errorMessage ?? `CREATE ${bagUri} refused`);
  },
  kahuaLift: async (face, lift) => {
    const { output } = await storeVerb("kahua-lift", { face, title: lift.title, text: lift.text, fields: lift.fields, taint: lift.taint, sources: lift.sources, parent: lift.parent });
    if (typeof output["cid"] !== "string") throw new Error(`kahua-lift answered no cid for ${lift.title}`);
    return { cid: output["cid"] };
  },
};

// ── shared ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** A refusal the verbs raise by name; the message carries the cure. */
export class CarryRefused extends Error {
  override readonly name = "CarryRefused";
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

/** Every plain file under `dir` (posix rel paths, sorted), each link or special file named apart; an absent dir reads empty. */
function plainFiles(dir: string): { files: string[]; odd: string[] } {
  const files: string[] = [], odd: string[] = [];
  const visit = (abs: string, rel: string): void => {
    let names: string[];
    try { names = readdirSync(abs).sort(); } catch { return; }
    for (const name of names) {
      const a = join(abs, name), r = rel === "" ? name : `${rel}/${name}`;
      const st = lstatSync(a);
      if (st.isDirectory()) visit(a, r);
      else if (st.isFile()) files.push(r);
      else odd.push(r);
    }
  };
  visit(dir, "");
  return { files, odd };
}

const isStray = (rel: string): boolean => rel.includes(".lar-tmp-");

// ── export ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** What an export wrote. */
export interface CarryExportResult { readonly dest: string; readonly manifest: CarryManifest }

/**
 * Write a bundle at `dest`. Throws {@link CarryRefused} naming what stays unsettled, unclaimed or unkeyed; with
 * `acceptOmissions` an unsettled census and an unclaimed folder land in the manifest's omissions instead.
 */
export async function carryExport(dest: string, opts: { readonly acceptOmissions: boolean; readonly doors: CarryDoors }): Promise<CarryExportResult> {
  const { doors, acceptOmissions } = opts;
  const target = resolve(dest);
  const house = larHouseRoot();
  if (inside(house, target)) throw new CarryRefused("carry-dest-inside-house", `${target} stands inside the house root ${resolve(house)}; a bundle carries memory across a re-founding, so it rests outside the house`);
  if (inside(repoRoot, target)) throw new CarryRefused("carry-dest-inside-workspace", `${target} stands inside the workspace ${repoRoot}; a bundle holds private memory and never rests in a tracked tree`);
  if (existsSync(target)) throw new CarryRefused("carry-dest-stands", `${target} already stands; name a fresh path, and the export never writes over one`);
  const omissions: CarryOmission[] = [];

  // A SETTLED PROJECTION FIRST: what the census names would leave out of the copy.
  const census = await doors.census();
  if (!census.clean) {
    const lines = [...census.items.map(censusLine), ...census.unanswered.map((u) => `unanswered  ${u.part}: ${u.why}`)];
    if (!acceptOmissions) throw new CarryRefused("carry-unsettled", `the census names ${lines.length} item(s) the projection has not settled, so a copy now would leave them out:\n  ${lines.join("\n  ")}\nsettle them (unlock the vault, let the projector drain) and export again, or pass --accept-omissions for an explicitly partial bundle`);
    const held = census.items.filter((i) => i.kind === "held-save").map(censusLine);
    const carriers = census.items.filter((i) => i.kind === "carrier").map(censusLine);
    if (held.length > 0) omissions.push({ kind: "held-saves", detail: "saves the sealed rest holds in memory, never on disk", items: held, count: held.length });
    if (carriers.length > 0) omissions.push({ kind: "unsettled-carriers", detail: "carriers the disk projector had not settled", items: carriers, count: carriers.length });
    if (census.unanswered.length > 0) omissions.push({ kind: "census-unanswered", detail: "census lines that could not answer", items: census.unanswered.map((u) => `${u.part}: ${u.why}`) });
  }

  const faces = await doors.faces();
  const byRelation = new Map<string, CarryVesselFace>();
  for (const f of faces) if (f.relation !== null) byRelation.set(f.relation, f);
  const projections = larProjectionsHome();
  const wikisDir = join(projections, "wikis"), bagsDir = join(projections, "bags");
  const folders = (dir: string): string[] => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch { return []; } };
  const faceFolderOf = (name: string): CarryVesselFace | null => {
    const relation = isDaemonFaceFolder(name) ? name.slice("daemon-".length) : isKahuaFaceFolder(name) ? name.slice("kahua-".length) : null;
    return relation === null ? null : byRelation.get(relation) ?? null;
  };
  let unclaimed = 0;
  for (const name of [...folders(wikisDir).filter(isDaemonFaceFolder), ...folders(bagsDir).filter((name) => isKahuaFaceFolder(name) || isDaemonFaceFolder(name))]) if (faceFolderOf(name) === null) unclaimed++;
  if (unclaimed > 0) {
    if (!acceptOmissions) throw new CarryRefused("carry-unclaimed-face-folder", `${unclaimed} face folder(s) under ${projections} belong to no face this vessel wears (unlock every face, or export with --accept-omissions to leave them behind)`);
    omissions.push({ kind: "unclaimed-face-folders", detail: "face folders no face this vessel wears claims; they stay under the projections root", count: unclaimed });
  }

  // THE FACES KEY BY PET-NAME. A face that carries memory needs one, and no two may share it.
  const carries = (f: CarryVesselFace): boolean => f.relation !== null && (existsSync(join(wikisDir, daemonFaceFolder(f.relation))) || existsSync(join(bagsDir, `kahua-${f.relation}`)) || existsSync(join(bagsDir, daemonFaceFolder(f.relation))) || (f.kahua?.length ?? 0) > 0);
  for (const f of faces) {
    if (carries(f) && (f.petname === null || f.petname.trim() === "")) throw new CarryRefused("carry-face-unnamed", `the face at h${f.handleIndex} carries memory and no pet-name, and a bundle keys each face by its pet-name: name it (\`lares persona new ${f.handleIndex} --name '<label>'\`) and export again`);
    if (f.kahuaRefusal !== undefined && f.relation === null && !acceptOmissions) throw new CarryRefused("carry-face-unread", `the face at h${f.handleIndex} would not read its stage or relation (${f.kahuaRefusal}); unlock it, or export with --accept-omissions to leave its memory behind`);
    if (f.kahuaRefusal !== undefined) omissions.push({ kind: "face-unread", detail: `the face at h${f.handleIndex} would not read its stage: ${f.kahuaRefusal}` });
  }
  const named = faces.filter((f) => f.petname !== null && f.petname.trim() !== "").sort((a, b) => a.handleIndex - b.handleIndex);
  const seenNames = new Map<string, number>();
  for (const f of named) {
    const prior = seenNames.get(f.petname!);
    if (prior !== undefined) throw new CarryRefused("carry-face-duplicate-petname", `the faces at h${prior} and h${f.handleIndex} both carry the pet-name "${f.petname}", and a bundle keys each face by its pet-name alone: rename one and export again`);
    seenNames.set(f.petname!, f.handleIndex);
  }
  const bundleFaces: CarryFace[] = named.map((f, i) => ({ key: `f${i}`, petname: f.petname! }));
  const keyOf = new Map(named.map((f, i) => [f.handleIndex, `f${i}`] as const));

  // THE COPY PLAN: source abs path -> bundle rel path, with the row each file makes.
  const plan: Array<{ from: string; to: string; row: Omit<CarryRow, "sha256" | "path"> | null }> = [];
  const tempBytes: Record<string, number> = {};
  const consented = new Set(doors.tempConsented());
  let strays = 0, odd = 0;
  const addTree = (srcDir: string, toDir: string, rowOf: (rel: string, abs: string) => Omit<CarryRow, "sha256" | "path"> | null, skipTop: readonly string[] = []): void => {
    const listed = plainFiles(srcDir);
    odd += listed.odd.length;
    for (const rel of listed.files) {
      if (skipTop.includes(rel.split("/")[0]!)) continue;
      if (isStray(rel)) { strays++; continue; }
      const abs = join(srcDir, ...rel.split("/"));
      plan.push({ from: abs, to: `${toDir}/${rel}`, row: rowOf(rel, abs) });
    }
  };
  for (const name of folders(wikisDir)) {
    const src = join(wikisDir, name);
    const face = faceFolderOf(name);
    if (isDaemonFaceFolder(name)) {
      if (face === null) continue;
      const fk = keyOf.get(face.handleIndex)!, pet = face.petname!;
      addTree(src, `faces/${fk}/working`, (rel, abs) => {
        if (rel.endsWith(KAPAE_EXT)) {
          const read = readKapaeShadow(readFileSync(abs, "utf8"));
          return { face: pet, bag: wikiSlotUri("daemon", "working"), layer: "kapae", title: "title" in read ? read.title : null, rowKey: null };
        }
        return { face: pet, bag: wikiSlotUri("daemon", "working"), layer: "working", title: mirrorDirFileToUri(wikisDir, abs), rowKey: null };
      }, [TEMP_LAYER_DIR, "recovery"]);
      addTree(join(src, "recovery"), `faces/${fk}/drafts`, () => ({ face: pet, bag: wikiSlotUri("daemon", "draft"), layer: "draft", title: null, rowKey: null }));
      if (consented.has("daemon")) {
        addTree(join(src, TEMP_LAYER_DIR), `faces/${fk}/temp`, (_rel, abs) => {
          const bag = wikiSlotUri("daemon", "temp");
          tempBytes[bag] = (tempBytes[bag] ?? 0) + lstatSync(abs).size;
          return { face: pet, bag, layer: "temp", title: null, rowKey: null };
        });
      } else if (existsSync(join(src, TEMP_LAYER_DIR))) omissions.push({ kind: "temp-unconsented", detail: `the daemon wiki's temp folder stands with no consent row (projection.temp.daemon); it stays behind` });
      continue;
    }
    if (isPrivateProjectionSlug(name)) continue;
    addTree(join(src, "recovery"), `wikis/${name}/drafts`, () => ({ face: null, bag: wikiSlotUri(name, "draft"), layer: "draft", title: null, rowKey: null }));
    if (consented.has(name)) {
      addTree(join(src, TEMP_LAYER_DIR), `wikis/${name}/temp`, (_rel, abs) => {
        const bag = wikiSlotUri(name, "temp");
        tempBytes[bag] = (tempBytes[bag] ?? 0) + lstatSync(abs).size;
        return { face: null, bag, layer: "temp", title: null, rowKey: null };
      });
    }
    addTree(src, `wikis/${name}/working`, (_rel, abs) => ({ face: null, bag: wikiSlotUri(name, "working"), layer: "wiki-working", title: mirrorDirFileToUri(wikisDir, abs), rowKey: null }), ["recovery", TEMP_LAYER_DIR]);
  }
  for (const name of folders(bagsDir)) {
    const src = join(bagsDir, name);
    if (isDaemonFaceFolder(name)) {
      const face = faceFolderOf(name);
      if (face === null) continue;
      const fk = keyOf.get(face.handleIndex)!;
      addTree(src, `faces/${fk}/canon`, (_rel, abs) => ({ face: face.petname!, bag: daemonFaceCanonBag(face.relation!), layer: "daemon-canon", title: mirrorDirFileToUri(bagsDir, abs), rowKey: null }));
      continue;
    }
    if (isKahuaFaceFolder(name)) {
      const face = faceFolderOf(name);
      if (face === null) continue;
      const fk = keyOf.get(face.handleIndex)!;
      addTree(src, `faces/${fk}/kahua`, () => ({ face: face.petname!, bag: KAHUA_BAG, layer: "kahua-carrier", title: null, rowKey: null }));
      continue;
    }
    if (name === "daemon") {
      // This directory has no disk mirror grant, so its files stay out of the carry bundle.
      continue;
    }
    if (isPrivateProjectionSlug(name)) continue;
    addTree(src, `bags/${name}`, (_rel, abs) => ({ face: null, bag: wikiBagUri(name), layer: "bag", title: mirrorDirFileToUri(bagsDir, abs), rowKey: null }));
  }
  if (strays > 0) omissions.push({ kind: "atomic-write-strays", detail: "orphan *.lar-tmp-* files an atomic write left; none carries a record", count: strays });
  if (odd > 0) omissions.push({ kind: "links-or-special-files", detail: "entries under the projections root that stand as neither a plain file nor a directory", count: odd });
  omissions.push({ kind: "parallel-drafts", detail: "another place's unmerged drafts rest in its draft floor doc (wikis/<slug>/drafts/<did>) and project nowhere; no door names them yet, so none travels" });

  // WRITE BESIDE THE DEST, VERIFY, THEN MOVE INTO PLACE.
  const staging = join(dirname(target), `.${basename(target)}.lar-tmp-${randomBytes(6).toString("hex")}`);
  mkdirSync(staging, { recursive: true });
  try {
    const files: CarryFile[] = [];
    const rows: CarryRow[] = [];
    const counts = zeroCounts();
    const put = (rel: string, bytes: Buffer | string): CarryFile => {
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
      for (const h of heads) { rows.push({ face: f.petname, bag: KAHUA_BAG, layer: "kahua-head", title: h.title, rowKey: h.cid, sha256: sha256Hex(h.text), path: file.path }); counts["kahua-head"]++; }
    }
    const redeclare: CarryRedeclare = {
      schema: CARRY_SCHEMA,
      faces: named.map((f): CarryRedeclareFace => ({ face: keyOf.get(f.handleIndex)!, handleIndex: f.handleIndex, petname: f.petname!, handle: f.handle, seat: f.seat, chair: f.seat ? f.chair : null })),
    };
    put(REDECLARE_FILE, `${JSON.stringify(redeclare, null, 2)}\n`);
    files.sort((a, b) => (a.path < b.path ? -1 : 1));
    const manifest: CarryManifest = { schema: CARRY_SCHEMA, bundleId: bundleIdOf(files), faces: bundleFaces, files, rows, counts, tempBytes, omissions, library: libraryListing() };
    writeFileSync(join(staging, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    verifyBundle(staging);      // every byte read back against the manifest before the bundle takes its name
    renameSync(staging, target);
    return { dest: target, manifest };
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


// ── import ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** `<root>/config/carry-journal/<bundle-id>.ndjson`. The config class survives a restart (the run class stands in tmpfs
 *  inside the container, and an interrupted import must find its journal again) and never sits in the hearth. */
export function carryJournalPath(bundleId: string): string {
  return join(larConfigHome(), "carry-journal", `${bundleId}.ndjson`);
}

interface Journal { readonly done: Map<string, string>; mark(key: string, value: string): void }

function openJournal(bundleId: string, write: boolean): Journal {
  const path = carryJournalPath(bundleId);
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

/** One class's outcome. */
export interface CarryTally { landed: number; already: number; stoodOff: string[]; refused: string[]; planned: number }
const tally = (): CarryTally => ({ landed: 0, already: 0, stoodOff: [], refused: [], planned: 0 });

export interface CarryImportResult {
  readonly bundleId: string;
  readonly applied: boolean;
  /** Bundle face pet-name -> the handle index it lands on. */
  readonly faceMap: Readonly<Record<string, number>>;
  readonly redeclare: readonly string[];
  readonly tallies: Readonly<Record<"working" | "kapae" | "faceCanon" | "kahua" | "draft" | "temp" | "bag" | "wikiWorking", CarryTally>>;
  /** The bags (and the wikis they open as) this import mints, or would mint in a preview, before it re-pours them. */
  readonly minted: readonly string[];
  readonly skipped: readonly string[];
}

/**
 * Import the bundle at `src`. The bundle verifies whole before anything moves; preview (`apply` false) reads the vessel
 * and plans every act, and writes nothing. Throws {@link CarryRefused} (or {@link CarryBundleRefused}) by name.
 */
export async function carryImport(src: string, opts: { readonly apply: boolean; readonly doors: CarryDoors }): Promise<CarryImportResult> {
  const { doors, apply } = opts;
  const bundle: VerifiedBundle = verifyBundle(resolve(src));
  const { manifest, redeclare } = bundle;
  const journal = openJournal(manifest.bundleId, apply);
  const projections = larProjectionsHome();
  let faces = await doors.faces();

  // RE-DECLARE FIRST: each bundle face finds the ONE face here that carries its pet-name, or names one by its index.
  const acts: string[] = [];
  const planned: Array<{ row: CarryRedeclareFace; handleIndex: number; rename: boolean; handle: boolean; seat: boolean }> = [];
  for (const row of redeclare.faces) {
    const matches = faces.filter((f) => f.petname === row.petname);
    if (matches.length > 1) throw new CarryRefused("carry-face-duplicate-petname", `faces ${matches.map((m) => `h${m.handleIndex}`).join(" and ")} on this vessel both carry the pet-name "${row.petname}"; the bundle's memory for it lands on one face alone, so rename one and import again`);
    let target = matches[0];
    let rename = false;
    if (target === undefined) {
      const at = faces.find((f) => f.handleIndex === row.handleIndex);
      if (at === undefined) throw new CarryRefused("carry-face-unmatched", `no face on this vessel carries the pet-name "${row.petname}", and none stands at h${row.handleIndex} to carry it: found it (\`lares persona new ${row.handleIndex} --name '${row.petname}'\`) and import again`);
      if (at.petname !== null) throw new CarryRefused("carry-face-unmatched", `no face on this vessel carries the pet-name "${row.petname}", and the face at h${row.handleIndex} carries "${at.petname}"; the bundle never merges one face's memory into another's: name the face that should carry "${row.petname}" and import again`);
      target = at;
      rename = true;
    }
    if (row.handle !== null && target.handle !== null && target.handle !== row.handle) throw new CarryRefused("carry-redeclare-diverged", `the face "${row.petname}" declares the Handle "${target.handle}" here and "${row.handle}" in the bundle; the import never overwrites a declaration`);
    if (row.seat && target.seat && row.chair !== null && target.chair !== null && target.chair !== row.chair) throw new CarryRefused("carry-redeclare-diverged", `the face "${row.petname}" stands for the chair "${target.chair}" here and "${row.chair}" in the bundle; the import never overwrites a declaration`);
    planned.push({ row, handleIndex: target.handleIndex, rename, handle: row.handle !== null && target.handle === null, seat: row.seat && !target.seat });
  }
  for (const p of planned) {
    if (p.rename) acts.push(`h${p.handleIndex}: pet-name "${p.row.petname}"`);
    if (p.handle) acts.push(`h${p.handleIndex}: Handle "${p.row.handle}"`);
    if (p.seat) acts.push(`h${p.handleIndex}: stands for the chair "${p.row.chair ?? defaultChairLabel(p.handleIndex)}"`);
  }
  if (apply) {
    for (const p of planned) {
      const key = `redeclare:${p.row.face}`;
      if (p.rename) await doors.rename(p.handleIndex, p.row.petname);
      if (p.handle) await doors.declareHandle(p.handleIndex, p.row.handle!);
      if (p.seat) await doors.standSeat(p.handleIndex, p.row.chair);
      journal.mark(key, `h${p.handleIndex}`);
    }
    if (planned.some((p) => p.rename || p.handle || p.seat)) faces = await doors.faces();
  }

  // THE FACE MAP: pet-name -> the face here, which must wear a relation for its folders.
  const faceMap: Record<string, number> = {};
  const target = new Map<string, CarryVesselFace>();
  for (const bf of manifest.faces) {
    const p = planned.find((x) => x.row.face === bf.key)!;
    const face = faces.find((f) => f.handleIndex === p.handleIndex)!;
    if (face.relation === null) throw new CarryRefused("carry-face-unworn", `the face h${face.handleIndex} ("${bf.petname}") pins no face relation, so its daemon wiki has no folder to land in: stand the vessel wearing it and import again${face.kahuaRefusal ? ` (${face.kahuaRefusal})` : ""}`);
    faceMap[bf.petname] = face.handleIndex;
    target.set(bf.key, face);
  }

  const tallies = { working: tally(), kapae: tally(), faceCanon: tally(), kahua: tally(), draft: tally(), temp: tally(), bag: tally(), wikiWorking: tally() };
  const minted: string[] = [];
  const skipped: string[] = [];

  // An import restores each file into its mirror, then ingest reads it there so the placement ward sees the bag's own mirror.
  const wave = async (sourceDir: string, uriDir: string, mirrorDir: string, toBag: string, files: readonly string[], keyPrefix: string, workTally: CarryTally, kapaeTally: CarryTally | null, wiki: string | null = null): Promise<void> => {
    if (files.length === 0) return;
    const scan = scanFiles(bundle.root, files.map((f) => join(bundle.root, ...f.split("/"))), toBag, new SyncedTree(null), (_r, file) => mirrorDirFileToUri(uriDir, file));
    for (const s of scan.skipped) if (!s.endsWith(".meta")) skipped.push(s);
    for (const r of scan.refusedShadows ?? []) kapaeTally?.refused.push(`${r.file} (${r.refusal})`);
    const keyed = (r: ScanRow): string => `${keyPrefix}:${r.uri}:${r.diskHash}`;
    let candidates = candidatesOf(scan.rows).filter((r) => { if (journal.done.has(keyed(r))) { workTally.already++; return false; } return true; });
    for (const r of scan.rows) if (r.status === "non-nfc") workTally.refused.push(`${r.uri} (non-NFC bytes)`);
    const shadowTally = kapaeTally ?? workTally;
    let kapae = (scan.shadows ?? []).filter((t) => { if (journal.done.has(`${keyPrefix}:kapae:${t}`)) { shadowTally.already++; return false; } return true; });
    workTally.planned += candidates.length;
    shadowTally.planned += kapae.length;
    if (!apply || (candidates.length === 0 && kapae.length === 0)) return;
    const wanted = new Set([...candidates.map((r) => r.uri), ...kapae]);
    const blocked = new Set<string>();
    const pending: Array<{ uri: string; to: string; bytes: Buffer }> = [];
    for (const f of files) {
      const from = join(bundle.root, ...f.split("/"));
      const uri = mirrorDirFileToUri(uriDir, from.endsWith(".meta") ? from.slice(0, -5) : from);
      if (!uri || !wanted.has(uri)) continue;
      const to = join(mirrorDir, relative(sourceDir, from));
      const bytes = readFileSync(from);
      if (existsSync(to)) {
        if (!readFileSync(to).equals(bytes)) blocked.add(uri);
      } else pending.push({ uri, to, bytes });
    }
    for (const uri of blocked) workTally.stoodOff.push(`${uri} (a different file stands in the mirror; left as it stands)`);
    for (const { uri, to, bytes } of pending) {
      if (blocked.has(uri)) continue;
      mkdirSync(dirname(to), { recursive: true });
      atomicWriteFileSync(to, bytes, undefined, { mode: 0o600 });
    }
    candidates = candidates.filter((r) => !blocked.has(r.uri));
    kapae = kapae.filter((uri) => !blocked.has(uri));
    if (candidates.length === 0 && kapae.length === 0) return;
    const answer = await doors.ingest({ source: mirrorDir, toBag, candidates, kapae, ...(wiki !== null ? { inWiki: true, wiki } : {}) });
    const landed = new Set(answer.landed);
    for (const r of candidates) if (landed.has(r.uri)) { workTally.landed++; journal.mark(keyed(r), "landed"); }
    for (const c of answer.conflicts) workTally.stoodOff.push(`${c.uri} (${c.why})`);
    for (const c of answer.refused) workTally.refused.push(`${c.uri} (${c.why})`);
    for (const u of answer.unanswered) workTally.refused.push(`${u} (no answer; import again)`);
    for (const t of answer.kapaeRaised) { shadowTally.landed++; journal.mark(`${keyPrefix}:kapae:${t}`, "raised"); }
    for (const k of answer.kapaeRefused) shadowTally.refused.push(`${k.uri} (${k.why})`);
  };
  for (const bf of manifest.faces) {
    const relation = target.get(bf.key)!.relation!;
    for (const kind of ["working", "canon"] as const) {
      const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`faces/${bf.key}/${kind}/`));
      const mirror = join(projections, kind === "working" ? "wikis" : "bags", daemonFaceFolder(relation));
      await wave(join(bundle.root, "faces", bf.key, kind), join(bundle.root, "faces", bf.key), mirror,
        kind === "working" ? wikiSlotUri("daemon", "working") : daemonFaceCanonBag(relation), files,
        `${kind}:${bf.key}`, kind === "working" ? tallies.working : tallies.faceCanon, kind === "working" ? tallies.kapae : null);
    }
  }

  // KAHUA HEADS: re-lifted under the new face's grant, keyed by title + body digest.
  for (const bf of manifest.faces) {
    const face = target.get(bf.key)!;
    const heads = bundle.heads.get(bf.key) ?? [];
    if (heads.length === 0) continue;
    if (face.kahua === null) { tallies.kahua.refused.push(`the stage of h${face.handleIndex} would not read (${face.kahuaRefusal ?? "unread"}); ${heads.length} head(s) wait`); continue; }
    const byTitle = new Map<string, CarryKahuaHead[]>();
    for (const h of heads) byTitle.set(h.title, [...(byTitle.get(h.title) ?? []), h]);
    for (const [title, bundleHeads] of byTitle) {
      const bundleDigests = new Set(bundleHeads.map((h) => sha256Hex(h.text)));
      const standing = face.kahua.filter((h) => h.title === title);
      const foreign = standing.filter((h) => !bundleDigests.has(sha256Hex(h.text)));
      if (foreign.length > 0) { tallies.kahua.stoodOff.push(`${title} (the stage here holds a body the bundle never carried; lift by hand to settle it)`); continue; }
      const here = new Set(standing.map((h) => sha256Hex(h.text)));
      for (const h of bundleHeads) {
        const digest = sha256Hex(h.text), key = `kahua:${bf.key}:${title}:${digest}`;
        if (here.has(digest) || journal.done.has(key)) { tallies.kahua.already++; continue; }
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
  }

  // DRAFTS AND TEMP: files land back beside the new face's working folder, where none stands.
  const consented = new Set(doors.tempConsented());
  const place = (from: string, to: string, sha: string, t: CarryTally): void => {
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
  for (const f of manifest.files) {
    const m = /^faces\/(f[0-9]+)\/(drafts|temp)\/(.+)$/.exec(f.path) ?? /^wikis\/([^/]+)\/(drafts|temp)\/(.+)$/.exec(f.path);
    if (!m) continue;
    const [, owner, kind, rest] = m as unknown as [string, string, "drafts" | "temp", string];
    const isFace = f.path.startsWith("faces/");
    const folder = isFace ? daemonFaceFolder(target.get(owner)!.relation!) : owner;
    const slug = isFace ? "daemon" : owner;
    const t = kind === "drafts" ? tallies.draft : tallies.temp;
    if (kind === "temp" && !consented.has(slug)) { t.stoodOff.push(`${f.path} (no consent row names projection.temp.${slug} on this vessel)`); continue; }
    const to = join(projections, "wikis", folder, kind === "drafts" ? "recovery" : TEMP_LAYER_DIR, ...rest.split("/"));
    place(join(bundle.root, ...f.path.split("/")), to, f.sha256, t);
  }

  // EVERY OTHER WIKI AND HOUSE-MINTED BAG, by slug: a slug this vessel does not hold mints first, through CREATE.
  const slugsOf = (re: RegExp): string[] => [...new Set(manifest.files.map((f) => re.exec(f.path)?.[1]).filter((s): s is string => s !== undefined))].sort();
  const bagSlugs = slugsOf(/^bags\/([^/]+)\//), wikiSlugs = slugsOf(/^wikis\/([^/]+)\/working\//);
  if (bagSlugs.length + wikiSlugs.length > 0) {
    const held = await doors.heldSlugs();
    for (const slug of [...new Set([...bagSlugs, ...wikiSlugs])].sort()) {
      if (held.has(slug)) continue;
      minted.push(wikiBagUri(slug));
      if (!apply || journal.done.has(`mint:${slug}`)) continue;
      try { await doors.mintBag(wikiBagUri(slug)); journal.mark(`mint:${slug}`, "minted"); }
      catch (e) { tallies.bag.refused.push(`${wikiBagUri(slug)} (mint refused: ${e instanceof Error ? e.message : String(e)})`); }
    }
  }
  for (const slug of bagSlugs) {
    const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`bags/${slug}/`));
    await wave(join(bundle.root, "bags", slug), join(bundle.root, "bags"), join(projections, "bags", slug), wikiBagUri(slug), files, `bag:${slug}`, tallies.bag, null);
  }
  for (const slug of wikiSlugs) {
    const files = manifest.files.map((f) => f.path).filter((p) => p.startsWith(`wikis/${slug}/working/`));
    await wave(join(bundle.root, "wikis", slug, "working"), join(bundle.root, "wikis", slug), join(projections, "wikis", slug), wikiSlotUri(slug, "working"), files, `wiki-working:${slug}`, tallies.wikiWorking, tallies.kapae, slug);
  }

  return { bundleId: manifest.bundleId, applied: apply, faceMap, redeclare: acts, tallies, skipped, minted };
}

// ── the commands' shared refusal ─────────────────────────────────────────────────────────────────────────────

/** Emit a carry refusal by name; anything else rethrows. */
export function carryRefusal(args: ParsedArgs, verb: string, err: unknown): number {
  if (err instanceof CarryRefused || err instanceof CarryBundleRefused) {
    const code = err instanceof CarryRefused ? err.code : "carry-bundle-refused";
    emit(args, { ok: false, error: { code, message: err.message }, human: () => console.error(`lares ${verb}: ${err.message}`) });
    return exitFor("usage");
  }
  throw err;
}

