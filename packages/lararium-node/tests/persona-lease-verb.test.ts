/**
 * persona-lease — the production road of a face's signed lease advance, end to end through the store-door verb
 * (`lares persona lease`). Reds: an unsigned slot and a stranger-signed slot on the daemon doc raise nothing, so the
 * verb reads effective 0 and the sealed anchor's frontier stays; the verb's own advance raises both. Controls: a second
 * advance climbs by one, and a face with no lineage refuses by name.
 */
import { afterEach, describe, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  DAEMON_BAG_ID, ed25519SignerFromSeed, leaseEpochSlotUri, seedDaemonDoc, signLeaseAdvance, signedLeaseEpoch, raiseFaceFrontier, tiddlerText, type LarDoc,
  ed25519VerifyingKeyFromSeed, emptyLarDoc, signFoundingLog, signPersonaAct, actCid, faceRootCommitment, edgeBodyDigest, personaBagIdFor,
  verifyDeviceDelegation, writePersonaAct,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot, loadPersonaGroupRootSeed } from "../src/node-vessel-identity.js";
import { testVesselTag } from "../../lararium-mesh/tests/vessel-tag-fixture.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { loadFaceAnchorOfGroup, keepFaceAnchorOfGroup } from "../src/face-anchor-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { seedFaceAtom } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";
import { scratchRoot as root, it } from "./support/scratch-fixture.js";

let daemonUrl: string;

async function setup(withFleet: boolean) {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  await generateOrLoadPersonaGroupRoot(0);
  await seedFaceAtom(0);
  if (withFleet) await seedFleet(0);
  await ownedStore(larDataDir(), async (repo) => {
    const handle = seedDaemonDoc(repo);
    daemonUrl = handle.url;
    await repo.flush();
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packed = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: handle.url, kind: "oracle" } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packed }) }), "utf8");
  });
}
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

/** Stand the face's `@persona` log as a founding writes it (this vessel's atom and edge seated), plus one joinee's seat. */
async function standFaceLog(): Promise<void> {
  const anchors = (await loadIdentityAnchors(0))!;
  const group = anchors.personaGroupId, own = anchors.deviceEdge!;
  const seed = await loadPersonaGroupRootSeed(0);
  const signer = { key: await ed25519VerifyingKeyFromSeed(seed), sign: ed25519SignerFromSeed(seed) };
  const joinee = await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(21));
  await ownedStore(larDataDir(), async (repo) => {
    const plane = repo.create(emptyLarDoc());
    const founding = await signFoundingLog({ group, personaKelPrefix: anchors.personaKelPrefix!, rootCommitment: faceRootCommitment(own.personaRootDid),
      epoch: 0, planes: { persona: plane.url }, deviceKey: own.deviceVerifyingKey, edgeDigest: edgeBodyDigest(own),
      vesselTag: await testVesselTag(1, group, own.deviceVerifyingKey) }, signer);
    const last = founding[founding.length - 1]!.body;
    const admission = await signPersonaAct({ seq: last.seq, cid: actCid(last) }, { group, act: "admission", epoch: 0,
      fields: { deviceKey: joinee, ...(await testVesselTag(2, group, joinee)) } }, signer);
    const edge = await signPersonaAct({ seq: admission.body.seq, cid: actCid(admission.body) }, { group, act: "device-edge", epoch: 0,
      fields: { deviceKey: joinee, edgeDigest: "joinee-edge-at-epoch-0" } }, signer);
    plane.change((d) => { for (const act of [...founding, admission, edge]) writePersonaAct(d, act); });
    await repo.flush();
    const packed = { [DAEMON_BAG_ID]: { title: DAEMON_BAG_ID, text: daemonUrl, kind: "oracle" },
      [personaBagIdFor(group)]: { title: personaBagIdFor(group), text: plane.url } };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: packed }) }), "utf8");
  });
}

const roll = () => storeDoorDirect("persona-lease", { handleIndex: 0 }, { sealHome: larSealHome() });
const slotsOf = async (group: string): Promise<string[]> => ownedStore(larDataDir(), async (repo) => {
  const doc = (await repo.find<LarDoc>(daemonUrl as never)).doc();
  return Object.entries(doc?.tiddlers ?? {}).filter(([t]) => t.includes("/lease-epoch/")).map(([, r]) => tiddlerText(r) ?? "").filter((x) => x.length > 0 || group === "");
});

