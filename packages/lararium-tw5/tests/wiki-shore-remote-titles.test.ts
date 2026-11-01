/**
 * ANOTHER DEVICE'S SAVE REACHES AN OPEN WIKI, WHATEVER ITS TITLE.
 *
 * The save cascade routes more than `lar:` titles into a document: an ordinary title and a system title
 * land in the working layer, and a personal-layer title (`$:/state/folded/…`) lands in the personal slot. The
 * provider fans out every title a document holds, so a peer's save of any of them lands in a wiki that
 * stands open, with no reattach.
 *
 * Control: a title that never persists (a `$:/temp/` title, a volatile VM title) does not arrive even when
 * a peer's document carries it, and a `lar:` title lands as it always did.
 */
import { describe, expect, test } from "vitest";
import { AutomergeDocStore, volatileVmUri, type LarDoc } from "@lararium/mesh";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { Repo, peerWrite, personalBag, landingDeadline, shoreRig, turns, workingBag, type Rig } from "./wiki-shore-rig.js";

const textOf = (r: Rig, title: string): unknown => r.wiki.getTiddler(title)?.fields["text"];

describe.skipIf(wikiSkip)(`a peer's save reaches an open wiki${skipNote}`, () => {
  test("an ordinary title, a system title and a personal-layer title each land; a lar: title lands as before", async () => {
    const r = await shoreRig({ upperSlots: true });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();

    const shadowBefore = String(textOf(r, "$:/SiteTitle") ?? "");
    await peerWrite(r, workingBag, [
      { tiddler: { title: "lar:///t/remote/control", text: "lar text" } },
      { tiddler: { title: "HelloThere", text: "ordinary text" } },
      { tiddler: { title: "$:/SiteTitle", text: "Our Table" } },
    ]);
    await peerWrite(r, personalBag, [{ tiddler: { title: "$:/state/folded/HelloThere", text: "hide" } }]);
    await r.adaptor.landingIdle();

    expect(textOf(r, "lar:///t/remote/control"), "control: a lar: title lands").toBe("lar text");
    expect(textOf(r, "HelloThere")).toBe("ordinary text");
    // `$:/SiteTitle` stands as a plugin's shadow in this wiki: the peer's record lands over the shadow.
    expect(shadowBefore, "control: the shadow stood before the wave").not.toBe("");
    expect(textOf(r, "$:/SiteTitle")).toBe("Our Table");
    expect(textOf(r, "$:/state/folded/HelloThere")).toBe("hide");
  }, 120_000);

  test("CONTROL: a title that never persists does not arrive, though a peer's document carries it", async () => {
    const r = await shoreRig({ upperSlots: true });
    await r.adaptor.armSeedCheckpoint();
    await r.adaptor.landingIdle();
    const temp = "$:/temp/remote/scratch";
    const volatile = volatileVmUri("verbs/remote-scratch");
    const sentinel = "RemoteSentinel";

    // A peer whose document carries both (a store takes what it gets handed), and one title that does land.
    const peerRepo = new Repo({ network: [] });
    const peerHandle = peerRepo.import<LarDoc>(r.saved().working);
    const peerStore = new AutomergeDocStore(peerHandle, workingBag);
    for (const title of [temp, volatile, sentinel]) await peerStore.put({ tiddler: { title, text: "from a peer" } }, { kind: "crdt-remote", edgeIsland: "peer" });
    r.handles[workingBag]!.merge(peerHandle);
    await r.adaptor.ledger.whenLanded(sentinel, (landed) => landed.tiddler != null, landingDeadline(3000));
    await turns(24);
    await r.adaptor.landingIdle();

    expect(textOf(r, sentinel), "the sentinel landed, so the wave passed").toBe("from a peer");
    expect(r.wiki.getTiddler(temp)).toBeUndefined();
    expect(r.wiki.getTiddler(volatile)).toBeUndefined();
    expect(r.arrivals).not.toContain(temp);
    expect(r.arrivals).not.toContain(volatile);
    await peerRepo.shutdown();
  }, 120_000);
});
