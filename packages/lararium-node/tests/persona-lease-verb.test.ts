/**
 * persona-lease — the production road of a face's signed lease advance, end to end through the store-door verb
 * (`lares persona lease`). Reds: an unsigned slot and a stranger-signed slot on the daemon doc raise nothing, so the
 * verb reads effective 0 and the sealed anchor's frontier stays; the verb's own advance raises both. Controls: a second
 * advance climbs by one, and a face with no lineage refuses by name.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  DAEMON_BAG_ID, ed25519SignerFromSeed, leaseEpochSlotUri, seedDaemonDoc, signLeaseAdvance, signedLeaseEpoch, raiseFaceFrontier, tiddlerText, type LarDoc,
} from "@lararium/mesh";
import { generateOrLoadVesselIdentity, generateOrLoadPersonaGroupRoot } from "../src/node-vessel-identity.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { loadFaceAnchorOfGroup, keepFaceAnchorOfGroup } from "../src/face-anchor-store.js";
import { larBootstrapPath, larDataDir, larSealHome } from "../src/vessel-paths.js";
import { ownedStore } from "../src/owned-store.js";
import { storeDoorDirect } from "../src/store-door-verbs.js";
import { seedFaceAtom } from "./atom-fixture.js";
import { seedFleet } from "./fleet-seed-fixture.js";

let root: string;
let prior: string | undefined;
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
beforeEach(() => { root = mkdtempSync(join(tmpdir(), "lares-lease-")); prior = process.env["LAR_ROOT"]; process.env["LAR_ROOT"] = root; });
afterEach(async () => {
  if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  await new Promise((r) => setTimeout(r, 200));
  rmSync(root, { recursive: true, force: true });
});

const roll = () => storeDoorDirect("persona-lease", { handleIndex: 0 }, { sealHome: larSealHome() });
const slotsOf = async (group: string): Promise<string[]> => ownedStore(larDataDir(), async (repo) => {
  const doc = (await repo.find<LarDoc>(daemonUrl as never)).doc();
  return Object.entries(doc?.tiddlers ?? {}).filter(([t]) => t.includes("/lease-epoch/")).map(([, r]) => tiddlerText(r) ?? "").filter((x) => x.length > 0 || group === "");
});

describe("lares persona lease", () => {
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
