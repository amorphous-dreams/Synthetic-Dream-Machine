/** Select each swarm row's owner without changing its signed bytes. */
import { SWARM_URI_PREFIX } from "./lar-uris.js";
import type { SwarmWikiPort } from "./swarm-tiddlers.js";
export const swarmCustodyTitle = (title: string): boolean =>
  ["lei/", "lei-returned/", "lei-unstrung/", "tessera/"].some(part => title.startsWith(`${SWARM_URI_PREFIX}${part}`));
export function swarmOwners(custody: SwarmWikiPort, board: SwarmWikiPort): SwarmWikiPort {
  const owner = (title: string) => swarmCustodyTitle(title) ? custody : board;
  return {
    read: title => owner(title).read(title),
    write: (title, text) => owner(title).write(title, text),
    writeNew: (title, text) => owner(title).writeNew(title, text),
    list: async prefix => [...new Set([...(await custody.list(prefix)).filter(swarmCustodyTitle), ...(await board.list(prefix)).filter(title => !swarmCustodyTitle(title))])].sort(),
  };
}
