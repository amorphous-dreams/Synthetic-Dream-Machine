/** Face-private board adapter for signed lane and roster rows. */
import type { DocHandle } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { sha256HexBytesSync } from "./crypto.js";
import { ownEntry } from "./stored-value.js";
import { tiddlerText } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { swarmRecordFields, type SwarmWikiPort } from "./swarm-tiddlers.js";

export function docSwarmWiki(ownerDoc: () => Promise<DocHandle<LarDoc>>): SwarmWikiPort {
  const cid = (text: string): string => sha256HexBytesSync(new TextEncoder().encode(text));
  const put = (draft: LarDoc, title: string, text: string): void => { draft.tiddlers[title] = storedLarRecord(title, swarmRecordFields(text), cid(text)); };
  return {
    read: async (title) => tiddlerText(ownEntry((await ownerDoc()).doc()?.tiddlers, title)),
    write: async (title, text) => { (await ownerDoc()).change((d) => put(d, title, text)); },
    writeNew: async (title, text) => {
      let landed = false;
      (await ownerDoc()).change((d) => { if (ownEntry(d.tiddlers, title) === undefined) { put(d, title, text); landed = true; } });
      return landed;
    },
    list: async (prefix) => Object.keys((await ownerDoc()).doc()?.tiddlers ?? {}).filter((title) => title.startsWith(prefix)),
  };
}
