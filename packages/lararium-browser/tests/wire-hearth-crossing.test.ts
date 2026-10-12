/**
 * The hearth crossing wire: the gate the browser vessel installs for its relay is the one its crossing decision
 * returns. Under a FOREIGN pin the admitted canon document stays behind the gate and a public Nexus board
 * crosses; under the own-hearth pin the admitted canon document crosses too. The vessel runs for real; the
 * admit ceremony, the relay transport and the Repo's share-policy factory are fakes beneath it
 * (`wire-vessel-rig`). The verdict is read from the policy the vessel's Repo consults at each decision.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId } from "@automerge/automerge-repo";
import { LARES_DOC_URI, LARARIUM_DOC_URI, admittedJoineeIsland, crossroadsDocUrl } from "@lararium/mesh";
import { BootHalted, admitNaming, bootOptions, observed, relayPeerArrives, resetObserved } from "./wire-vessel-rig.js";
import { openBrowserVessel } from "../src/open-browser-vessel.js";

vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return { ...(await orig<object>()), runApplyAdmitPayload: async () => rig.fakeAdmitResult() };
});
vi.mock("../../lararium-mesh/src/lar-ws-client-adapter.ts", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return { ...(await orig<object>()), LarWSClientAdapter: rig.FakeRelayAdapter };
});
vi.mock("../../lararium-mesh/src/federation-gate.ts", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  const real = await orig<typeof import("../../lararium-mesh/src/federation-gate.ts")>();
  return {
    ...real,
    shareConfigOf: (...args: Parameters<typeof real.shareConfigOf>) => {
      rig.observed.policies.push(args[0] as never);
      return real.shareConfigOf(...args);
    },
  };
});

const hearth = "cd".repeat(32);
const foreign = "ef".repeat(32);
const nexusOf = admittedJoineeIsland({ hearthGatePubKey: hearth, hearthIslandKind: "anchor", hearthIslandScope: hearth, ownVesselKey: "01".repeat(32) });
const canonUrl = generateAutomergeUrl();
const named = { [LARES_DOC_URI]: canonUrl, [LARARIUM_DOC_URI]: generateAutomergeUrl() };
const docIdOf = (url: string) => interpretAsDocumentId(url as AutomergeUrl) as DocumentId;

/** Boot an admit of `hearth` that dials `pin`, then ask the vessel's installed policy about one relay peer. */
async function verdictsUnderPin(pin: string): Promise<{ canon: boolean; board: boolean }> {
  resetObserved();
  await expect(openBrowserVessel(bootOptions(admitNaming(hearth, named), pin))).rejects.toBeInstanceOf(BootHalted);
  relayPeerArrives("wire-relay-peer");
  const policy = observed.policies[0];
  expect(policy, "the vessel's Repo registered its share policy").toBeTypeOf("function");
  return {
    canon: await policy!("wire-relay-peer" as never, docIdOf(canonUrl)),
    board: await policy!("wire-relay-peer" as never, docIdOf(crossroadsDocUrl(nexusOf))),
  };
}

afterEach(() => resetObserved());

describe("the browser crossing gate wire", () => {
  test("a foreign pin denies the admitted canon document and allows a public Nexus board", async () => {
    expect(await verdictsUnderPin(foreign)).toEqual({ canon: false, board: true });
  });

  test("CONTROL: the own-hearth pin allows the admitted canon document and the public board", async () => {
    expect(await verdictsUnderPin(hearth)).toEqual({ canon: true, board: true });
  });
});
