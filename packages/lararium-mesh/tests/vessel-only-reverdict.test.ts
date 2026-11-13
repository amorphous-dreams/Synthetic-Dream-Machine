/**
 * vessel-only-reverdict — A GROWING DENY SET RE-ASKS THE REPO'S CACHED VERDICTS.
 *
 * automerge-repo 2.6 resolves a document's ACCESS verdict once per (document, peer) and asks again only on
 * `shareConfigChanged`. So a vessel-only document a peer reached before the control document named it (or before the
 * secret home enrolled it) keeps flowing unless the growth re-asks. Both vessels stand their deny set through ONE book
 * (`vesselOnlyBook`, open-node-vessel and open-browser-vessel), whose growth calls the vessel Repo's `shareConfigChanged`.
 *
 * RED: a bare set with no re-ask lets a change made after the growth reach the peer. CURE: the vessels' book stops it.
 */
import { describe, expect, test } from "vitest";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { CONTROL_HOME_ID, emptyLarDoc, makeVesselOnlyDocs, shareConfigOf, storedLarRecord, vesselOnlyBook, type LarDoc } from "../src/index.js";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function grownAfterAsk(wired: boolean): Promise<string | undefined> {
  const { port1, port2 } = new MessageChannel();
  let A!: Repo;
  // The vessels' own book reads its Repo late, as both vessels hand it; the bare set is the instrument's red.
  const vesselOnly = wired ? vesselOnlyBook(() => A) : makeVesselOnlyDocs();
  A = new Repo({
    network: [new MessageChannelNetworkAdapter(port1)], peerId: "A" as PeerId,
    shareConfig: shareConfigOf(async (_peer, documentId) => !(documentId && vesselOnly.has(documentId))),
  });
  const B = new Repo({ network: [new MessageChannelNetworkAdapter(port2)], peerId: "B" as PeerId });
  await Promise.all([A.networkSubsystem.whenReady(), B.networkSubsystem.whenReady()]);
  const slot = A.create<{ text?: string }>({ text: "before" });
  const seen = await B.find<{ text?: string }>(slot.url);
  expect(seen.doc()?.text).toBe("before");
  // THE DENY SET GROWS: the control document names the slot as a daemon device slot.
  const control = emptyLarDoc();
  const title = `${CONTROL_HOME_ID}/daemon-slot/working/floor`;
  control.tiddlers[title] = storedLarRecord(title, { text: slot.url }, "test");
  expect(vesselOnly.refresh(control as LarDoc, null)).toBe(true);
  await tick(50);
  slot.change((d) => { d.text = "after"; });
  await tick(300);
  const text = seen.doc()?.text;
  A.shutdown(); B.shutdown(); port1.close(); port2.close();
  return text;
}

describe("a vessel-only deny set that grows re-asks every cached verdict", () => {
  test("RED (instrument): with no re-ask, a peer that read the document before the growth keeps receiving it", async () => {
    expect(await grownAfterAsk(false)).toBe("after");
  });
  test("CURE: the vessels' book re-asks on growth, refusing the peer every later change", async () => {
    expect(await grownAfterAsk(true)).toBe("before");
  });
  test("refresh and add answer growth, and tell onGrow only when the set grows", () => {
    let grew = 0;
    const docs = makeVesselOnlyDocs({ onGrow: () => { grew++; } });
    expect(docs.add("secret")).toBe(true);
    expect(docs.add("secret")).toBe(false);
    expect(docs.refresh(emptyLarDoc(), "automerge:control")).toBe(true);
    expect(docs.refresh(emptyLarDoc(), "automerge:control")).toBe(false);
    expect(grew).toBe(2);
  });
  test("the book reads its Repo late: a growth before the Repo stands, or while it closes, answers nothing and throws nothing", () => {
    let repo: { shareConfigChanged(): void } | undefined;
    let asked = 0;
    const book = vesselOnlyBook(() => repo);
    expect(book.add("early")).toBe(true);
    repo = { shareConfigChanged: () => { asked++; } };
    expect(book.add("late")).toBe(true);
    expect(asked).toBe(1);
    repo = { shareConfigChanged: () => { throw new Error("closing"); } };
    expect(() => book.add("closing")).not.toThrow();
  });
});
