import type { ParsedArgs } from "./parse-args.js";

class ContainerTargetRefusal extends Error {
  constructor(message: string, readonly code: "no-container" | "wiki-not-anchored" = "no-container") { super(message); }
}

/**
 * Name the one store container a CLI verb reads or writes. `--realm <id>` rides beside `--bag` alone: it names
 * the REALM whose registration that bag resolves through (a cabal realm's id, or the charter-derived realm's),
 * and with none named the bag resolves as the vessel's default routing gives it. A realm beside `--recipe`
 * refuses: a wiki lives in no realm.
 */
export function containerArgs(args: ParsedArgs, verb: string, direction: "read" | "write" = "read"): Record<string, string> {
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag = typeof args.options["bag"] === "string" ? args.options["bag"].trim() : "";
  if (recipe && bag) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — name one of --recipe <slug> or --bag <slug>, never both.`);
  }
  if (!recipe && !bag) {
    const action = direction === "write" ? "write" : "read";
    throw new ContainerTargetRefusal(
      `lares ${verb}: no-container — name where to ${action}: --recipe <slug> (as that wiki, e.g. --recipe lares) or --bag <slug> (that one bag). No default wiki exists.`,
    );
  }
  const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim().toLowerCase() : "";
  if (realm && recipe) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — --realm names a BAG's realm; name it beside --bag <slug>, never beside --recipe.`);
  }
  return recipe ? { recipe } : realm ? { bag, realm } : { bag };
}

/**
 * Name the wiki an ENGINE verb runs in (`wiki filter | render | status`, `tiddler put | delete`): `--recipe <slug>` alone. A bag
 * names one store and no wiki, so these verbs refuse `--bag` before the wire and name the door that answers a bag: a read rides
 * `tiddler get --bag` (one record; `--meme` a meme) and `meme list --bag` (its roots); a write rides `meme put --bag`
 * and `meme delete --bag`.
 */
export function engineContainerArgs(args: ParsedArgs, verb: string, direction: "read" | "write" = "read"): Record<string, string> {
  const recipe = typeof args.options["recipe"] === "string" ? args.options["recipe"].trim() : "";
  const bag = typeof args.options["bag"] === "string" ? args.options["bag"].trim() : "";
  if (bag) {
    const door = direction === "write"
      ? "a bag takes a record through the meme door: `lares meme put --bag <slug>` · `lares meme delete --bag <slug>`"
      : "a bag reads through its own doors: `lares tiddler get <title> --bag <slug>` (one record; `--meme` a meme) · `lares meme list --bag <slug>` (its roots)";
    throw new ContainerTargetRefusal(`lares ${verb}: wiki-not-anchored — ${verb} runs in a wiki's own engine, and --bag names one bag and no wiki; ${door}. To use ${verb}, name the wiki: --recipe <slug> (--recipe default for the daemon wiki).`, "wiki-not-anchored");
  }
  if (!recipe) {
    throw new ContainerTargetRefusal(`lares ${verb}: no-container — name the wiki: --recipe <slug> (e.g. --recipe lares; --recipe default names the daemon wiki). No default wiki exists.`);
  }
  const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim() : "";
  if (realm) throw new ContainerTargetRefusal(`lares ${verb}: no-container — --realm names a BAG's realm; name it beside --bag <slug>, never beside --recipe.`);
  return { recipe };
}
