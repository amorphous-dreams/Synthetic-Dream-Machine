/**
 * routing-arg — A FIELD THAT ROUTES A CALL READS AS A STRING OR REFUSES. A handler that coerces (`String(args["verb"])`) would
 * route `["shore"]` where a gate that reads the field strictly sees no `"shore"`, so a gate and its handler read one field two
 * ways. Each routing field (an inner verb, a slug, a title, a bag) reads here: a string stands, absence reads as `fallback`, and
 * any other shape refuses `routing-arg-malformed` by name, before it routes anywhere.
 */
import { VerbRefusal } from "@lararium/mesh/verb-refusal";

/** The refusal a routing field of the wrong shape reads. */
export const ROUTING_ARG_MALFORMED = "routing-arg-malformed";

/** A routing field read strictly: its string, `fallback` where absent, or a refusal by name for any other shape. */
export function routingString(args: Readonly<Record<string, unknown>>, name: string, verb: string, fallback = ""): string {
  const value = args[name];
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") throw new VerbRefusal(ROUTING_ARG_MALFORMED, `${ROUTING_ARG_MALFORMED}: ${verb}: \`${name}\` names a string; it reads ${Array.isArray(value) ? "a list" : typeof value}, and nothing routes on it`);
  return value;
}

/** An inner argument object read strictly: a plain object, `{}` where absent, or a refusal by name. */
export function routingObject(args: Readonly<Record<string, unknown>>, name: string, verb: string): Record<string, unknown> {
  const value = args[name];
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new VerbRefusal(ROUTING_ARG_MALFORMED, `${ROUTING_ARG_MALFORMED}: ${verb}: \`${name}\` names an object of arguments`);
  return value as Record<string, unknown>;
}
