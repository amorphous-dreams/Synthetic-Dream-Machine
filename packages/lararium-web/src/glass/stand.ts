import type { ReturnTypeOfPagePort } from "./transport-type.js";
import { bootGlass } from "./boot.js";
import { readGlassBootInputs } from "./cas.js";
import { glassWanted } from "./flag.js";

/** The single page hook; a missing switch keeps the width-none projection. */
export async function standGlassIfFlagged(options: {
  location: Pick<Location, "search">; storage?: Pick<Storage, "getItem">;
  host: HTMLElement; coreCid: string; pluginCids: readonly string[];
  port: ReturnTypeOfPagePort; wikiUri: string; actor: string;
}) {
  const width = glassWanted(options.location, options.storage);
  if (!width) return null;
  const inputs = await readGlassBootInputs(options);
  return bootGlass({ ...options, inputs, width });
}
