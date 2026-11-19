/**
 * realm-labels — the PET NAME a realm wears on this house, and which canon realms and domain bags it holds (operator ruling
 * 2026-11-19: "The filepath for realms should include their 'pet-name' to match faces."). The operator names each realm at
 * mint (`lares realm name <pet>`), and the label decides where the realm's folders rest: `<projections>/realms/<pet>/`
 * (`realmRoot`, `bag-paths.ts`).
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
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
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
  | "realm-name-collision" | "realm-name-face" | "realm-unnamed" | "realm-folder-standing" | "realm-slug-malformed"
  | "realm-slug-held" | "realm-slug-private";

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
    return { code, why: face.code === "face-segment-empty" ? "a realm with no pet name makes no folder: name it (`lares realm name <pet>`)" : face.why.replace("so it names no single folder", "so it names no single realm folder") };
  }
  const twin = others.find((o) => fold(o) === fold(petName));
  if (twin !== undefined) return { code: "realm-name-collision", why: `the pet name ${JSON.stringify(petName.normalize("NFC"))} meets the realm ${JSON.stringify(twin)} (folders compare without case): name it apart` };
  const worn = faceNames.find((f) => fold(f) === fold(petName));
  if (worn !== undefined) return { code: "realm-name-face", why: `the pet name ${JSON.stringify(petName.normalize("NFC"))} names the face ${JSON.stringify(worn)}: a realm commits under its own identity, never a face's, so name it apart` };
  return null;
}

/** What one naming did: named a new realm, found it already named, or renamed one (its folder moved where one stood). */
export interface RealmNaming { readonly label: RealmLabel; readonly did: "named" | "already" | "renamed"; readonly from?: string; readonly moved?: boolean }

/**
 * NAME OR RENAME A REALM. With no `from`, the pet name names a new, empty realm (a second naming says "already"). With `from`
 * (an old pet name, or a canon realm id the label holds), the label takes the new pet name and its folder
 * (`realms/<old>/`) moves to `realms/<new>/` in one rename; a folder standing under the new name refuses and nothing moves.
 * The caller refuses a rename while a vessel answers (its mounts and its workspace watch hold the old folder).
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
  const was = join(projections, REALMS_PROJECTION_DIR, old.petName), now = realmRoot(projections, name);
  const caseOnly = fold(old.petName) === fold(name);
  if (!caseOnly && existsSync(now)) throw new RealmRefused("realm-folder-standing", `a folder already stands at ${now}: move it aside, then rename the realm`);
  let moved = false;
  if (existsSync(was)) { renameSync(was, now); moved = true; }
  const label: RealmLabel = { ...old, petName: name };
  writeRealmLabel(projections, label);
  if (realmLabelPath(old.petName, projections) !== realmLabelPath(name, projections)) rmSync(realmLabelPath(old.petName, projections), { force: true });
  return { label, did: "renamed", from: old.petName, moved };
}

/**
 * PLACE A WIKI IN A NAMED REALM: its slug joins the label's realms (with the canon realm id, where a door read one) and its
 * canon bag joins the label's bags. A placement again changes nothing but a newly read id. One slug rests in one realm, so a
 * slug another realm holds refuses by name; the daemon wiki and the kahua plane hold one face's memory and join none.
 */
export function placeInRealm(projections: string, petName: string, wiki: { readonly slug: string; readonly id: string | null }): RealmLabel {
  if (!SLUG.test(wiki.slug)) throw new RealmRefused("realm-slug-malformed", `a wiki slug reads a-z, 0-9, '.', '_', '-', never ${JSON.stringify(wiki.slug)}`);
  if (isPrivateProjectionSlug(wiki.slug)) throw new RealmRefused("realm-slug-private", `"${wiki.slug}" holds one face's memory, which rests in that face's root (faces/<pet name>/): it joins no realm`);
  const labels = readRealmLabels(projections);
  const label = labels.find((l) => fold(l.petName) === fold(petName));
  if (label === undefined) throw new RealmRefused("realm-unnamed", `no realm on this house wears the pet name ${JSON.stringify(petName)}: name it first (\`lares realm name ${petName}\`)`);
  const holder = labels.find((l) => l !== label && (l.realms.some((r) => r.slug === wiki.slug) || l.bags.includes(wiki.slug)));
  if (holder !== undefined) throw new RealmRefused("realm-slug-held", `the realm "${holder.petName}" already holds "${wiki.slug}", and one wiki rests in one realm's folder`);
  const id = wiki.id !== null && REALM_ID.test(wiki.id) ? wiki.id : null;
  const at = label.realms.findIndex((r) => r.slug === wiki.slug);
  const realms = at === -1 ? [...label.realms, { slug: wiki.slug, id }]
    : label.realms.map((r, i) => (i === at && id !== null ? { slug: r.slug, id } : r));
  const bags = label.bags.includes(wiki.slug) ? label.bags : [...label.bags, wiki.slug];
  const next: RealmLabel = { ...label, realms, bags };
  if (JSON.stringify(next) !== JSON.stringify(label)) writeRealmLabel(projections, next);
  return next;
}

/** Where a slug's folders rest by the labels, read once: the base its workbench and its canon bag lay under, or null where no
 *  realm holds it (it waits by name). */
export interface RealmPlacement {
  /** `<projections>/realms/<pet>/wikis` for a wiki a named realm holds, else null. */
  wikisBase(slug: string): string | null;
  /** `<projections>/realms/<pet>/bags` for a bag a named realm holds, else null. */
  bagsBase(slug: string): string | null;
  /** The pet name of the realm that holds the wiki or bag, else null. */
  petNameOf(slug: string): string | null;
  /** Every realm the labels name, with the workbench folder each of its wikis lays at. */
  realms(): ReadonlyArray<{ readonly petName: string; readonly wikis: ReadonlyArray<{ readonly slug: string; readonly dir: string }> }>;
}

/** THE PLACEMENT the realm labels under `projections` name, read now. */
export function realmPlacement(projections: string): RealmPlacement {
  const labels = readRealmLabels(projections).filter((l) => faceSegmentRefusal(l.petName) === null);
  const wikiOf = new Map<string, string>(), bagOf = new Map<string, string>();
  for (const l of labels) {
    for (const r of l.realms) if (!wikiOf.has(r.slug)) wikiOf.set(r.slug, l.petName);
    for (const b of l.bags) if (!bagOf.has(b)) bagOf.set(b, l.petName);
  }
  const base = (pet: string | undefined, plane: string): string | null => pet === undefined ? null : join(realmRoot(projections, pet), plane);
  return {
    wikisBase: (slug) => base(wikiOf.get(slug), REALM_PLANES.wikis),
    bagsBase: (slug) => base(bagOf.get(slug), REALM_PLANES.bags),
    petNameOf: (slug) => wikiOf.get(slug) ?? bagOf.get(slug) ?? null,
    realms: () => labels.map((l) => ({ petName: l.petName, wikis: l.realms.map((r) => ({ slug: r.slug, dir: join(realmRoot(projections, l.petName), REALM_PLANES.wikis, r.slug) })) })),
  };
}

/** The line a vessel or door says for a shared wiki no named realm holds: it lays no workbench until the operator names one. */
export function realmWaitingLine(slug: string): string {
  return `${slug}: waits by name — no named realm holds it, so its workbench lays nowhere on disk; name a realm (\`lares realm name <pet>\`), then place it (\`lares realm add <pet> ${slug}\`, or \`lares wiki init ${slug} --realm <pet>\`)`;
}
