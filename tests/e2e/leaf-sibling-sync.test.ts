/**
 * e2e/leaf-sibling-sync — leaf kind 3: devices of ONE PersonaGroup, with NO listening vessel among them, and a live
 * HERM (`lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy`).
 *
 * THE SIBLING WS ROUTE SHIPS SHUT (the shut-routes house ruling, stable-founding-road #/rulings): the herm's relay
 * port destroys every upgrade before any 101, and the sibling dial refuses by name. What stands, proven here on real
 * sockets, is the HTTP drop floor and the refusal itself:
 *
 *   L1 — two enrolled siblings beside a live herm never pair: the sibling dial rejects by name, no peer stands, no
 *        doc crosses, and the herm's sight holds not one frame. A route that reopened silently would pair them and
 *        fail this.
 *   L2 — an impostor, a non-member and a member all meet the same shut: no peer, no refusal of a sibling, nothing
 *        carried. The shut grants no silent authority to any of them.
 *   L3 — a stranger without the knock path meets silence on the herm's relay port, and the pinned knock draws NO
 *        upgrade either: the relay's WS route is destroyed before the 101.
 *   L4 — a sibling a rotation left stale catches up off the herms' successor drops — a plain request on each herm's
 *        relay port, apart from every proven socket — and stands under the head. The KEL rides no sibling channel.
 *   L5 — a herm that accepts a connection and never answers, pinned FIRST or LAST beside the live herm, costs the
 *        stale leaf its deadline and no more: the leaf catches up off the live herm and names the silent herm as
 *        `relay`.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as net from "node:net";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { freePort, pinnedCarriageRelay } from "../harness/instance.js";
import { startCarriageRelay, type CarriageRelay } from "../../packages/lararium-node/src/carriage-relay.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../../packages/lararium-mesh/src/ed25519-door.js";
import type { PersonaKelEvent } from "../../packages/lararium-mesh/src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../../packages/lararium-mesh/src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../../packages/lararium-mesh/src/recovery-registration.js";
import { knockSegment } from "../../packages/lararium-mesh/src/gate-bundle.js";
import { countersignDeviceDelegation } from "../../packages/lararium-mesh/src/device-delegation.js";
import { pinnedRelayAddress } from "../../packages/lararium-mesh/src/persona-kel-drop.js";
import { DeterministicFederationGate, federationShareDecision, shareConfigOf } from "../../packages/lararium-mesh/src/federation-gate.js";
import { makePersonaGroupIdentityRing } from "../../packages/lararium-mesh/src/persona-group-ring.js";
import {
  enrolDevice, rollEnrolments, leafStandingUnder, groupSecretOpenerFromSeed, type PersonaGroupEnrolment,
} from "../../packages/lararium-mesh/src/persona-group-secret.js";
import { SiblingNetworkAdapter, dialSiblingHerm, siblingKelDropsOf, SIBLING_ROUTE_SHUT, type SiblingRefusal } from "../../packages/lararium-mesh/src/sibling-channel.js";
import { httpPersonaKelDropHerm, personaKelDropName } from "../../packages/lararium-mesh/src/persona-kel-drop.js";

const pubOf    = (s: Uint8Array) => ed25519VerifyingKeyFromSeed(s);
const didOf    = async (s: Uint8Array) => `0x${await pubOf(s)}`;
const seed     = (b: number) => new Uint8Array(32).fill(b);
const ROOT     = seed(101);                            // the PersonaGroup's persona root (the KEL's founding op-key)
const ROTATED  = seed(106);                            // the op-key a rotation seats
const STRANGER = seed(102);
const GUARDIANS = [seed(103), seed(104), seed(105)];
const NEXUS    = "4e".repeat(32);

let herm: CarriageRelay | null = null;
/** A second herm the leaves pin for their drops alone. */
let second: CarriageRelay | null = null;
let secondUrl = "";
let relayUrl = "";
let relayPort = 0;
let inception: PersonaKelEvent;
let guardianKeys: string[] = [];
/** The herm's whole sight of the sibling channels: every frame it carried, as it carried it. */
const carriedByHerm: string[] = [];

