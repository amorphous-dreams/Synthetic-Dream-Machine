/** Swarm custody crosses the standing pūlama session; no vessel mounts its disk. */
import type { SwarmWikiPort } from "@lararium/mesh/swarm-tiddlers";
import { openedCustody } from "./custody-seat.js";
import type { PulamaHolder } from "./pulama-holder.js";
export function pulamaSwarmWiki(): SwarmWikiPort {
  const port = async (): Promise<SwarmWikiPort> => {
    const holder = await openedCustody();
    const records = (holder as Partial<PulamaHolder>).swarmRecords;
    if (!records) throw new Error("swarm-custody-unavailable: this vessel holds no pūlama session");
    return records;
  };
  return {
    read: async title => (await port()).read(title),
    write: async (title, text) => (await port()).write(title, text),
    writeNew: async (title, text) => (await port()).writeNew(title, text),
    list: async prefix => (await port()).list(prefix),
  };
}
