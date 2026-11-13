/**
 * swarm-wiki — the vessel's control document as a `SwarmWikiPort`: a swarm record rests under `$:/lares/swarm/` in the
 * control document (`control-home`), which no recipe composes and no mirror names, so no swarm control reaches a
 * projected layer by placement. The control document stays device-local, so no swarm control syncs through it.
 * `writeNew` claims a title inside one document change, so two racing writers land exactly one.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { ownEntry, sha256HexBytesSync, storedLarRecord, swarmRecordFields, tiddlerText, type LarDoc, type SwarmWikiPort } from "@lararium/mesh";

export function controlSwarmWiki(controlDoc: () => Promise<DocHandle<LarDoc>>): SwarmWikiPort {
  const cid = (text: string): string => sha256HexBytesSync(new TextEncoder().encode(text));
  const put = (draft: LarDoc, title: string, text: string): void => { draft.tiddlers[title] = storedLarRecord(title, swarmRecordFields(text), cid(text)); };
  return {
    read: async (title) => tiddlerText(ownEntry((await controlDoc()).doc()?.tiddlers, title)),
    write: async (title, text) => { (await controlDoc()).change((d) => put(d, title, text)); },
    writeNew: async (title, text) => {
      let landed = false;
      (await controlDoc()).change((d) => { if (ownEntry(d.tiddlers, title) === undefined) { put(d, title, text); landed = true; } });
      return landed;
    },
    list: async (prefix) => Object.keys((await controlDoc()).doc()?.tiddlers ?? {}).filter((title) => title.startsWith(prefix)),
  };
}
