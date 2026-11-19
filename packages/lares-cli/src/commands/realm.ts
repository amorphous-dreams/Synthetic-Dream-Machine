/**
 * `lares realm` — rename realms and move wikis between them (operator ruling 2026-11-19: "The filepath for realms should include
 * their 'pet-name' to match faces."). A realm holds its wikis on disk at `projections/realms/<realm pet name>/wikis/<slug>/` and
 * its domain bags at `projections/realms/<realm pet name>/bags/<slug>/`, as a face holds its planes at `projections/faces/<pet
 * name>/`. The label rests local (`projections/realm-labels/<pet>.json`, `@lararium/node` `realm-labels.ts`): never a share row,
 * never a replicated document.
 *
 * EVERY REALM CARRIES A PET NAME: a realm minted with none takes its wiki's slug (`realms/<slug>/wikis/<slug>/`), and the vessel
 * mints that label on first read, so nothing waits. Naming stays the operator's act and never gates flow:
 *
 * The verb, then the thing acted on, then `--to` its destination, as `mv` reads:
 *
 *   - `rename <current pet | realm id> --to <new pet>`: the realm takes a new pet name.
 *   - `move <wiki slug> --to <realm pet>`: the wiki (and its canon bag) moves to that realm, minted where no label wears the pet
 *     name; it keeps its canon realm id (the label only gathers it), and a label the move empties leaves, named.
 *
 * A rename or a move relabels at once, and the folder moves at a QUIET POINT (`settleRealmMoves`), its `.git` with it: at once
 * where no vessel answers; else at the vessel's next lock or re-stand, which the line says. Until then the wiki reads where it
 * stands, never half-moved.
 *   - `list`: each realm, its pet name, its wikis' folders and the canon realm ids it holds. Local alone.
 *
 * `lares wiki init <slug> --realm <pet>` places the wiki in an existing realm before it mints (`placeWikiInRealm`), so its first
 * mount lays under the realm.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import { join } from "node:path";
import { moveWikiToRealm, nameRealm, placeInRealm, readRealmLabels, realmPlacement, RealmRefused, settleRealmMoves } from "@lararium/node";
import { emit, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";
import { houseFaceNames, LIVE_REALM_DOORS, oneId, type RealmDoors } from "./realm-doors.js";

export { ensureWikiRealm, houseFaceNames, LIVE_REALM_DOORS, placeWikiInRealm, type RealmDoors, type RealmSeat } from "./realm-doors.js";

/**
 * THE QUIET POINT FOR A MOVE: where no vessel answers, settle now (the folders move in one rename each); where one answers, its
 * watch may hold the folder, so the move waits for its next lock or re-stand. Answers the line the door says.
 */
async function settleOrDefer(doors: RealmDoors, probe: string): Promise<{ readonly now: boolean; readonly lines: readonly string[] }> {
  if ((await doors.seat(probe)).answered) return { now: false, lines: ["a vessel answers on this house, and its watch may hold the folder: the folder moves at the vessel's next lock or re-stand (`lares vault lock`, or `lares up`); until then the wiki reads where it stands"] };
  const r = settleRealmMoves(doors.projections());
  return { now: true, lines: [...r.moved.map((m) => `moved ${m.from} -> ${m.to}`), ...r.held.map((h) => `held: ${h}`)] };
}

/** The destination `--to` names, or why the line names none. */
function toOption(args: ParsedArgs): string | null {
  const to = args.options["to"];
  return typeof to === "string" && to !== "" ? to : null;
}

/** `lares realm rename <current pet> --to <new pet>`: the label moves at once; its folders follow at a quiet point. */
async function cmdRename(args: ParsedArgs, doors: RealmDoors): Promise<number> {
  const [current, ...rest] = args.positional.slice(1);
  const to = toOption(args);
  if (current === undefined || rest.length > 0 || to === null) {
    return refuseUsage(args, "realm rename", helpLines("realm rename"), rest.length > 0 ? `unknown word "${rest[0]}"` : "name the realm and its new pet name: `lares realm rename <current pet> --to <new pet>`");
  }
  const projections = doors.projections();
  const r = nameRealm(projections, to, { from: current, faceNames: houseFaceNames(projections) });
  const move = r.did === "renamed" ? await settleOrDefer(doors, r.label.realms[0]?.slug ?? r.label.bags[0] ?? "") : null;
  emit(args, {
    ok: true,
    data: { petName: r.label.petName, did: r.did, ...(r.from !== undefined ? { from: r.from } : {}), ...(move ? { movedNow: move.now, moves: move.lines } : {}) },
    human: () => {
      doors.out(r.did === "already" ? `lares realm rename: the realm already reads "${r.label.petName}"`
        : `lares realm rename: "${r.from}" now reads "${r.label.petName}" (its folder: ${join(projections, "realms", r.label.petName)})`);
      for (const l of move?.lines ?? []) doors.out(`  ${l}`);
    },
  });
  return 0;
}

/** `lares realm move <wiki slug> --to <realm pet>`: the wiki and its canon bag move to that realm (minted where none wears the pet
 *  name), keeping its canon realm id; a label the move empties leaves, named; the folder follows at a quiet point. */
async function cmdMove(args: ParsedArgs, doors: RealmDoors): Promise<number> {
  const [slug, ...rest] = args.positional.slice(1);
  const to = toOption(args);
  if (slug === undefined || rest.length > 0 || to === null) {
    return refuseUsage(args, "realm move", helpLines("realm move"), rest.length > 0 ? `unknown word "${rest[0]}"` : "name the wiki and its realm: `lares realm move <wiki slug> --to <realm pet>`");
  }
  const projections = doors.projections();
  const r = moveWikiToRealm(projections, slug, to, { faceNames: houseFaceNames(projections) });
  const id = oneId(await doors.seat(slug));
  const label = id === null ? r.label : placeInRealm(projections, r.label.petName, { slug, id });
  const held = label.realms.find((x) => x.slug === slug)?.id ?? null;
  const move = await settleOrDefer(doors, slug);
  const dir = realmPlacement(projections).wikisBase(slug);
  emit(args, {
    ok: true,
    data: { slug, petName: label.petName, from: r.from, minted: r.minted, dropped: r.dropped, id: held, folder: dir === null ? null : join(dir, slug), movedNow: move.now, moves: move.lines },
    human: () => {
      doors.out(`lares realm move: "${slug}" rests in the realm "${label.petName}"${r.minted ? " (named now)" : ""}${r.from !== null ? `, from "${r.from}"` : ""}${held === null ? "" : `; realm ${held.slice(0, 12)}…`}`);
      for (const d of r.dropped) doors.out(`  the realm "${d}" holds no wiki now, so its label leaves`);
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
      if (labels.length === 0) { doors.out("lares realm list: no realm labelled on this house yet (each wiki takes its own at its first mount)"); return; }
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

const SUB_DOORS = ["rename", "move", "list"] as const;

export async function cmdRealm(args: ParsedArgs, doors: RealmDoors = LIVE_REALM_DOORS): Promise<number> {
  const verb = args.positional[0];
  if (verb === undefined || !(SUB_DOORS as readonly string[]).includes(verb)) {
    return refuseUsage(args, "realm", helpLines("realm"), verb === undefined ? "name a sub-verb" : `unknown sub-verb "${verb}"`);
  }
  try {
    switch (verb) {
      case "rename": return await cmdRename(args, doors);
      case "move": return await cmdMove(args, doors);
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