describe("lares persona lease", () => {
  it("RED: a roll on a founded face whose edge binds the current epoch refuses by name and writes nothing, since the rolling vessel's next boot would halt stale", async () => {
    await setup(true);
    const anchors = (await loadIdentityAnchors(0))!;
    const own = anchors.deviceEdge!;
    expect(Number(own.boundEpoch), "the founding seats this vessel's edge at the current epoch").toBe(0);
    expect((await verifyDeviceDelegation(own, own.personaRootDid, { expectedEpoch: 1 })).reason, "the halt a roll to 1 would cause").toMatch(/stale/);
    const before = await slotsOf(anchors.personaGroupId);
    const out = (await roll()) as { refused?: string; refusal?: string; rolled?: number };
    expect(out.refusal).toBe("persona-lease-refused");
    expect(out.refused).toMatch(/^lease-roll-strands-devices: .*\b1 seated device\b/);
    expect(out.refused).toMatch(/L24/);
    expect(out.refused).toMatch(/device-local cache update, not an identity change/);
    expect(out.rolled).toBeUndefined();
    expect(await slotsOf(anchors.personaGroupId), "no slot lands").toEqual(before);
    expect((await loadFaceAnchorOfGroup(anchors.personaGroupId))!.frontier.leaseEpoch, "the sealed frontier stays").toBe(0);
  }, 120_000);

  it("RED: the refusal counts every device the face's log seats, the rolling vessel's own among them", async () => {
    await setup(true);
    await standFaceLog();
    const group = (await loadIdentityAnchors(0))!.personaGroupId;
    const out = (await roll()) as { refused?: string };
    expect(out.refused).toMatch(/^lease-roll-strands-devices: .*\b2 seated devices\b/);
    expect(await slotsOf(group)).toEqual([]);
    expect((await loadFaceAnchorOfGroup(group))!.frontier.leaseEpoch).toBe(0);
  }, 120_000);

  it("RED: unsigned and stranger-signed slots raise nothing; the verb's own advance raises the slot max and the sealed frontier", async () => {
    await setup(true);
    const anchors = (await loadIdentityAnchors(0))!;
    const group = anchors.personaGroupId;
    await ownedStore(larDataDir(), async (repo) => {
      const daemon = await repo.find<LarDoc>(daemonUrl as never);
      const stranger = await signLeaseAdvance({ resource: group, epoch: 40 }, { key: "ab".repeat(32), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(8)) });
      daemon.change((d) => {
        for (const [writer, text] of [["unsigned", "50"], ["stranger", stranger]] as const) {
          const title = leaseEpochSlotUri(group, writer);
          (d.tiddlers as Record<string, unknown>)[title] = { tiddler: { title, text } };
        }
      });
      await repo.flush();
    });
    const out = (await roll()) as { effective: number; rolled: number; frontier: number };
    expect(out).toMatchObject({ effective: 0, rolled: 1, frontier: 1 });
    expect((await loadFaceAnchorOfGroup(group))!.frontier.leaseEpoch).toBe(1);
    const slots = await slotsOf(group);
    const authorize = () => true;
    expect(signedLeaseEpoch(group, ["50", ...slots.filter((s) => s.startsWith("{"))], (w) => w !== "ab".repeat(32) && authorize()), "the unsigned 50 and the stranger's 40 never counted").toBe(1);
  }, 120_000);

  it("RED: a roll never reads below the epoch this device's sealed anchor accepted, so an older replica cannot sign a roll that stales nothing; CONTROL: the roll climbs from the floor", async () => {
    await setup(true);
    const group = (await loadIdentityAnchors(0))!.personaGroupId;
    const anchor = (await loadFaceAnchorOfGroup(group))!;
    await keepFaceAnchorOfGroup(raiseFaceFrontier(anchor, { leaseEpoch: 5 }));       // this device accepted epoch 5; the daemon replica shows no slot
    const out = (await roll()) as { effective: number; rolled: number; frontier: number };
    expect(out).toMatchObject({ effective: 5, rolled: 6, frontier: 6 });
    expect((await loadFaceAnchorOfGroup(group))!.frontier.leaseEpoch).toBe(6);
  }, 120_000);

  it("CONTROL: a second advance climbs by one and the anchor follows", async () => {
    await setup(true);
    const group = (await loadIdentityAnchors(0))!.personaGroupId;
    await roll();
    const out = (await roll()) as { effective: number; rolled: number; frontier: number };
    expect(out).toMatchObject({ effective: 1, rolled: 2, frontier: 2 });
    expect((await loadFaceAnchorOfGroup(group))!.frontier.leaseEpoch).toBe(2);
  }, 120_000);

  it("a face with no verified KEL lineage refuses by name and writes nothing", async () => {
    await setup(false);
    const out = (await roll()) as { refused?: string; refusal?: string };
    expect(JSON.stringify(out)).toMatch(/no face|no sealed anchor|lineage/);
  }, 120_000);
});
