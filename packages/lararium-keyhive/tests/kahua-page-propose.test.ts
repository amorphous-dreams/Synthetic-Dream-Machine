/**
 * kahua-page-propose — a page draft reaches the operator's hand without the daemon syncing: the device's atom signs one
 * `kahua-lift` proposal batch (digests only, pinned to the atom) on the face's intents plane.
 *
 * SECURITY CLASS (authority input: the drafts the page names, the signer, the plane). Red: a draft over a kahua title
 * proposes; the entry verifies under the atom, pins it, and names the draft's digest; the plane carries no body.
 * Controls: a title with no draft above the stage refuses by name and writes nothing; an island with no intents plane
 * refuses by name; the operator's lift binds the body by that digest (`kahuaBodyDigest`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import {
  AutomergeDocStore, CompositeStore, KAHUA_BAG, KAHUA_PROPOSE_VERB, ORACLE_BAG, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed,
  emptyLarDoc, faceIntentVerbs, intentEntryRecordsOfGroup, kahuaBodyDigest, makeIslandRepo, readIntentEntry, readKahuaProposal,
  wikiSlotUri, type ChangeOrigin, type LarDoc,
} from "@lararium/mesh";
import { proposeDraftsToKahua, KahuaProposeRefused } from "../src/kahua-page-propose.js";

const GROUP = "ab".repeat(16);
const TOP = wikiSlotUri("daemon", "working");
const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "system" };
const rec = (title: string, text: string) => ({ tiddler: { title, text } });

async function stand() {
  const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
  const seed = new Uint8Array(32).fill(41);
  const atom = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const plane = repo.create<LarDoc>(emptyLarDoc());
  const composite = new CompositeStore();
  const stage = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), KAHUA_BAG);
  const top = new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), TOP);
  composite.addLayer({ bagId: ORACLE_BAG, store: new AutomergeDocStore(repo.create<LarDoc>(emptyLarDoc()), ORACLE_BAG), writable: false, defaultWritable: false });
  composite.addLayer({ bagId: KAHUA_BAG, store: stage, writable: false, defaultWritable: false });
  composite.addLayer({ bagId: TOP, store: top, writable: true, defaultWritable: true });
  await stage.put(rec("Item", "kahua-item"), origin);
  await stage.put(rec("OnlyShared", "kahua-only"), origin);
  await top.put(rec("Item", "SECRET-DRAFT-BODY"), origin);
  return { atom, plane, composite, base: { group: GROUP, atom, plane, composite, session: "s1", nonce: "n1", verbs: faceIntentVerbs() } };
}

describe("the page proposes a draft toward a lift", () => {
  test("RED: a draft over a kahua title proposes: one entry, verified under the atom, pinned to it, naming the draft's digest; no body rides", async () => {
    const s = await stand();
    const out = await proposeDraftsToKahua({ ...s.base, titles: ["Item"] });
    const records = intentEntryRecordsOfGroup(s.plane.doc(), GROUP);
    expect(records).toHaveLength(1);
    const read = readIntentEntry(records[0], { group: GROUP, authorize: (signer) => signer === s.atom.key });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.entry.body["verb"]).toBe(KAHUA_PROPOSE_VERB);
    expect(read.entry.body["audience"]).toEqual({ mode: "pinned", atom: s.atom.key.toLowerCase() });
    const batch = readKahuaProposal(read.entry);
    expect(batch?.proposals).toEqual([{ title: "Item", revision: kahuaBodyDigest("SECRET-DRAFT-BODY"), digest: kahuaBodyDigest("SECRET-DRAFT-BODY"), taint: [] }]);
    expect(out.proposals).toEqual(batch?.proposals);
    expect(out.id).toMatch(/^[0-9a-f]+$/);
    expect(JSON.stringify(s.plane.doc())).not.toContain("SECRET-DRAFT-BODY");
  });

  test("CONTROL: a title with no draft above the stage refuses by name and writes nothing", async () => {
    const s = await stand();
    await expect(proposeDraftsToKahua({ ...s.base, titles: ["OnlyShared"] })).rejects.toThrow(/kahua-proposal-no-draft: OnlyShared/);
    await expect(proposeDraftsToKahua({ ...s.base, titles: ["Absent"] })).rejects.toThrow(/kahua-proposal-no-draft: Absent/);
    await expect(proposeDraftsToKahua({ ...s.base, titles: [] })).rejects.toThrow(KahuaProposeRefused);
    expect(intentEntryRecordsOfGroup(s.plane.doc(), GROUP)).toHaveLength(0);
  });

  test("CONTROL: an island with no intents plane refuses by name", async () => {
    const s = await stand();
    await expect(proposeDraftsToKahua({ ...s.base, plane: null, titles: ["Item"] })).rejects.toThrow(/kahua-proposal-no-plane/);
  });
});
