/**
 * realm-labels — the PET NAME a realm wears on this house, and which canon realms and domain bags it holds (operator ruling
 * 2026-11-19: "The filepath for realms should include their 'pet-name' to match faces."), and the label decides where the realm's
 * folders rest: `<projections>/realms/<pet>/` (`realmRoot`, `bag-paths.ts`).
 *
 * EVERY REALM CARRIES A PET NAME, so nothing waits and no plaintext mirror goes dark. A realm minted with no name takes its
 * wiki's slug (`ensureRealmLabel`: canon stands each wiki as its own realm, so the folder reads `realms/<slug>/wikis/<slug>/`),
 * and a vessel mints that label on first read for every realm standing with none. Naming stays the operator's act and never
 * gates flow: `lares realm rename <current> --to <new>` renames, `lares realm move <slug> --to <pet>` regroups, and the folders move
 * at a quiet point (`settleRealmMoves`), never half-moved.
 *
 * THE RECORD. `<projections>/realm-labels/<pet name>.json` (0600):
 *
 *   { "schema": "lar-realm-label", "petName": "<pet>", "realms": [{ "slug": "<wiki>", "id": "<realm id>" | null }], "bags": ["<slug>"] }
 *
 * Each `realms` row names a canon realm the label holds: the wiki's slug and the realm id the vessel's workbench ledger binds
 * for it (`privateCabalRealmId` for a cabal of one), null until a door reads it. The label mints no realm identity of its own:
 * one pet-name folder may hold several canon realms' wikis. A vessel's ledger binds one slug to one realm, so placement reads
 * by slug. `bags` names the domain bags the realm's folder holds; a wiki placed in a realm brings its own canon bag.
 *
 * LOCAL ALONE. The label rests beside the face labels, outside every mirror, and never rides a share row or any replicated
 * document: "The DreamNet/Lararium code SHALL NOT publish a roster that links a human's faces together", and which wikis a
 * realm groups reads as local too. No projector, census, ingest or export walks it as a carrier.
 *
 * THE PET-NAME RULE matches a face's (`faceSegmentRefusal`): no separator, colon, NUL or leading dot, never empty, unique per
 * house without case. A realm pet name also never repeats a face's pet name: a realm's pools commit under the realm's own
 * identity, and the pool check refuses a face's pet name as an author.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { faceSegmentRefusal, isPrivateProjectionSlug, realmRoot, REALM_PLANES, REALMS_PROJECTION_DIR } from "./bag-paths.js";

/** The folder, under the projections root, the realm labels rest in. */
export const REALM_LABELS_DIR = "realm-labels";
export const REALM_LABEL_SCHEMA = "lar-realm-label";

/** One canon realm a label holds: the wiki's slug and the realm id its workbench ledger binds (null until read). */
export interface RealmLabelRealm { readonly slug: string; readonly id: string | null }

/** One realm label. */
export interface RealmLabel {
  readonly schema: typeof REALM_LABEL_SCHEMA;
  readonly petName: string;
  readonly realms: readonly RealmLabelRealm[];
  readonly bags: readonly string[];
}

/** Why a realm door refuses, by name. */
export type RealmRefusalCode =
  | "realm-name-empty" | "realm-name-separator" | "realm-name-colon" | "realm-name-nul" | "realm-name-leading-dot"
  | "realm-name-collision" | "realm-name-face" | "realm-unnamed" | "realm-slug-malformed" | "realm-slug-private";

/** A refusal a realm door names by code. */
export class RealmRefused extends Error {
  override readonly name = "RealmRefused";
  constructor(readonly code: RealmRefusalCode, message: string) { super(`${code}: ${message}`); }
}

const SLUG = /^[a-z0-9][a-z0-9._-]*$/;
const REALM_ID = /^[0-9a-f]{64}$/;
const fold = (n: string): string => n.normalize("NFC").toLowerCase();

/** `<projections>/realm-labels`. */
export function realmLabelsDir(projections: string): string {
  return join(projections, REALM_LABELS_DIR);
}

