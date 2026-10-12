import type { ParsedArgs } from "./parse-args.js";

class ContainerTargetRefusal extends Error {
  readonly code = "no-container";
}

/** Name the one store container a CLI verb reads or writes. */
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
  return recipe ? { recipe } : { bag };
}
