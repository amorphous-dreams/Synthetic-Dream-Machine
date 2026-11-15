/**
 * `lares mcp aho -- <child argv…>` — the aho's door on a Node host.
 *
 * The seat a harness config names: it holds the client's stdio for the session's whole life and spawns the surface (the argv
 * after `--`) as a child that may fall and rise. The work lives in `../mcp-aho.ts` over the core in `@lararium/mesh`; this
 * file only reads the line. The committed bin (`bin/lares.mjs`) runs the same entry before it loads this dispatcher, so the
 * seat a harness spawns loads no custody, no vessel and no house root.
 */
import { ahoMain, AHO_USAGE } from "../mcp-aho.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdMcp(args: ParsedArgs): Promise<number> {
  if (args.positional[0] !== "aho") {
    console.error(AHO_USAGE);
    return 2;
  }
  // Everything after `--` lands positional, flags and all: the child's own line, passed on as written.
  return ahoMain(args.positional.slice(1));
}