/** `<projections>/realm-labels/<pet name>.json`. */
export function realmLabelPath(petName: string, projections: string): string {
  return join(realmLabelsDir(projections), `${petName.normalize("NFC")}.json`);
}

/** The label some bytes name, or null where they name none. */
function parseRealmLabel(bytes: string): RealmLabel | null {
  let raw: unknown;
  try { raw = JSON.parse(bytes); } catch { return null; }
  const r = raw as Record<string, unknown> | null;
  if (r === null || typeof r !== "object" || r["schema"] !== REALM_LABEL_SCHEMA || typeof r["petName"] !== "string" || r["petName"] === "") return null;
  if (!Array.isArray(r["realms"]) || !Array.isArray(r["bags"])) return null;
  const realms: RealmLabelRealm[] = [];
  for (const row of r["realms"] as unknown[]) {
    const x = row as { slug?: unknown; id?: unknown } | null;
    if (x === null || typeof x !== "object" || typeof x.slug !== "string" || !SLUG.test(x.slug)) return null;
    realms.push({ slug: x.slug, id: typeof x.id === "string" && REALM_ID.test(x.id) ? x.id : null });
  }
  const bags = (r["bags"] as unknown[]).filter((b): b is string => typeof b === "string" && SLUG.test(b));
  return { schema: REALM_LABEL_SCHEMA, petName: r["petName"].normalize("NFC"), realms, bags };
}

/** Every realm label the house holds, sorted by pet name. A file whose bytes name no label, or another pet name than its own
 *  file name, reads as none. */
export function readRealmLabels(projections: string): RealmLabel[] {
  let names: string[];
  try { names = readdirSync(realmLabelsDir(projections)).filter((n) => n.endsWith(".json")); } catch { return []; }
  const out: RealmLabel[] = [];
  for (const n of names) {
    let bytes: string;
    try { bytes = readFileSync(join(realmLabelsDir(projections), n), "utf8"); } catch { continue; }
    const label = parseRealmLabel(bytes);
    if (label !== null && label.petName === n.slice(0, -5).normalize("NFC")) out.push(label);
  }
  return out.sort((a, b) => (a.petName < b.petName ? -1 : a.petName > b.petName ? 1 : 0));
}

/** The label a pet name (compared without case) or a canon realm id it holds names, or null. */
export function findRealmLabel(projections: string, nameOrId: string): RealmLabel | null {
  const labels = readRealmLabels(projections);
  return labels.find((l) => fold(l.petName) === fold(nameOrId))
    ?? labels.find((l) => l.realms.some((r) => r.id !== null && r.id === nameOrId.toLowerCase()))
    ?? null;
}

function writeRealmLabel(projections: string, label: RealmLabel): void {
  mkdirSync(realmLabelsDir(projections), { recursive: true });
  const bytes = `${JSON.stringify({ schema: label.schema, petName: label.petName, realms: label.realms.map((r) => ({ slug: r.slug, id: r.id })), bags: label.bags }, null, 2)}\n`;
  atomicWriteFileSync(realmLabelPath(label.petName, projections), bytes, undefined, { mode: 0o600 });
}

/**
 * THE REALM PET-NAME RULE: why a pet name makes no realm folder, or null where it makes one. The face segment rule, by realm
 * codes; `others` names the OTHER realms' pet names (a case twin collides), `faceNames` the pet names the house's faces wear.
 */
export function realmPetNameRefusal(petName: string, others: readonly string[] = [], faceNames: readonly string[] = []): { readonly code: RealmRefusalCode; readonly why: string } | null {
  const face = faceSegmentRefusal(petName);
  if (face !== null) {
    const code = face.code.replace(/^face-segment-/, "realm-name-") as RealmRefusalCode;
    return { code, why: face.code === "face-segment-empty" ? "a realm with no pet name makes no folder: give it one (`lares realm rename <current> --to <pet>`)" : face.why.replace("so it names no single folder", "so it names no single realm folder") };
  }
  const twin = others.find((o) => fold(o) === fold(petName));
  if (twin !== undefined) return { code: "realm-name-collision", why: `the pet name ${JSON.stringify(petName.normalize("NFC"))} meets the realm ${JSON.stringify(twin)} (folders compare without case): name it apart` };
  const worn = faceNames.find((f) => fold(f) === fold(petName));
  if (worn !== undefined) return { code: "realm-name-face", why: `the pet name ${JSON.stringify(petName.normalize("NFC"))} names the face ${JSON.stringify(worn)}: a realm commits under its own identity, never a face's, so name it apart` };
  return null;
}

