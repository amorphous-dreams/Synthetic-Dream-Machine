import type { ParsedArgs } from "./parse-args.js";

class ContainerTargetRefusal extends Error {
  readonly code = "no-container";
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