interface Leaf { repo: Repo; adapter: SiblingNetworkAdapter; refusals: SiblingRefusal[]; key: string; planes: Set<DocumentId> }

/** The face's own planes — one set every leaf of the group derives alike, as each vessel resolves its face's
 *  plane docs off its own catalog. */
const FACE_PLANES = new Set<DocumentId>();

/**
 * A leaf of the group: a repo whose only network is the sibling channel through the herm, sharing by the verdict
 * a vessel runs — the ring's sibling path (this face's planes) over the public boards.
 */
async function standLeaf(
  device: Uint8Array, enrolment: PersonaGroupEnrolment, kel: readonly PersonaKelEvent[], presents?: PersonaGroupEnrolment["edge"],
  drops: readonly string[] = [relayUrl, secondUrl],
): Promise<Leaf> {
  const key = await pubOf(device);
  const sign = ed25519SignerFromSeed(device);
  const refusals: SiblingRefusal[] = [];
  const planes = FACE_PLANES;
  const adapter: SiblingNetworkAdapter = new SiblingNetworkAdapter({
    kel,
    leaf: async (k) => {
      const standing = await leafStandingUnder({ kel: k, deviceKey: key, enrolment, open: groupSecretOpenerFromSeed(device) });
      // A presented root half rides countersigned by this device's own key, as every held enrolment's edge does.
      const shown = presents ? await countersignDeviceDelegation(presents, sign) : null;
      return { deviceKey: key, sign, kel: k, standing: shown ? { held: standing.held.map((h) => ({ ...h, edge: shown })) } : standing };
    },
    transports: [() => dialSiblingHerm({ address: relayUrl, deviceKey: key, sign })],
    drops: siblingKelDropsOf(drops.map((a) => httpPersonaKelDropHerm(a))),
    onRefusal: (r) => refusals.push(r),
    retryInterval: 500,
  });
  const ring = makePersonaGroupIdentityRing({
    governs: (id) => planes.has(id), provenVesselKey: () => null, deviceAside: () => false,
    siblingKeyOf: (peerId) => adapter.provenKeyOf(peerId), grants: { records: () => [], verify: async () => false },
  });
  const gate = ring.composeSiblings(new DeterministicFederationGate(NEXUS));
  const repo = new Repo({
    network: [adapter],
    shareConfig: shareConfigOf((peerId, documentId) => federationShareDecision(new Set(), null, peerId, documentId, {
      isSibling: (p) => Boolean(adapter.provenKeyOf(p as PeerId)), gate: () => gate,
    })),
  });
  adapter.bindRepo(repo);
  return { repo, adapter, refusals, key, planes };
}

/** A doc this leaf holds on its face's own plane — the class of doc a sibling may reach. */
function planeDoc(l: Leaf, line: string) {
  const h = l.repo.create<{ line: string }>({ line });
  l.planes.add(interpretAsDocumentId(h.url));
  return h;
}

async function until(cond: () => boolean, label: string, ms = 20_000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}
/** A find that settles: the doc's line, or "withheld" when no peer hands it over. */
async function reach(l: Leaf, url: string, ms = 3000): Promise<string> {
  const found = l.repo.find<{ line: string }>(url as AutomergeUrl).then((h) => h.doc()?.line ?? "empty", () => "withheld");
  return Promise.race([found, new Promise<string>((r) => setTimeout(() => r("withheld"), ms))]);
}
const peersOf = (l: Leaf): PeerId[] => l.repo.peers;
const sight = (): string[] => [...carriedByHerm];
const enrol = async (root: Uint8Array, device: Uint8Array) =>
  enrolDevice({ opSeed: root, prefix: inception.prefix, deviceVerifyingKey: await pubOf(device), hearthTrueName: "", boundEpoch: 0 });