/** What one naming did: named a new realm, found it already named, or renamed one (its folders move at the next quiet point,
 *  `settleRealmMoves`). */
export interface RealmNaming { readonly label: RealmLabel; readonly did: "named" | "already" | "renamed"; readonly from?: string }

/**
 * NAME OR RENAME A REALM. With no `from`, the pet name names a new, empty realm (a second naming says "already"). With `from`
 * (its current pet name, or a canon realm id the label holds), the label takes the new pet name; the realm's folders follow at
 * the next quiet point (`settleRealmMoves`: at once where no vessel holds them, else at the vessel's next lock or re-stand).
 * Until then each wiki stays readable where it stands (`realmPlacement` reads the settled folder first).
 */
export function nameRealm(projections: string, petName: string, opts: { readonly from?: string; readonly faceNames?: readonly string[] } = {}): RealmNaming {
  const labels = readRealmLabels(projections);
  const name = petName.normalize("NFC");
  if (opts.from === undefined) {
    const standing = labels.find((l) => l.petName === name);
    if (standing !== undefined) return { label: standing, did: "already" };
    const refused = realmPetNameRefusal(name, labels.map((l) => l.petName), opts.faceNames);
    if (refused !== null) throw new RealmRefused(refused.code, refused.why);
    const label: RealmLabel = { schema: REALM_LABEL_SCHEMA, petName: name, realms: [], bags: [] };
    writeRealmLabel(projections, label);
    return { label, did: "named" };
  }
  const old = findRealmLabel(projections, opts.from);
  if (old === null) throw new RealmRefused("realm-unnamed", `no realm on this house wears the pet name or holds the realm id ${JSON.stringify(opts.from)}: \`lares realm list\` names them`);
  if (old.petName === name) return { label: old, did: "already" };
  const refused = realmPetNameRefusal(name, labels.filter((l) => l.petName !== old.petName).map((l) => l.petName), opts.faceNames);
  if (refused !== null) throw new RealmRefused(refused.code, refused.why);
  const label: RealmLabel = { ...old, petName: name };
  writeRealmLabel(projections, label);
  if (realmLabelPath(old.petName, projections) !== realmLabelPath(name, projections)) rmSync(realmLabelPath(old.petName, projections), { force: true });
  return { label, did: "renamed", from: old.petName };
}

/**
 * PLACE A WIKI IN A NAMED REALM: its slug joins the label's realms (with the canon realm id, where a door read one) and its
 * canon bag joins the label's bags. A placement again changes nothing but a newly read id. A slug another realm holds REGROUPS:
 * it leaves that label and joins this one, and its folders follow at the next quiet point (`settleRealmMoves`). The daemon wiki
 * and the kahua plane hold one face's memory and join none.
 */
