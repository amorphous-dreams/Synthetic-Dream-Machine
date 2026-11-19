/**
 * `lares realm` — name each realm and place wikis in it (operator ruling 2026-11-19: "The filepath for realms should include
 * their 'pet-name' to match faces."). A realm holds its wikis on disk at `projections/realms/<realm pet name>/wikis/<slug>/` and
 * its domain bags at `projections/realms/<realm pet name>/bags/<slug>/`, as a face holds its planes at `projections/faces/<pet
 * name>/`. The label rests local (`projections/realm-labels/<pet>.json`, `@lararium/node` `realm-labels.ts`): never a share row,
 * never a replicated document.
 *
 * EVERY REALM CARRIES A PET NAME: a realm minted with none takes its wiki's slug (`realms/<slug>/wikis/<slug>/`), and the vessel
 * mints that label on first read, so nothing waits. Naming stays the operator's act and never gates flow:
 *
 *   - `name <pet> [--realm <current pet | realm id>]`: name a new realm, or rename one.
 *   - `add <pet> <slug>`: place a wiki (and its canon bag) in a named realm, or regroup it there from another, recording the canon
 *     realm id the vessel's workbench ledger binds for the slug where a vessel answers.
 *
 * A rename or a regroup relabels at once, and the folder moves at a QUIET POINT (`settleRealmMoves`), its `.git` with it: at once
 * where no vessel answers; else at the vessel's next lock or re-stand, which the line says. Until then the wiki reads where it
 * stands, never half-moved.
 *   - `list`: each realm, its pet name, its wikis' folders and the canon realm ids it holds. Local alone.
 *
 * `lares wiki init <slug> --realm <pet>` places the wiki before it mints (`placeWikiInRealm`), so its first mount lays under the
 * realm.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  FACES_PROJECTION_DIR, findRealmLabel, labelledRelations, larProjectionsHome, nameRealm, placeInRealm, readFaceLabel, readRealmLabels,
  ensureRealmLabel, realmPlacement, RealmRefused, settleRealmMoves, type RealmEnsured, type RealmLabel,
} from "@lararium/node";
import { vesselDid } from "../env.js";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import type { ParsedArgs } from "../parse-args.js";

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
const oneId = (seat: RealmSeat): string | null => (seat.realms.length === 1 ? seat.realms[0]! : null);

/**
 * PLACE A WIKI IN A NAMED REALM: the label takes the slug (and its canon bag), regrouping it from any other label, with the canon
 * realm id the vessel's ledger binds where one answers. Throws {@link RealmRefused} by name (an unnamed realm, a private slug).
 */
export async function placeWikiInRealm(doors: RealmDoors, slug: string, petName: string): Promise<RealmLabel> {
  const projections = doors.projections();
  if (findRealmLabel(projections, petName) === null) throw new RealmRefused("realm-unnamed", `no realm on this house wears the pet name ${JSON.stringify(petName)}: name it first (\`lares realm name ${petName}\`)`);
  placeInRealm(projections, petName, { slug, id: null });
  const id = oneId(await doors.seat(slug));
  return id === null ? findRealmLabel(projections, petName)! : placeInRealm(projections, petName, { slug, id });
}

/**
 * THE QUIET POINT FOR A MOVE: where no vessel answers, settle now (the folders move in one rename each); where one answers, its
 * watch may hold the folder, so the move waits for its next lock or re-stand. Answers the line the door says.
 */
async function settleOrDefer(doors: RealmDoors, probe: string): Promise<{ readonly now: boolean; readonly lines: readonly string[] }> {
  if ((await doors.seat(probe)).answered) return { now: false, lines: ["a vessel answers on this house, and its watch may hold the folder: the folder moves at the vessel's next lock or re-stand (`lares vault lock`, or `lares up`); until then the wiki reads where it stands"] };
  const r = settleRealmMoves(doors.projections());
  return { now: true, lines: [...r.moved.map((m) => `moved ${m.from} -> ${m.to}`), ...r.held.map((h) => `held: ${h}`)] };
}