beforeAll(async () => {
  guardianKeys = await Promise.all(GUARDIANS.map(pubOf));
  const slots = ["mine", "guardian-a", "guardian-b"] as const;
  inception = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: await didOf(ROOT),
    guardians: guardianKeys.map((k, i) => guardianRecoveryRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  }).inception;

  const portRelay = await freePort();
  const relay = await pinnedCarriageRelay(portRelay);
  relayUrl = relay.url;
  relayPort = portRelay;
  herm = await startCarriageRelay({
    gateSeed: Uint8Array.from(Buffer.from(relay.seedHex, "hex")), port: portRelay,
    onSiblingFrame: (carried) => { carriedByHerm.push(JSON.stringify(carried)); },
  });
  if (herm.gatePubKey !== relay.gatePubKey) throw new Error("the herm's relay stood under another gate key than the pin");
  const portSecond = await freePort();
  const pinSecond = await pinnedCarriageRelay(portSecond);
  secondUrl = pinSecond.url;
  second = await startCarriageRelay({ gateSeed: Uint8Array.from(Buffer.from(pinSecond.seedHex, "hex")), port: portSecond });
});

afterAll(async () => { await herm?.close(); await second?.close(); });

describe("leaf kind 3 — siblings sync through a herm with no listening vessel", () => {
  test("L1: two siblings beside a live herm never pair; the sibling dial refuses by name and the herm carries nothing", async () => {
    await expect(dialSiblingHerm({ address: relayUrl, deviceKey: "aa".repeat(32), sign: ed25519SignerFromSeed(seed(110)) })).rejects.toThrow(SIBLING_ROUTE_SHUT);
    const x = await standLeaf(seed(111), await enrol(ROOT, seed(111)), [inception]);
    const y = await standLeaf(seed(112), await enrol(ROOT, seed(112)), [inception]);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      expect(peersOf(x)).toEqual([]);
      expect(peersOf(y)).toEqual([]);
      const handle = planeDoc(x, "a line no shut route may carry");
      expect(await reach(y, handle.url)).toBe("withheld");
      expect([...x.refusals, ...y.refusals].filter((r) => r.suspect === "peer")).toEqual([]);
      expect(sight(), "the herm carried not one sibling frame").toEqual([]);
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  });

  test("L2: an impostor, a non-member and a member meet the same shut: no peer, no sibling refusal, nothing carried", async () => {
    const x = await standLeaf(seed(121), await enrol(ROOT, seed(121)), [inception]);
    // The impostor holds the secret (a leak, sealed to it) but presents an edge a stranger root signed.
    const z = await standLeaf(seed(122), await enrol(ROOT, seed(122)), [inception], (await enrol(STRANGER, seed(122))).edge);
    const outsider = await standLeaf(seed(124), await enrolDevice({ opSeed: STRANGER, prefix: inception.prefix, deviceVerifyingKey: await pubOf(seed(124)), hearthTrueName: "", boundEpoch: 0 }), [inception]);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      for (const l of [x, z, outsider]) {
        expect(peersOf(l)).toEqual([]);
        expect(l.refusals.filter((r) => r.suspect === "peer")).toEqual([]);
      }
      const xs = planeDoc(x, "x's plane, never the impostor's to hold");
      expect(await reach(z, xs.url)).toBe("withheld");
      expect(sight()).toEqual([]);
    } finally {
      await x.repo.shutdown(); await z.repo.shutdown(); await outsider.repo.shutdown();
    }
  });

  test("L3: a stranger meets silence on the herm's relay port, and the pinned knock draws no upgrade either", async () => {
    const upgrades = (url: string) => new Promise<boolean>((resolve) => {
      const raw = new WebSocket(url);
      raw.addEventListener("open", () => { raw.close(); resolve(true); });
      raw.addEventListener("error", () => resolve(false));
      raw.addEventListener("close", () => resolve(false));
    });
    expect(await upgrades(`ws://127.0.0.1:${relayPort}/`)).toBe(false);
    // The shut is total: the knock the pinned gate key derives draws NO upgrade either.
    const pin = pinnedRelayAddress(relayUrl);
    const knocked = new URL(pin.url);
    knocked.pathname = `${knocked.pathname.replace(/\/+$/, "")}/${knockSegment(pin.gatePubKey, knocked.pathname)}`;
    expect(await upgrades(knocked.href)).toBe(false);
  });

  /** The ONE rotation this suite's KEL makes, re-enrolling both leaves: a second rotation at the same seat would
   *  fork the KEL, which no reader settles. */
  let rotation: PersonaKelEvent | null = null;
  async function rotatedChain(): Promise<PersonaKelEvent[]> {
    if (!rotation) {
      const devices = await Promise.all([seed(131), seed(132)].map(async (d) => ({ deviceVerifyingKey: await pubOf(d), hearthTrueName: "", boundEpoch: 0 })));
      const rot = await attestAndRotate({
        head: inception, freshOpKeyDid: await didOf(ROTATED), guardianRecoveryKeys: guardianKeys, recoveryThreshold: 2,
        guardianSigners: await Promise.all(GUARDIANS.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: ed25519SignerFromSeed(s) }))),
        enrolments: await rollEnrolments({ prefix: inception.prefix, opSeed: ROTATED, devices }),
      });
      if (!rot.ok) throw new Error(rot.reason);
      rotation = rot.event;
    }
    return [inception, rotation];
  }

  test("L4: a sibling a rotation left stale catches up off the herms' drops and stands under the head", async () => {
    const rotated = await rotatedChain();
    // x carries the rotation and deposits it at both herms on its dial. y wakes stale, and pulls the move off a
    // herm before it joins — here the second herm, which carries no sibling channel at all.
    const x = await standLeaf(seed(131), await enrol(ROOT, seed(131)), rotated);
    const atSecond = httpPersonaKelDropHerm(secondUrl);
    for (let i = 0; i < 200; i++) {
      if ((await atSecond.pull(personaKelDropName(inception.eventCid, atSecond.gatePubKey))).length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const y = await standLeaf(seed(132), await enrol(ROOT, seed(132)), [inception], undefined, [secondUrl]);   // stale
    try {
      await until(() => y.adapter.kel.length === rotated.length, "the stale sibling to catch up off the drops");
      expect(y.adapter.kel.map((e) => e.eventCid)).toEqual(rotated.map((e) => e.eventCid));
      expect(sight(), "the KEL rode no sibling channel: the herm carried nothing").toEqual([]);
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  });

  test("L5: a herm that never answers, first or last among the pins, costs the stale leaf its deadline and no more", async () => {
    const sockets: net.Socket[] = [];
    const hung = net.createServer((s) => { sockets.push(s); });
    await new Promise<void>((r) => hung.listen(0, "127.0.0.1", r));
    const hungUrl = `ws://127.0.0.1:${(hung.address() as net.AddressInfo).port}#${"c3".repeat(32)}`;
    try {
      const chain = await rotatedChain();
      for (const order of [[hungUrl, secondUrl], [secondUrl, hungUrl]]) {
        const x = await standLeaf(seed(131), await enrol(ROOT, seed(131)), chain, undefined, [secondUrl]);
        const atSecond = httpPersonaKelDropHerm(secondUrl);
        for (let i = 0; i < 200; i++) {
          if ((await atSecond.pull(personaKelDropName(inception.eventCid, atSecond.gatePubKey))).length > 0) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        const y = await standLeaf(seed(132), await enrol(ROOT, seed(132)), [inception], undefined, order);   // stale
        try {
          await until(() => y.adapter.kel.length === 2, `the stale leaf caught up (${order[0] === hungUrl ? "hung first" : "hung last"})`);
          expect(y.refusals.some((r) => r.suspect === "relay" && /c3c3c3c3… answered no drop/.test(r.reason))).toBe(true);
        } finally {
          await x.repo.shutdown(); await y.repo.shutdown();
        }
      }
    } finally {
      for (const s of sockets) s.destroy();
      await new Promise<void>((r) => hung.close(() => r()));
    }
  }, 60_000);
});