export function placeInRealm(projections: string, petName: string, wiki: { readonly slug: string; readonly id: string | null }): RealmLabel {
  if (!SLUG.test(wiki.slug)) throw new RealmRefused("realm-slug-malformed", `a wiki slug reads a-z, 0-9, '.', '_', '-', never ${JSON.stringify(wiki.slug)}`);
  if (isPrivateProjectionSlug(wiki.slug)) throw new RealmRefused("realm-slug-private", `"${wiki.slug}" holds one face's memory, which rests in that face's root (faces/<pet name>/): it joins no realm`);
  const labels = readRealmLabels(projections);
  const label = labels.find((l) => fold(l.petName) === fold(petName));
  if (label === undefined) throw new RealmRefused("realm-unnamed", `no realm on this house wears the pet name ${JSON.stringify(petName)}: gather a wiki into it first (\`lares realm move <slug> --to ${petName}\`)`);
  let carried: string | null = null;
  for (const other of labels) {
    if (other === label || !(other.realms.some((r) => r.slug === wiki.slug) || other.bags.includes(wiki.slug))) continue;
    carried = other.realms.find((r) => r.slug === wiki.slug)?.id ?? carried;
    writeRealmLabel(projections, { ...other, realms: other.realms.filter((r) => r.slug !== wiki.slug), bags: other.bags.filter((b) => b !== wiki.slug) });
  }
  const read = wiki.id !== null && REALM_ID.test(wiki.id) ? wiki.id : carried;
  const at = label.realms.findIndex((r) => r.slug === wiki.slug);
  const realms = at === -1 ? [...label.realms, { slug: wiki.slug, id: read }]
    : label.realms.map((r, i) => (i === at && read !== null ? { slug: r.slug, id: read } : r));
  const bags = label.bags.includes(wiki.slug) ? label.bags : [...label.bags, wiki.slug];
  const next: RealmLabel = { ...label, realms, bags };
  if (JSON.stringify(next) !== JSON.stringify(label)) writeRealmLabel(projections, next);
  return next;
}

/** What one move did: the label the wiki now rests in, the realm it left (null where it rested in none, or already here), whether
 *  the target label was minted for it, and each label the move emptied and dropped. */
export interface RealmMove { readonly label: RealmLabel; readonly from: string | null; readonly minted: boolean; readonly dropped: readonly string[] }

/**
 * MOVE A WIKI TO A REALM (`lares realm move <slug> --to <pet>`): the wiki (and its canon bag) leaves the label that holds it and
 * joins the realm wearing `petName`, minted now under the pet-name rule where no label wears it. The wiki keeps its canon realm
 * id (the label only gathers it). A label the move empties leaves, named in `dropped`. The folders follow at the next quiet point.
 */
export function moveWikiToRealm(projections: string, slug: string, petName: string, opts: { readonly faceNames?: readonly string[] } = {}): RealmMove {
  const before = readRealmLabels(projections);
  const from = before.find((l) => l.realms.some((r) => r.slug === slug) || l.bags.includes(slug)) ?? null;
  const minted = findRealmLabel(projections, petName) === null;
  if (minted) nameRealm(projections, petName, opts.faceNames !== undefined ? { faceNames: opts.faceNames } : {});
  const label = placeInRealm(projections, petName, { slug, id: null });
  const dropped: string[] = [];
  for (const l of readRealmLabels(projections)) {
    if (l.petName === label.petName || l.realms.length > 0 || l.bags.length > 0 || !before.some((b) => b.petName === l.petName && (b.realms.some((r) => r.slug === slug) || b.bags.includes(slug)))) continue;
    rmSync(realmLabelPath(l.petName, projections), { force: true });
    dropped.push(l.petName);
  }
  return { label, from: from !== null && from.petName !== label.petName ? from.petName : null, minted, dropped };
}

/** What `ensureRealmLabel` found or minted for a slug, and the line it says where it minted. */
export interface RealmEnsured { readonly label: RealmLabel; readonly minted: boolean; readonly line?: string }

/**
 * EVERY REALM CARRIES A PET NAME (operator ruling 2026-11-19: nothing waits, no plaintext mirror goes dark). The label that
 * holds `slug`, else one minted now under the DEFAULT PET NAME, the slug itself (canon stands each wiki as its own realm, so its
 * folder reads `realms/<slug>/wikis/<slug>/`), written once. A default that meets another realm's pet name (compared without
 * case) takes the slug plus the shortest prefix of the canon realm id (`id`) that names it apart, and the line says so; with no
 * id read yet, the shortest counter (`-2`, `-3`, …) does.
 */
