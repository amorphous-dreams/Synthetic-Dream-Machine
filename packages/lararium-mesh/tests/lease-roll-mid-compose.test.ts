/**
 * lease-roll-mid-compose — a lease roll after the sibling channel composed refuses an old-epoch edge at the next
 * licensing act, read off the face reading's own lease slots, never off a number the compose captured.
 *
 * Both vessel shores stand their sibling channel through `standSiblingChannel`, and handed it the lease epoch as a NUMBER
 * read once at compose: a roll that lands after the compose never reached a proof, so a sibling whose lease the roll
 * lapsed still proved current. The sibling route ships SHUT (`SIBLING_ROUTE_SHUT`, sibling-channel.ts:201, set on every
 * stand at :970), so no peer act crosses a vessel's channel today; what CAN be pinned stands here: the leaf the ONE
 * composition builds (`siblingLeafOf`) carries the face reading's lease READER, and a real pair over the in-memory relay
 * proves under it, so the order holds on the reader and on a peer's own proof.
 *
 *   R5c CONTROL: an unchanged lease admits: a sibling bound at the held epoch pairs, and a third joins.
 *   R5a RED: a signed roll lands after the pair stood; a sibling bound below it, proving with no relicense between, is
 *            refused as lapsed (the proof reads the reader at the act, not the epoch the last relicense read).
 *   R5b RED: after the roll, the licensing act the board's move fires closes the standing pair, and the sibling's
 *            re-proof is refused as lapsed.
 *   R5d RED: both vessel shores hand the channel a lease reader (`expectedEpoch: () => …`), never a number.
 *
 * Every wait ends on a product event (a refusal the adapter surfaces, a peer it yields); no clock decides.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b, red 5)
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PeerId } from "@automerge/automerge-repo";
import * as channel from "../src/sibling-channel.js";
import type { SiblingLeaf, SiblingRefusal } from "../src/sibling-channel.js";
import { readFace } from "../src/face-reading.js";
import { signLeaseAdvance } from "../src/lease-advance.js";
import { rolledLeaseEpoch } from "../src/epoch-lease.js";
import { groupSecretOpenerFromSeed, type PersonaGroupEnrolment } from "../src/persona-group-secret.js";
import type { PersonaKelEvent } from "../src/persona-kel.js";
import { SEEDS, pubOf, signerOf, founded, enrol, leafOf, memoryRelay, standLeaf, shutdown, type Leaf } from "./fixtures/sibling-fleet.js";

const GROUP = "persona-group:lease-roll";

/** The lease slots a face's daemon doc carries, signed by the KEL's current op-key (opA founds the group). */
async function advance(epoch: number): Promise<string> {
  return signLeaseAdvance({ resource: GROUP, epoch }, { key: await pubOf(SEEDS.opA), sign: signerOf(SEEDS.opA) });
}

/** The ONE composition's leaf, read off the module (absent before the cure: the seam names itself). */
type LeafOf = (opts: {
  readonly deviceKey: string; readonly sign: (bytes: Uint8Array) => Promise<string> | string;
  readonly enrolment: PersonaGroupEnrolment; readonly open: ReturnType<typeof groupSecretOpenerFromSeed>;
  readonly expectedEpoch: () => number | null;
}) => (kel: readonly PersonaKelEvent[]) => Promise<SiblingLeaf>;
function productLeaf(): LeafOf {
  const leaf = (channel as Record<string, unknown>)["siblingLeafOf"];
  if (typeof leaf !== "function") throw new Error("sibling-channel exports no `siblingLeafOf`: the leaf standSiblingChannel composes reads no lease reader at each licensing act");
  return leaf as LeafOf;
}

/** Stand a leaf whose every licensing act re-reads it through the ONE composition's leaf, its lease through `reader`
 *  (the face reading over the live slots). */
async function standReading(device: Uint8Array, enrolment: PersonaGroupEnrolment, kel: readonly PersonaKelEvent[], relay: ReturnType<typeof memoryRelay>, reader: () => number | null): Promise<Leaf> {
  const compose = productLeaf()({ deviceKey: await pubOf(device), sign: signerOf(device), enrolment, open: groupSecretOpenerFromSeed(device), expectedEpoch: reader });
  return standLeaf(device, enrolment, await compose(kel), relay, { leaf: compose });
}

