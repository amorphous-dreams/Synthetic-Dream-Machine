import type { ParsedArgs } from "./parse-args.js";

class ContainerTargetRefusal extends Error {
  constructor(message: string, readonly code: "no-container" | "wiki-not-anchored" = "no-container") { super(message); }
}

/**
 * A CONTAINER FLAG STANDING BARE NAMES NOTHING: `recipe=`, `bag=` or `realm=` with no value token at all (the parser reads it as
 * a flag) refuses, so the default reaches a call that names neither, never one that named a flag and dropped its slug. A value
 * token that reads blank stands as unnamed, as before.
 */
function refuseBare(args: ParsedArgs, verb: string): void {
  const bare = args.flags["recipe"] === true ? "recipe" : args.flags["bag"] === true ? "bag" : args.flags["realm"] === true ? "realm" : null;
  if (bare !== null) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — ${bare}= takes a slug (\`${bare}=<slug>\`); name one, or name none and the worn face's daemon wiki answers.`);
  }
}

/**
 * Name the one store container a CLI verb reads or writes. `realm=<id>` rides beside `bag=` alone: it names
 * the REALM whose registration that bag resolves through (a cabal realm's id, or the charter-derived realm's),
 * and with none named the bag resolves as the vessel's default routing gives it. A realm beside `recipe=`
 * refuses: a wiki lives in no realm.
 */
export function containerArgs(args: ParsedArgs, verb: string, _direction: "read" | "write" = "read"): Record<string, string> {
  refuseBare(args, verb);
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag = typeof args.options["bag"] === "string" ? args.options["bag"].trim() : "";
  if (recipe && bag) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — name one of recipe=<slug> or bag=<slug>, never both.`);
  }
  const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim().toLowerCase() : "";
  // THE RECIPE DEFAULT REACHES EVERY CALL (comms-ux-enacts fork 5): naming neither reads and writes the worn face's daemon wiki.
  if (!recipe && !bag && !realm) return { recipe: "default" };
  if (realm && !bag) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — realm= names a BAG's realm; name it beside bag=<slug>, never beside recipe=.`);
  }
  return recipe ? { recipe } : realm ? { bag, realm } : { bag };
}

/**
 * Name the wiki an ENGINE verb runs in (`wiki render | status | act`): `recipe=<slug>` alone. A bag names one store and no
 * wiki, so these verbs refuse `bag=` before the wire and name the door that answers a bag: a read rides
 * `lares get title=… bag=<slug>` (one record; `aperture=arc` a meme whole) and `lares get meme=true bag=<slug>` (its roots); a write
 * rides `lares put title=… bag=<slug>` and `lares delete title=… bag=<slug>`, which take one bag through its store.
 */
export function engineContainerArgs(args: ParsedArgs, verb: string, direction: "read" | "write" = "read"): Record<string, string> {
  refuseBare(args, verb);
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag = typeof args.options["bag"] === "string" ? args.options["bag"].trim() : "";
  if (bag) {
    const door = direction === "write"
      ? "a bag takes a record through the plain put and delete: `lares put title=<title> bag=<slug>` · `lares delete title=<title> bag=<slug>`"
      : "a bag reads through its own doors: `lares get title=<title> bag=<slug>` (one record; `aperture=arc` a meme whole) · `lares get meme=true bag=<slug>` (its roots)";
    throw new ContainerTargetRefusal(`lares ${verb}: wiki-not-anchored — ${verb} runs in a wiki's own engine, and bag= names one bag and no wiki; ${door}. To use ${verb}, name the wiki: recipe=<slug> (recipe=default for the daemon wiki).`, "wiki-not-anchored");
  }
  if (!recipe) return { recipe: "default" };
  const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim() : "";
  if (realm) throw new ContainerTargetRefusal(`lares ${verb}: no-container — realm= names a BAG's realm; name it beside bag=<slug>, never beside recipe=.`);
  return { recipe };
}
