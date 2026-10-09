/**
 * sibling-share.test — a sibling holds STANDING, never the vessel. A device proven over a face's sibling session
 * reaches that face's own planes and the public boards through the PersonaGroup ring's sibling path, and nothing
 * else: never the vessel's @daemon, never another face's planes.
 *
 * The vessel here wears face A and carries face B beside it (a multitude). Its share verdict is the one every
 * browser vessel runs (`federationShareDecision` with its `siblings`), its sibling gate the ring's
 * `composeSiblings` over the public boards.
 *
 * Proven, each red beside its control:
 *   · CONTROL: a face-A sibling receives a face-A plane doc;
 *   · RED: it never receives a face-B plane doc;
 *   · RED: it never receives the vessel's @daemon doc;
 *   · RED (the verdict alone): a sibling's every doc denies until the sibling gate stands, and a peer the ring
 *     never proved a sibling reads as a house member exactly as before.
 */
import { describe, test, expect } from "vitest";
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { DeterministicFederationGate, federationShareDecision, type SiblingShare } from "../src/federation-gate.js";
import { makePersonaGroupIdentityRing } from "../src/persona-group-ring.js";
import { personaKelBoardDocUrl } from "../src/deterministic-doc.js";
import {
  SEEDS, founded, enrol, leafUnder, memoryRelay, standLeaf, until, sleep, peersOf, shutdown, type Leaf,
} from "./fixtures/sibling-fleet.js";

const NEXUS = "4e".repeat(32);

/** A find that settles: the doc's line, or "withheld" when no peer would hand it over. */
async function reach(leaf: Leaf, url: string): Promise<string> {
  const found = leaf.repo.find<{ line: string }>(url as AutomergeUrl).then((h) => h.doc()?.line ?? "empty", () => "withheld");
  return Promise.race([found, sleep(1500).then(() => "withheld")]);
}

describe("a sibling reaches its face's own planes and nothing else", () => {
  test("a face-A sibling on a two-face vessel receives face-A planes, never face-B planes and never @daemon", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const faceA = new Set<DocumentId>();
    let x: Leaf | null = null;
    const ring = makePersonaGroupIdentityRing({
      governs: (id) => faceA.has(id),
      provenVesselKey: () => null,
      siblingKeyOf: (peerId) => x?.adapter.provenKeyOf(peerId) ?? null,
      grants: { records: () => [], verify: async () => false },
    });
    const siblingGate = ring.composeSiblings(new DeterministicFederationGate(NEXUS));
    const siblings: SiblingShare = { isSibling: (peerId) => Boolean(x?.adapter.provenKeyOf(peerId as PeerId)), gate: () => siblingGate };
    x = standLeaf(SEEDS.deviceX, ex, await leafUnder(SEEDS.deviceX, ex, [inception]), relay, {
      sharePolicy: (peerId, documentId) => federationShareDecision(new Set(), null, peerId, documentId as DocumentId | undefined, siblings),
    });
    const y = standLeaf(SEEDS.deviceY, ey, await leafUnder(SEEDS.deviceY, ey, [inception]), relay);
    try {
      await until(() => peersOf(x!).length === 1 && peersOf(y).length === 1, "the siblings to stand");
      const planeA = x.repo.create<{ line: string }>({ line: "face A's own plane" });
      faceA.add(interpretAsDocumentId(planeA.url));
      const planeB = x.repo.create<{ line: string }>({ line: "face B's plane, a face this sibling never proved under" });
      const daemon = x.repo.create<{ line: string }>({ line: "the vessel's @daemon" });
      expect(await reach(y, planeA.url)).toBe("face A's own plane");
      expect(await reach(y, planeB.url)).toBe("withheld");
      expect(await reach(y, daemon.url)).toBe("withheld");
    } finally { await shutdown(x, y); }
  });

  test("the verdict alone: a sibling denies until its gate stands; the public board crosses; a house peer shares as before", async () => {
    const someDoc = "2PrivateDocIdXXXXXXXXXXXXXXX" as DocumentId;
    const board = interpretAsDocumentId(personaKelBoardDocUrl(NEXUS) as AutomergeUrl);
    let gate: DeterministicFederationGate | null = null;
    const siblings: SiblingShare = { isSibling: (p) => p === "sib", gate: () => gate };
    expect(await federationShareDecision(new Set(), null, "sib", someDoc, siblings)).toBe(false);
    expect(await federationShareDecision(new Set(), null, "sib", board, siblings)).toBe(false);
    gate = new DeterministicFederationGate(NEXUS);
    expect(await federationShareDecision(new Set(), null, "sib", board, siblings)).toBe(true);
    expect(await federationShareDecision(new Set(), null, "sib", someDoc, siblings)).toBe(false);
    expect(await federationShareDecision(new Set(), null, "sib", undefined, siblings)).toBe(false);
    // CONTROL: an in-process house peer still shares freely, siblings wired or not.
    expect(await federationShareDecision(new Set(), null, "island", someDoc, siblings)).toBe(true);
  });
});
