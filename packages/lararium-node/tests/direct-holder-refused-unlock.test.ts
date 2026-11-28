/**
 * direct-holder-refused-unlock — THE CLI'S DIRECT HOLDER NAMES A REFUSED UNLOCK (operator ruling 2026-11-09).
 *
 * A `lares` verb with no vessel standing holds the store itself (`ownedStore`) and stands the vessel's key on demand: the
 * secret home's custody row opens, and the state document beside it files. Where that open refuses, the act refuses by
 * name, carrying the custody's own reason; no empty stand-in stands in its place, and nothing it would write rests.
 *
 *   U1 — RED: custody locked, a direct-holder act needing state refuses `vessel-locked`, naming the locked custody
 *   U2 — RED: a place whose custody names no secret home (a herm) refuses `vessel-state-unnamed`
 *   U3 — CONTROL: custody open, the same act stands the state document itself
 */
import { describe, expect } from "vitest";
import { vesselStateRefusal, nameVesselState, standVesselState, VESSEL_LOCKED, VESSEL_STATE_UNNAMED } from "@lararium/mesh/vessel-state";
import { seedDaemonDoc } from "@lararium/mesh/social-seed";
import { mintVesselDocumentId } from "@lararium/mesh/secret-home";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { larDataDir } from "../src/vessel-paths.js";
import { ownedStore } from "../src/owned-store.js";
import { standVesselSecretHome } from "../src/secret-home-store.js";
import { seatCustody, seatedCustody } from "../src/custody-seat.js";
import { it } from "./support/scratch-fixture.js";

async function foundedDaemon(withFace: boolean): Promise<string> {
  await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
  return ownedStore(larDataDir(), async (repo) => {
    const daemon = seedDaemonDoc(repo);
    if (withFace) nameVesselState(daemon, (await standVesselSecretHome(repo)).stateUrl!);
    else nameVesselState(daemon, `automerge:${mintVesselDocumentId()}`);
    await repo.flush();
    return daemon.url;
  });
}

const standIn = (daemonUrl: string) => ownedStore(larDataDir(), async (repo) =>
  standVesselState(repo, await repo.find<LarDoc>(daemonUrl as never)));

describe("the CLI's direct holder names a refused unlock", () => {
  it("U1/U3 — RED: custody locked, a direct-holder act needing state refuses `vessel-locked` by the custody's reason; CONTROL: open, it stands the state document", async () => {
    const daemonUrl = await foundedDaemon(true);
    const opened = await standIn(daemonUrl);
    expect(vesselStateRefusal(opened)).toBeNull();
    // THE TERMINAL HANDS NO KEY: the holder locks and its seat carries no opener, as a command with no route meets it.
    const holder = seatedCustody()!;
    await holder.lock();
    seatCustody(holder);
    const refused = await standIn(daemonUrl).catch((e: unknown) => e);
    expect(refused).toMatchObject({ name: "VesselStateUnavailable", refusal: VESSEL_LOCKED });
    expect((refused as Error).message).toMatch(/vault unlock/);
  }, 60_000);

  it("U2 — RED: a place whose custody names no secret home refuses `vessel-state-unnamed`, never a stand-in", async () => {
    const daemonUrl = await foundedDaemon(false);
    const refused = await standIn(daemonUrl).catch((e: unknown) => e);
    expect(refused).toMatchObject({ name: "VesselStateUnavailable", refusal: VESSEL_STATE_UNNAMED });
    expect((refused as Error).message).toMatch(/names no secret home/);
  }, 60_000);
});
