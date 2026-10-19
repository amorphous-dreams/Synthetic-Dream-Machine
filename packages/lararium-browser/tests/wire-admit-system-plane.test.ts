/**
 * The admit ingest wire: the browser vessel passes its Nexus identity to `admittedCanonDocs`, so a system
 * plane named under a canon title never reaches the crossing. The vessel runs for real; the admit ceremony is
 * a fake beneath it (`wire-vessel-rig`). The input is a derived per-Nexus board url:
 * only the `nexusPubkey` argument rejects it, so dropping that argument at the call site reds this file.
 * The vector observes the argument at the `hearthCrossingOf` input because the crossing re-filters with
 * `nexusPubkey` itself, so the call-site argument has no other in-memory witness.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import { LARES_DOC_URI, LARARIUM_DOC_URI, admittedJoineeIsland, crossroadsDocUrl } from "@lararium/mesh";
import { BootHalted, admitNaming, bootOptions, observed, resetObserved } from "./wire-vessel-rig.js";
import { openBrowserVessel } from "../src/open-browser-vessel.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";

vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return { ...(await orig<object>()), runApplyAdmitPayload: async () => rig.fakeAdmitResult() };
});
vi.mock("../src/hearth-canon.js", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  const real = await orig<typeof import("../src/hearth-canon.js")>();
  return { ...real, hearthCrossingOf: (at: Parameters<typeof real.hearthCrossingOf>[0]) => { rig.observed.crossingInputs.push({ ...at }); return real.hearthCrossingOf(at); } };
});

const hearth = "cd".repeat(32);
const nexusOf = admittedJoineeIsland({ hearthGatePubKey: hearth, hearthIslandKind: "anchor", hearthIslandScope: hearth, ownVesselKey: "ef".repeat(32) });

async function bootCarrying(canon: Record<string, string>): Promise<Record<string, unknown>> {
  resetObserved();
  const options = bootOptions(admitNaming(hearth, canon), null);
  await bindSyntheticBrowserCustodySlot(options.idbName!);
  await expect(openBrowserVessel(options)).rejects.toBeInstanceOf(BootHalted);
  expect(observed.crossingInputs, "the vessel reached its crossing decision").toHaveLength(1);
  return observed.crossingInputs[0]!;
}

afterEach(() => resetObserved());

describe("the browser admit ingest wire", () => {
  test("a derived Nexus board named under a canon title falls out before the crossing; the other canon title survives", async () => {
    const board = crossroadsDocUrl(nexusOf);
    const lararium = generateAutomergeUrl();
    const input = await bootCarrying({ [LARES_DOC_URI]: board, [LARARIUM_DOC_URI]: lararium });
    expect(input.hearthCanonDocs).not.toHaveProperty(LARES_DOC_URI);
    expect(input.hearthCanonDocs).toEqual({ [LARARIUM_DOC_URI]: lararium });
  });

  test("CONTROL: ordinary canon document addresses reach the crossing untouched", async () => {
    const plain = { [LARES_DOC_URI]: generateAutomergeUrl(), [LARARIUM_DOC_URI]: generateAutomergeUrl() };
    const input = await bootCarrying(plain);
    expect(input.hearthCanonDocs).toEqual(plain);
  });
});
