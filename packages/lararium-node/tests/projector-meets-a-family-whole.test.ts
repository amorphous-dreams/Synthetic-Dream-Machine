/**
 * THE PROJECTOR MEETS A FAMILY WHOLE.
 *
 * A store change carries a carrier's root and its children together (`writeFamily`). The wiki shore lands
 * every record of one store change inside one slice, with no turn handed to the host in between, and the
 * wiki dispatches its `change` once for them; so the disk projector, which reconciles a carrier root
 * against the wiki's settled state, never renders a root beside only some of its children.
 *
 * The run: the real `LarDiskProjector` over a real wiki, a real `IslandAdaptor` and a real document. A
 * peer's family (a root and N children in ONE change) merges in. Every render of that carrier records how
 * many children the wiki held at that instant.
 *
 * Control: the same records arriving as N + 1 separate changes may render a partial carrier in between
 * (each change stands as its own grain), and the last render still holds every child.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutomergeDocStore, type LarDoc, type LarTiddlerRecord } from "@lararium/mesh";
import { LarDiskProjector } from "../src/disk-projector.js";
import { Repo, arrived, shoreRig, turns, workingBag, type Rig } from "../../lararium-tw5/tests/wiki-shore-rig.js";
import { wikiSkip, skipNote } from "../../lararium-tw5/tests/test-wiki.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const family = (root: string, children: number): LarTiddlerRecord[] => [
  { tiddler: { title: root, text: Array.from({ length: children }, (_, i) => `<<~ kahea ahu #/c${i}>>`).join("\n") } },
  ...Array.from({ length: children }, (_, i) => ({ tiddler: { title: `${root}#/c${i}`, text: `child ${i}`, "$fragment-parent": root } })),
];

/** Stand the real projector over the rig's wiki; answer the child count the wiki held at each render of `root`. */
function watch(r: Rig, root: string): { readonly seen: number[]; readonly projector: LarDiskProjector; readonly stop: () => Promise<void> } {
  dir = mkdtempSync(join(tmpdir(), "lar-family-whole-"));
  const seen: number[] = [];
  const wiki = r.engine.$tw.wiki as unknown as { allTitles(): string[]; getTiddler(t: string): { fields: Record<string, unknown> } | undefined };
  const projector = new LarDiskProjector({
    mirrors: [{ bagId: workingBag, mirrorRoot: dir }],
    carrierFileFn: async (uri) => {
      const kids = wiki.allTitles().filter((t) => t.startsWith(`${uri}#`)).sort();
      if (uri === root) seen.push(kids.length);
      return { ext: ".tid", body: `title: ${uri}\n\n${String(wiki.getTiddler(uri)?.fields["text"] ?? "")}\n${kids.map((k) => String(wiki.getTiddler(k)?.fields["text"])).join("\n")}`, defaultRelPath: `${uri.slice(uri.lastIndexOf("/") + 1)}.tid` };
    },
  });
  const stop = projector.start(r.engine as never);
  return { seen, projector, stop };
}

async function peerChange(r: Rig, write: (store: AutomergeDocStore) => Promise<void>, titles: readonly string[]): Promise<void> {
  const peerRepo = new Repo({ network: [] });
  const peerHandle = peerRepo.import<LarDoc>(r.saved().working);
  await write(new AutomergeDocStore(peerHandle, workingBag));
  const before = r.arrivals.length;
  r.handles[workingBag]!.merge(peerHandle);
  await arrived(r, before, titles);
  await r.adaptor.landingIdle();
  await turns(8);
  await peerRepo.shutdown();
}

describe.skipIf(wikiSkip)(`the projector meets a family whole${skipNote}`, () => {
  for (const children of [3, 14, 250]) {
    test(`a peer's family of 1 + ${children} in one change never renders with a child missing`, async () => {
      const r = await shoreRig();
      await r.adaptor.armSeedCheckpoint();
      await r.adaptor.landingIdle();
      const root = `lar:///t/family/whole-${children}`;
      const w = watch(r, root);
      const records = family(root, children);
      await peerChange(r, (store) => store.writeFamily(records, [], { kind: "crdt-remote", edgeIsland: "peer" }), records.map((x) => x.tiddler.title));
      await w.projector.idle();
      expect(w.seen.length, "the carrier rendered").toBeGreaterThan(0);
      expect(w.seen.filter((n) => n !== children), `renders that held ${children} children: ${JSON.stringify(w.seen)}`).toEqual([]);
      await w.stop();
      await r.stop();
    }, 120_000);
  }

  test("CONTROL: the same records in separate changes each stand as their own grain, and the last render holds every child", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const root = "lar:///t/family/apart";
    const w = watch(r, root);
    const records = family(root, 3);
    for (const record of records) {
      await peerChange(r, (store) => store.put(record, { kind: "crdt-remote", edgeIsland: "peer" }), [record.tiddler.title]);
      await w.projector.idle();
    }
    expect(w.seen.at(-1)).toBe(3);
    expect(w.seen.some((n) => n < 3), `separate changes rendered in between: ${JSON.stringify(w.seen)}`).toBe(true);
    await w.stop();
    await r.stop();
  }, 120_000);
});