export function ensureRealmLabel(projections: string, slug: string, id: string | null): RealmEnsured {
  const labels = readRealmLabels(projections);
  const holder = labels.find((l) => l.realms.some((r) => r.slug === slug) || l.bags.includes(slug));
  if (holder !== undefined) return { label: holder, minted: false };
  if (!SLUG.test(slug)) throw new RealmRefused("realm-slug-malformed", `a wiki slug reads a-z, 0-9, '.', '_', '-', never ${JSON.stringify(slug)}`);
  if (isPrivateProjectionSlug(slug)) throw new RealmRefused("realm-slug-private", `"${slug}" holds one face's memory, which rests in that face's root (faces/<pet name>/): it joins no realm`);
  const taken = new Set(labels.map((l) => fold(l.petName)));
  const realmId = id !== null && REALM_ID.test(id) ? id : null;
  let petName = slug;
  if (taken.has(fold(slug))) {
    // The shortest id prefix that names it apart; past the whole id (or with none read), the shortest counter does.
    const byId = realmId === null ? undefined : Array.from({ length: realmId.length }, (_, i) => `${slug}-${realmId.slice(0, i + 1)}`).find((c) => !taken.has(fold(c)));
    let n = 2;
    while (byId === undefined && taken.has(fold(`${slug}-${n}`))) n++;
    petName = byId ?? `${slug}-${n}`;
  }
  const label: RealmLabel = { schema: REALM_LABEL_SCHEMA, petName, realms: [{ slug, id: realmId }], bags: [slug] };
  writeRealmLabel(projections, label);
  const line = petName === slug
    ? `${slug}: the realm takes its default pet name "${petName}" (its folder: realms/${petName}/); \`lares realm rename ${petName} --to <pet>\` renames it`
    : `${slug}: the default pet name "${slug}" names another realm already, so this realm takes "${petName}" (the slug plus the shortest ${realmId !== null ? "prefix of its realm id" : "counter"} that names it apart; its folder: realms/${petName}/); \`lares realm rename ${petName} --to <pet>\` renames it`;
  return { label, minted: true, line };
}

/** Where a slug's folders rest by the labels and the disk, read once: the base its workbench and its canon bag lay under. */
export interface RealmPlacement {
  /** The wikis base of the realm whose folder holds the wiki: where it stands on disk, else where its label names; null where no
   *  label holds it. */
  wikisBase(slug: string): string | null;
  /** The bags base, by the same reading. */
  bagsBase(slug: string): string | null;
  /** The pet name of the realm whose label holds the wiki or bag, else null. */
  petNameOf(slug: string): string | null;
  /** Every realm the labels name, with the folder each of its wikis rests at (settled first). */
  realms(): ReadonlyArray<{ readonly petName: string; readonly wikis: ReadonlyArray<{ readonly slug: string; readonly dir: string }> }>;
}

/** The realm folders standing under `<projections>/realms/`. */
function standingRealmFolders(projections: string): string[] {
  try { return readdirSync(join(projections, REALMS_PROJECTION_DIR)).filter((n) => faceSegmentRefusal(n) === null).sort(); } catch { return []; }
}

const isDir = (p: string): boolean => { try { return statSync(p).isDirectory(); } catch { return false; } };

/**
 * THE PLACEMENT the realm labels under `projections` name, read now. A slug whose label moved (a rename, a regroup) and whose
 * folder still stands under its former realm reads THERE until the quiet point moves it (`settleRealmMoves`), so no mount lays
 * a second folder beside the first and the pool never splits.
 */
export function realmPlacement(projections: string): RealmPlacement {
  const labels = readRealmLabels(projections).filter((l) => faceSegmentRefusal(l.petName) === null);
  const folders = standingRealmFolders(projections);
  const wikiOf = new Map<string, string>(), bagOf = new Map<string, string>();
  for (const l of labels) {
    for (const r of l.realms) if (!wikiOf.has(r.slug)) wikiOf.set(r.slug, l.petName);
    for (const b of l.bags) if (!bagOf.has(b)) bagOf.set(b, l.petName);
  }
  const settled = (pet: string | undefined, plane: string, slug: string): string | null => {
    if (pet === undefined) return null;
    const named = join(realmRoot(projections, pet), plane);
    if (isDir(join(named, slug))) return named;
    const former = folders.find((f) => f !== pet && isDir(join(projections, REALMS_PROJECTION_DIR, f, plane, slug)));
    return former !== undefined ? join(projections, REALMS_PROJECTION_DIR, former, plane) : named;
  };
  return {
    wikisBase: (slug) => settled(wikiOf.get(slug), REALM_PLANES.wikis, slug),
    bagsBase: (slug) => settled(bagOf.get(slug), REALM_PLANES.bags, slug),
    petNameOf: (slug) => wikiOf.get(slug) ?? bagOf.get(slug) ?? null,
    realms: () => labels.map((l) => ({ petName: l.petName, wikis: l.realms.map((r) => ({ slug: r.slug, dir: join(settled(l.petName, REALM_PLANES.wikis, r.slug)!, r.slug) })) })),
  };
}

