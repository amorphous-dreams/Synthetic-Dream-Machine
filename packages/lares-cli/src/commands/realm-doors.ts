/**
 * realm-doors — what `lares realm` and `lares wiki init` read of the house and the vessel for a realm: the local labels' home, the
 * vessel's workbench seat (the canon realm ids its ledger binds, and whether any vessel answers at all), and the two placements a
 * mint makes (into an existing realm, or the wiki's own realm under its slug). Apart from the verbs, so a door that places a wiki
 * reads no realm flag.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  ensureRealmLabel, FACES_PROJECTION_DIR, findRealmLabel, labelledRelations, larProjectionsHome, placeInRealm, readFaceLabel,
  RealmRefused, releaseRealmId, setAsideRetiredWiki, type RealmEnsured, type RealmLabel,
} from "@lararium/node";
import { vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";

/** What the vessel answered a wiki's seat: whether any vessel answered at all, and the realm ids its ledger binds. */
export interface RealmSeat { readonly answered: boolean; readonly realms: readonly string[] }

/** What `lares realm` reads, injectable for a scratch house. */
export interface RealmDoors {
  /** The house's projections home. */
  projections(): string;
  /** Ask the vessel a wiki's workbench seat (`workbench-seat`); `answered: false` where no vessel answers. */
  seat(slug: string): Promise<RealmSeat>;
  out(line: string): void;
  err(line: string): void;
}

const UNREACHED = /daemon-unreachable|DaemonUnreachable|ECONNREFUSED|ENOENT|no vessel/i;

/** The doors over the house LAR_ROOT names. */
export const LIVE_REALM_DOORS: RealmDoors = {
  projections: () => larProjectionsHome(),
  seat: async (slug) => {
    try {
      const r = await runVerb("workbench-seat", { slug }, await vesselDid());
      if (r.status === "error") return { answered: true, realms: [] };
      const out = summaryOutput(r) as { realms?: unknown } | null;
      return { answered: true, realms: Array.isArray(out?.realms) ? out.realms.filter((x): x is string => typeof x === "string") : [] };
    } catch (e) {
      if (UNREACHED.test(e instanceof Error ? `${e.name} ${e.message}` : String(e))) return { answered: false, realms: [] };
      return { answered: true, realms: [] };
    }
  },
  out: (line) => console.log(line),
  err: (line) => console.error(line),
};

/** The pet names the house's faces wear: each face root's folder and each face label's pet name. */
export function houseFaceNames(projections: string): string[] {
  const names = new Set<string>();
  try {
    for (const n of readdirSync(join(projections, FACES_PROJECTION_DIR))) {
      try { if (statSync(join(projections, FACES_PROJECTION_DIR, n)).isDirectory()) names.add(n.normalize("NFC")); } catch { /* left since the listing */ }
    }
  } catch { /* no faces plane yet */ }
  for (const relation of labelledRelations(projections)) {
    const label = readFaceLabel(relation, projections);
    if (label !== null && label.petname.trim() !== "") names.add(label.petname.normalize("NFC"));
  }
  return [...names];
}

/** The one realm id a seat names for a slug, else null (none, or several: the label waits for a later read). */
export const oneId = (seat: RealmSeat): string | null => (seat.realms.length === 1 ? seat.realms[0]! : null);

/**
 * PLACE A WIKI IN A NAMED REALM: the label takes the slug (and its canon bag), regrouping it from any other label, with the canon
 * realm id the vessel's ledger binds where one answers. Throws {@link RealmRefused} by name (an unnamed realm, a private slug).
 */
export async function placeWikiInRealm(doors: RealmDoors, slug: string, petName: string): Promise<RealmLabel> {
  const projections = doors.projections();
  if (findRealmLabel(projections, petName) === null) throw new RealmRefused("realm-unnamed", `no realm on this house wears the pet name ${JSON.stringify(petName)}: \`lares realm list\` names them, and \`lares realm move <slug> --to ${petName}\` gathers a wiki into a new one`);
  placeInRealm(projections, petName, { slug, id: null });
  const id = oneId(await doors.seat(slug));
  return id === null ? findRealmLabel(projections, petName)! : placeInRealm(projections, petName, { slug, id });
}

/** THE RELEASE AT RETIRE: the slug's label forgets the canon realm id the retired workbench held, keeping its pet name and folders. */
export function releaseWikiRealm(doors: RealmDoors, slug: string): RealmLabel | null {
  return releaseRealmId(doors.projections(), slug);
}

/** THE RETIRED FOLDER STEPS ASIDE: the slug's workbench mirror folder under its realm moves by rename, never deleted (null: nothing to move). */
export function setAsideWikiFolder(doors: RealmDoors, slug: string): { readonly from: string; readonly to: string } | null {
  return setAsideRetiredWiki(doors.projections(), slug);
}

/** THE DEFAULT AT MINT: a wiki minted with no `--realm` takes its own realm label under its slug (or the collision rule's name), with
 *  the canon realm id the vessel's ledger binds where one answers; a wiki some label already holds keeps it. */
export async function ensureWikiRealm(doors: RealmDoors, slug: string): Promise<RealmEnsured> {
  const seat = await doors.seat(slug);
  return ensureRealmLabel(doors.projections(), slug, seat.realms.length === 1 ? seat.realms[0]! : null);
}