/** The first verdict `on` reaches about the sibling `key`: a refusal naming it, or a peer it proved. */
function verdictOn(on: Leaf, key: string): Promise<{ readonly peer: true } | { readonly refusal: SiblingRefusal }> {
  return new Promise((resolve) => {
    const proven = (): boolean => on.repo.peers.some((p) => on.adapter.provenKeyOf(p) === key);
    if (proven()) { resolve({ peer: true }); return; }
    const off = on.adapter.onRefused((refusal) => {
      if (refusal.suspect === "peer" && refusal.peerKey === key) { off(); on.adapter.off("peer-candidate", onPeer); resolve({ refusal }); }
    });
    const onPeer = ({ peerId }: { peerId: PeerId }): void => {
      if (on.adapter.provenKeyOf(peerId) !== key) return;
      off(); on.adapter.off("peer-candidate", onPeer); resolve({ peer: true });
    };
    on.adapter.on("peer-candidate", onPeer);
  });
}

describe("a lease roll after the sibling channel composed", () => {
  test("R5c CONTROL: an unchanged lease admits a sibling bound at the held epoch, and a third that joins after", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix, 1);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix, 1);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix, 1);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception], 1), relay);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      expect(await verdictOn(x, y.self.deviceKey)).toEqual({ peer: true });
      const z = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, [inception]), relay);
      try { expect(await verdictOn(x, z.self.deviceKey)).toEqual({ peer: true }); }
      finally { await shutdown(z); }
    } finally { await shutdown(x, y); }
  });

  test("R5a RED: a roll lands after the pair stood; a sibling bound below it, proving with no relicense between, is refused as lapsed", async () => {
    const { inception } = await founded();
    const slots: string[] = [await advance(1)];
    const reader = (): number | null => readFace([inception])?.leaseEpoch(GROUP, slots) ?? null;
    expect(reader()).toBe(1);
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix, 1);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix, 1);
    const ez = await enrol(SEEDS.opA, SEEDS.deviceZ, inception.prefix, 1);
    const x = await standReading(SEEDS.deviceX, ex, [inception], relay, reader);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      expect(await verdictOn(x, y.self.deviceKey), "the pair stands at the held epoch").toEqual({ peer: true });
      // THE ROLL: the face's op-key signs the next epoch into its own slot; the face reading reads it at once.
      slots.push(await advance(rolledLeaseEpoch(1)));
      expect(reader()).toBe(2);
      const z = standLeaf(SEEDS.deviceZ, ez, await leafOf(SEEDS.deviceZ, ez, [inception]), relay);
      try {
        const verdict = await verdictOn(x, z.self.deviceKey);
        expect(verdict, "an edge bound below the rolled lease proved current").not.toEqual({ peer: true });
        expect(verdict).toMatchObject({ refusal: { suspect: "peer", peerKey: z.self.deviceKey, reason: expect.stringMatching(/lease stale/) } });
      } finally { await shutdown(z); }
    } finally { await shutdown(x, y); }
  });

  test("R5b RED: after the roll, the licensing act the board's move fires closes the standing pair, and the re-proof is refused as lapsed", async () => {
    const { inception } = await founded();
    const slots: string[] = [await advance(1)];
    const reader = (): number | null => readFace([inception])?.leaseEpoch(GROUP, slots) ?? null;
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix, 1);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix, 1);
    const x = await standReading(SEEDS.deviceX, ex, [inception], relay, reader);
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      expect(await verdictOn(x, y.self.deviceKey)).toEqual({ peer: true });
      slots.push(await advance(rolledLeaseEpoch(1)));
      const refused = new Promise<SiblingRefusal>((resolve) => {
        const off = x.adapter.onRefused((r) => { if (r.suspect === "peer" && r.peerKey === y.self.deviceKey) { off(); resolve(r); } });
      });
      await x.adapter.relicense(x.adapter.kel);
      expect(await refused).toMatchObject({ suspect: "peer", reason: expect.stringMatching(/lease stale/) });
      expect(x.repo.peers.filter((p) => x.adapter.provenKeyOf(p) === y.self.deviceKey), "the lapsed pair still stands").toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("R5d RED: both vessel shores hand the channel a lease reader, never a number captured at compose", () => {
    for (const rel of ["../../lararium-node/src/open-node-vessel.ts", "../../lararium-browser/src/open-browser-vessel.ts"]) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
      expect(src, `${rel} stands the channel`).toMatch(/standSiblingChannel\(/);
      expect(src, `${rel} hands the channel a lease reader`).toMatch(/expectedEpoch:\s*\(\)\s*=>/);
    }
  });
});
