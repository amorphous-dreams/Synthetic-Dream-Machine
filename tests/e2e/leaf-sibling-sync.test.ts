/**
 * e2e/leaf-sibling-sync — leaf kind 3: two devices of ONE PersonaGroup, with NO listening vessel among them, sync
 * a document through a live HERM (`lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy`).
 *
 * The herm stands as a real vessel (`LAR_RECIPE=herm`, its carriage crossroads on its own pinned port), booted
 * from dist like every staged vessel. The two leaves stand in this process as bare repos: no storage, no
 * listening socket, only the sibling channel. Each carries what a leaf holds and nothing more — its own device
 * key, its own edge signed by the PersonaGroup's root, and the group's persona-KEL.
 *
 *   L1 — the two siblings prove each other THROUGH the herm and sync a doc; each names the other's device key
 *   L2 — an impostor whose edge a stranger root signed reaches the same channel through the same herm, and is
 *        refused by a sibling, the refusal surfacing; it becomes no peer and syncs nothing
 *   L3 — a stranger without the knock path meets silence: no HTTP 101 on the herm's relay port
 *
 * The headline's mutation proof: a proof that refuses every sibling (`openProof` answering a refusal) leaves L1
 * red — the doc never arrives, so the sync rides the proof and nothing else.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Repo, type AutomergeUrl, type PeerId } from "@automerge/automerge-repo";
import { openStaged, freePort, pinnedCarriageRelay, type LarInstance, type CliResult } from "../harness/instance.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../../packages/lararium-mesh/src/auth-wire.js";
import { buildDeviceDelegation, type DeviceDelegationTiddler } from "../../packages/lararium-mesh/src/device-delegation.js";
import type { PersonaKelEvent } from "../../packages/lararium-mesh/src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding } from "../../packages/lararium-mesh/src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../../packages/lararium-mesh/src/recovery-registration.js";
import { knockedUrl, pinnedRelayAddress } from "../../packages/lararium-mesh/src/gate-knock.js";
import type { LeafPeerSelf } from "../../packages/lararium-mesh/src/leaf-peer-proof.js";
import {
  SiblingNetworkAdapter, dialSiblingHerm, siblingChannelTag, type SiblingRefusal,
} from "../../packages/lararium-mesh/src/sibling-channel.js";

const pubOf    = (s: Uint8Array) => ed25519VerifyingKeyFromSeed(s);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const seed     = (b: number) => new Uint8Array(32).fill(b);
const GROUP    = "5e".repeat(32);                      // the PersonaGroup the siblings share
const ROOT     = seed(101);                            // its persona root (the KEL's founding op-key)
const STRANGER = seed(102);

let herm: LarInstance | null = null;
let relayUrl = "";
let relayPort = 0;
let kel: PersonaKelEvent[] = [];

async function edgeFor(root: Uint8Array, device: Uint8Array): Promise<DeviceDelegationTiddler> {
  return buildDeviceDelegation({ personaRootSeed: root, deviceVerifyingKey: await pubOf(device), hearthTrueName: "", boundEpoch: 0 });
}

interface Leaf { repo: Repo; adapter: SiblingNetworkAdapter; refusals: SiblingRefusal[]; key: string }

/** A leaf of the group: a repo whose only network is the sibling channel through the herm. */
async function standLeaf(device: Uint8Array, edgeRoot: Uint8Array): Promise<Leaf> {
  const key = await pubOf(device);
  const sign = ed25519SignerFromSeed(device);
  const self: LeafPeerSelf = { deviceKey: key, sign, edge: await edgeFor(edgeRoot, device), kel };
  const refusals: SiblingRefusal[] = [];
  const adapter = new SiblingNetworkAdapter({
    self,
    transport: () => dialSiblingHerm({ address: relayUrl, deviceKey: key, sign, channel: siblingChannelTag(GROUP) }),
    onRefusal: (r) => refusals.push(r),
    retryInterval: 500,
  });
  const repo = new Repo({ network: [adapter], sharePolicy: async () => true });
  return { repo, adapter, refusals, key };
}

async function until(cond: () => boolean, label: string, ms = 20_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

const peersOf = (l: Leaf): PeerId[] => l.repo.peers;

beforeAll(async () => {
  const guardianKeys = await Promise.all([seed(103), seed(104), seed(105)].map(pubOf));
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: await didOf(ROOT),
    guardians: guardianKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  });
  kel = [prov.inception];

  const [portHerm, portRelay] = await Promise.all([freePort(), freePort()]);
  const relay = await pinnedCarriageRelay(portRelay);
  relayUrl = relay.url;
  relayPort = portRelay;
  herm = await openStaged({
    tag: "sibling-herm", port: portHerm,
    daemonEnv: { LAR_RECIPE: "herm", LAR_HERM_RELAY_PORT: String(portRelay), LAR_HERM_RELAY_SEED: relay.seedHex },
    // A place, no face: the herm's own founding rite.
    found: async (cli: (a: readonly string[]) => Promise<CliResult>, root: string) => {
      const reset = await cli(["vessel", "clear", "--root", root, "--force", "--skip-build"]);
      if (reset.code !== 0) throw new Error(`herm: clear failed (${reset.code})\n${reset.stderr.slice(-800)}`);
    },
  });
});

afterAll(async () => { await herm?.stop(); });

describe("leaf kind 3 — siblings sync through a herm with no listening vessel", () => {
  test("L1: two siblings prove each other through the herm and sync a doc", async () => {
    const x = await standLeaf(seed(111), ROOT);
    const y = await standLeaf(seed(112), ROOT);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
      expect(x.adapter.provenKeyOf(peersOf(x)[0]!)).toBe(y.key);
      expect(y.adapter.provenKeyOf(peersOf(y)[0]!)).toBe(x.key);
      const handle = x.repo.create<{ line: string }>({ line: "a sibling's line, carried sealed by a herm that reads none of it" });
      const found = await y.repo.find<{ line: string }>(handle.url as AutomergeUrl);
      expect(found.doc()?.line).toBe("a sibling's line, carried sealed by a herm that reads none of it");
      expect([...x.refusals, ...y.refusals]).toEqual([]);
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  });

  test("L2: an impostor on the same channel through the same herm is refused, and the refusal surfaces", async () => {
    const x = await standLeaf(seed(121), ROOT);
    const z = await standLeaf(seed(122), STRANGER);
    try {
      await until(() => x.refusals.length > 0, "the impostor's refusal");
      expect(x.refusals[0]).toMatchObject({ peerKey: z.key, reason: expect.stringMatching(/not licensed by this PersonaGroup's KEL head/) });
      expect(peersOf(x)).toEqual([]);
      const handle = z.repo.create<{ line: string }>({ line: "the impostor's line" });
      expect(peersOf(z)).toEqual([]);
      void handle;
    } finally {
      await x.repo.shutdown(); await z.repo.shutdown();
    }
  });

  test("L3: a stranger without the knock path meets silence on the herm's relay port", async () => {
    const upgrades = (url: string) => new Promise<boolean>((resolve) => {
      const raw = new WebSocket(url);
      raw.addEventListener("open", () => { raw.close(); resolve(true); });
      raw.addEventListener("error", () => resolve(false));
      raw.addEventListener("close", () => resolve(false));
    });
    expect(await upgrades(`ws://127.0.0.1:${relayPort}/`)).toBe(false);
    // CONTROL: the knock the pinned gate key derives draws the upgrade on the same port.
    const pin = pinnedRelayAddress(relayUrl);
    expect(await upgrades(knockedUrl(pin.url, pin.gatePubKey))).toBe(true);
  });
});