/** What a quiet point's settle did: each folder it moved, and each it left because both places stand. */
export interface RealmSettle { readonly moved: ReadonlyArray<{ readonly from: string; readonly to: string }>; readonly held: readonly string[] }

/**
 * THE QUIET POINT'S MOVES: each wiki and bag folder standing under a realm other than the one its label names moves to the named
 * realm's folder in one rename (its `.git` at the folder's top moves with it, so its history follows), and a realm folder left
 * empty leaves. A slug whose folder stands in BOTH places moves nothing and names itself (never half-moved). Run it only where no
 * vessel holds the folders: the CLI at once while no vessel answers, the vessel at its re-stand (before any mount) and its lock
 * (after its watches stand down).
 */
export function settleRealmMoves(projections: string): RealmSettle {
  const labels = readRealmLabels(projections).filter((l) => faceSegmentRefusal(l.petName) === null);
  const moved: Array<{ from: string; to: string }> = [], held: string[] = [];
  const realmsDir = join(projections, REALMS_PROJECTION_DIR);
  for (const l of labels) {
    const want: Array<[string, string]> = [...l.realms.map((r) => [REALM_PLANES.wikis, r.slug] as [string, string]), ...l.bags.map((b) => [REALM_PLANES.bags, b] as [string, string])];
    for (const [plane, slug] of want) {
      const to = join(realmRoot(projections, l.petName), plane, slug);
      for (const f of standingRealmFolders(projections)) {
        if (f === l.petName) continue;
        const from = join(realmsDir, f, plane, slug);
        if (!isDir(from)) continue;
        if (existsSync(to)) { held.push(`${from}: its label names ${to}, where a folder already stands; move one aside by hand`); continue; }
        mkdirSync(join(realmRoot(projections, l.petName), plane), { recursive: true });
        renameSync(from, to);
        moved.push({ from, to });
      }
    }
  }
  for (const f of standingRealmFolders(projections)) {
    const root = join(realmsDir, f);
    for (const plane of [REALM_PLANES.wikis, REALM_PLANES.bags]) { try { rmdirSync(join(root, plane)); } catch { /* holds something, or none stands */ } }
    try { rmdirSync(root); } catch { /* holds something */ }
  }
  return { moved, held };
}

/** One wiki or bag folder standing under a realm on disk: the realm's folder name, the plane, the slug, and the plane's base (the
 *  dir whose first segment names the slug). */
export interface RealmFolder { readonly petName: string; readonly plane: "wikis" | "bags"; readonly slug: string; readonly base: string }

/**
 * EVERY WIKI AND BAG FOLDER STANDING UNDER `<projections>/realms/`, read off the disk alone (a lay, an export and a keep walk what
 * stands, labelled or not), sorted by slug; a slug standing under two realms reads once, at its first realm by name.
 */
export function realmFoldersOnDisk(projections: string): RealmFolder[] {
  const out: RealmFolder[] = [];
  const seen = new Set<string>();
  for (const petName of standingRealmFolders(projections)) {
    for (const plane of [REALM_PLANES.wikis, REALM_PLANES.bags] as const) {
      const base = join(projections, REALMS_PROJECTION_DIR, petName, plane);
      let slugs: string[] = [];
      try { slugs = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name); } catch { /* none */ }
      for (const slug of slugs) {
        if (seen.has(`${plane}\0${slug}`)) continue;
        seen.add(`${plane}\0${slug}`);
        out.push({ petName, plane, slug, base });
      }
    }
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : a.plane < b.plane ? -1 : 1));
}
