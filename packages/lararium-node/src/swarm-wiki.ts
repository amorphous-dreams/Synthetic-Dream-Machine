/**
 * swarm-wiki — the daemon wiki as a `SwarmWikiPort`: a swarm record rests in the daemon document under `$:/lares/swarm/`, stamped
 * `disk-projection: "no"`. The daemon document is device-local by anchor, so no swarm control syncs through it.
 * `writeNew` claims a title inside one document change, so two racing writers land exactly one.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { ownEntry, sha256HexBytesSync, storedLarRecord, swarmRecordFields, tiddlerText, type LarDoc, type SwarmWikiPort } from "@lararium/mesh";

export function daemonSwarmWiki(daemonDoc: () => Promise<DocHandle<LarDoc>>): SwarmWikiPort {
  const cid = (text: string): string => sha256HexBytesSync(new TextEncoder().encode(text));
  const put = (draft: LarDoc, title: string, text: string): void => { draft.tiddlers[title] = storedLarRecord(title, swarmRecordFields(text), cid(text)); };
  return {
    read: async (title) => tiddlerText(ownEntry((await daemonDoc()).doc()?.tiddlers, title)),
    write: async (title, text) => { (await daemonDoc()).change((d) => put(d, title, text)); },
    writeNew: async (title, text) => {
      let landed = false;
      (await daemonDoc()).change((d) => { if (ownEntry(d.tiddlers, title) === undefined) { put(d, title, text); landed = true; } });
      return landed;
    },
    list: async (prefix) => Object.keys((await daemonDoc()).doc()?.tiddlers ?? {}).filter((title) => title.startsWith(prefix)),
  };
}