async function cmdName(args: ParsedArgs, doors: RealmDoors): Promise<number> {
  const [pet, ...rest] = args.positional.slice(1);
  if (pet === undefined || rest.length > 0) return refuseUsage(args, "realm name", helpLines("realm"), pet === undefined ? "name the realm's pet name" : `unknown word "${rest[0]}"`);
  const from = args.options["realm"];
  if (from !== undefined && typeof from !== "string") return refuseUsage(args, "realm name", helpLines("realm"), "--realm names the realm to rename: its pet name or a canon realm id it holds");
  const projections = doors.projections();
  const r = nameRealm(projections, pet, { ...(from !== undefined ? { from } : {}), faceNames: houseFaceNames(projections) });
  const move = r.did === "renamed" ? await settleOrDefer(doors, r.label.realms[0]?.slug ?? r.label.bags[0] ?? "") : null;
  emit(args, {
    ok: true,
    data: { petName: r.label.petName, did: r.did, ...(r.from !== undefined ? { from: r.from } : {}), ...(move ? { movedNow: move.now, moves: move.lines } : {}) },
    human: () => {
      doors.out(
        r.did === "already" ? `lares realm name: already a realm "${r.label.petName}"`
        : r.did === "renamed" ? `lares realm name: "${r.from}" now reads "${r.label.petName}" (its folder: ${join(projections, "realms", r.label.petName)})`
        : `lares realm name: "${r.label.petName}" (place a wiki: \`lares realm add ${r.label.petName} <slug>\`)`);
      for (const l of move?.lines ?? []) doors.out(`  ${l}`);
    },
  });
  return 0;
}

async function cmdAdd(args: ParsedArgs, doors: RealmDoors): Promise<number> {
  const [pet, slug, ...rest] = args.positional.slice(1);
  if (pet === undefined || slug === undefined || rest.length > 0) return refuseUsage(args, "realm add", helpLines("realm add"), rest.length > 0 ? `unknown word "${rest[0]}"` : "name the realm's pet name and the wiki's slug");
  const label = await placeWikiInRealm(doors, slug, pet);
  const id = label.realms.find((r) => r.slug === slug)?.id ?? null;
  const move = await settleOrDefer(doors, slug);
  const dir = realmPlacement(doors.projections()).wikisBase(slug);
  emit(args, {
    ok: true,
    data: { petName: label.petName, slug, id, folder: dir === null ? null : join(dir, slug), movedNow: move.now, moves: move.lines },
    human: () => {
      doors.out(`lares realm add: "${slug}" rests in the realm "${label.petName}"${dir === null ? "" : ` (${join(dir, slug)})`}${id === null ? "; its realm id reads at a later `lares realm add`, once a vessel binds it" : `; realm ${id.slice(0, 12)}…`}`);
      for (const l of move.lines) doors.out(`  ${l}`);
    },
  });
  return 0;
}

async function cmdList(args: ParsedArgs, doors: RealmDoors): Promise<number> {
  if (args.positional.length > 1) return refuseUsage(args, "realm list", helpLines("realm list"), `unknown word "${args.positional[1]}"`);
  const projections = doors.projections();
  const labels = readRealmLabels(projections);
  const placement = realmPlacement(projections);
  emit(args, {
    ok: true,
    data: { realms: labels.map((l) => ({ petName: l.petName, realms: l.realms, bags: l.bags })) },
    human: () => {
      if (labels.length === 0) { doors.out("lares realm list: no realm named on this house (`lares realm name <pet>`)"); return; }
      for (const l of labels) {
        doors.out(`${l.petName}`);
        for (const r of l.realms) doors.out(`  wiki ${r.slug.padEnd(16)} ${join(placement.wikisBase(r.slug) ?? "", r.slug)}  ${r.id === null ? "(realm id unread)" : `realm ${r.id.slice(0, 12)}…`}`);
        const loose = l.bags.filter((b) => !l.realms.some((r) => r.slug === b));
        for (const b of loose) doors.out(`  bag  ${b.padEnd(16)} ${join(placement.bagsBase(b) ?? "", b)}`);
      }
    },
  });
  return 0;
}

const SUB_DOORS = ["name", "add", "list"] as const;

export async function cmdRealm(args: ParsedArgs, doors: RealmDoors = LIVE_REALM_DOORS): Promise<number> {
  const verb = args.positional[0];
  if (verb === undefined || !(SUB_DOORS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "realm", helpLines("realm"), verb === undefined ? "name a sub-verb" : `unknown sub-verb "${verb}"`);
  }
  try {
    switch (verb) {
      case "name": return await cmdName(args, doors);
      case "add": return await cmdAdd(args, doors);
      default: return await cmdList(args, doors);
    }
  } catch (err) {
    if (err instanceof RealmRefused) {
      emit(args, { ok: false, error: { code: err.code, message: err.message }, human: () => doors.err(`lares realm ${verb}: ${err.message}`) });
      return 1;
    }
    throw err;
  }
}

/** THE DEFAULT AT MINT: a wiki minted with no `--realm` takes its own realm label under its slug (or the collision rule's name), with
 *  the canon realm id the vessel's ledger binds where one answers; a wiki some label already holds keeps it. */
export async function ensureWikiRealm(doors: RealmDoors, slug: string): Promise<RealmEnsured> {
  const seat = await doors.seat(slug);
  return ensureRealmLabel(doors.projections(), slug, seat.realms.length === 1 ? seat.realms[0]! : null);
}
