/**
 * e2e/leaf-sibling-sync — leaf kind 3: devices of ONE PersonaGroup, with NO listening vessel among them, sync
 * through a live HERM (`lar:///ha.ka.ba/lares/docs/pono/identity-slot-policy#/the-leaf-taxonomy`).
 *
 * The herm stands as its relay: the carriage crossroads a herm vessel stands on its pinned port
 * (`startCarriageRelay`, the one composition `open-node-vessel` calls), on a real socket. Its sight is witnessed
 * through the relay's own seam: this suite passes the frame observer in (`onSiblingFrame`) and keeps every sibling
 * frame exactly as the herm carries it; no vessel boot path reads a switch that would log it. The leaves stand in
 * this process as bare repos: no storage, no listening socket, only the sibling channel. Each carries what an
 * enrolled leaf holds and nothing more — its own device key, the edge and the sealed PersonaGroup secret its root
 * handed it, and the group's persona-KEL. Each shares by the verdict a vessel runs: a sibling reaches the face's
 * own planes and the public boards, nothing else.
 *
 *   L1 — two siblings prove each other THROUGH the herm and sync a face-plane doc; a doc off the face's planes
 *        stays home. The herm's whole sight, read DECODED, holds no byte of the doc, no edge field, no root key.
 *   L2 — an impostor holding a leaked secret but an edge a stranger root signed reaches the channel and is
 *        refused, the refusal surfacing; it never holds a sibling's doc, nor a sibling its doc. A non-member
 *        holding no secret meets nobody at all.
 *   L3 — a stranger without the knock path meets silence: no HTTP 101 on the herm's relay port.
 *   L4 — a sibling a rotation left stale catches up off the herms' successor drops — a plain request on each
 *        herm's relay port, apart from every proven socket — and the pair syncs under the head. The KEL never
 *        rides the sibling channel, and the rotation's enrolments ride it sealed and attested, so the herm's
 *        sight of the channel holds no event and no edge.
 *   L5 — a herm that accepts a connection and never answers, pinned FIRST or LAST beside the live herm, costs the
 *        stale leaf its deadline and no more: the leaf catches up off the live herm, pairs, and names the silent
 *        herm as `relay`.
 *
 * The headline's mutation proof: a proof that refuses every sibling (`openProof` answering a refusal) leaves L1
 * red — the doc never arrives, so the sync rides the proof and nothing else.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import * as net from "node:net";
import { Repo, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { freePort, pinnedCarriageRelay } from "../harness/instance.js";
import { startCarriageRelay, type CarriageRelay } from "../../packages/lararium-node/src/carriage-relay.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../../packages/lararium-mesh/src/auth-wire.js";
import { base64UrlEncode } from "../../packages/lararium-mesh/src/crypto.js";
import type { PersonaKelEvent } from "../../packages/lararium-mesh/src/persona-kel.js";
import { provisionThresholdRecoveryAtFounding, attestAndRotate } from "../../packages/lararium-mesh/src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../../packages/lararium-mesh/src/recovery-registration.js";
import { knockedUrl, pinnedRelayAddress } from "../../packages/lararium-mesh/src/gate-knock.js";
import { DeterministicFederationGate, federationShareDecision, shareConfigOf } from "../../packages/lararium-mesh/src/federation-gate.js";
import { makePersonaGroupIdentityRing } from "../../packages/lararium-mesh/src/persona-group-ring.js";
import {
  enrolDevice, rollEnrolments, leafStandingUnder, groupSecretOpenerFromSeed, type PersonaGroupEnrolment,
} from "../../packages/lararium-mesh/src/persona-group-secret.js";
import { SiblingNetworkAdapter, dialSiblingHerm, siblingKelDropsOf, type SiblingRefusal } from "../../packages/lararium-mesh/src/sibling-channel.js";
import { httpPersonaKelDropHerm, personaKelDropName } from "../../packages/lararium-mesh/src/persona-kel-drop.js";
import { carriedReads } from "../../packages/lararium-mesh/tests/fixtures/sibling-fleet.js";

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
      return { deviceKey: key, sign, kel: k, standing: presents ? { held: standing.held.map((h) => ({ ...h, edge: presents })) } : standing };
    },
    transports: [() => dialSiblingHerm({ address: relayUrl, deviceKey: key, sign })],
    drops: siblingKelDropsOf(drops.map((a) => httpPersonaKelDropHerm(a))),
    onRefusal: (r) => refusals.push(r),
    retryInterval: 500,
  });
  const ring = makePersonaGroupIdentityRing({
    governs: (id) => planes.has(id), provenVesselKey: () => null,
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
  test("L1: two siblings prove each other through the herm and sync a face-plane doc; the herm reads none of it", async () => {
    const x = await standLeaf(seed(111), await enrol(ROOT, seed(111)), [inception]);
    const y = await standLeaf(seed(112), await enrol(ROOT, seed(112)), [inception]);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "both siblings to stand as peers");
      expect(x.adapter.provenKeyOf(peersOf(x)[0]!)).toBe(y.key);
      expect(y.adapter.provenKeyOf(peersOf(y)[0]!)).toBe(x.key);
      const LINE = "a sibling's line, carried sealed by a herm that reads none of it";
      const handle = planeDoc(x, LINE);
      expect(await reach(y, handle.url, 20_000)).toBe(LINE);
      // A doc off the face's planes — the vessel's own @daemon stand-in — stays home.
      const daemon = x.repo.create<{ line: string }>({ line: "x's own @daemon" });
      expect(await reach(y, daemon.url)).toBe("withheld");
      expect([...x.refusals, ...y.refusals]).toEqual([]);

      // CARRY ⊥ READ through the live herm, read DECODED: its whole sight holds no byte of the line, no edge
      // field, no root key — in any frame's base64url, hex or nested JSON.
      const carried = sight();
      expect(carried.length, "the herm witnessed the frames it carried").toBeGreaterThan(4);
      for (const secret of ["reads none of it", "personaRootDid", "device-delegation", await pubOf(ROOT)]) {
        expect(carriedReads(carried, secret), `the herm read ${secret.slice(0, 16)}`).toBe(false);
      }
      // CONTROL on the instrument: the same scan finds a line hidden beside a seal in the herm's own sight shape.
      const hidden = JSON.stringify({ channels: [], from: x.key, to: y.key, frame: { t: "seal", s: { n: "AAAA", c: "BBBB", p: base64UrlEncode(new TextEncoder().encode(LINE)) } } });
      expect(carriedReads([hidden], "reads none of it")).toBe(true);
    } finally {
      await x.repo.shutdown(); await y.repo.shutdown();
    }
  });

  test("L2: an impostor is refused and never holds a sibling's doc; a non-member meets nobody", async () => {
    const x = await standLeaf(seed(121), await enrol(ROOT, seed(121)), [inception]);
    // The impostor holds the secret (a leak, sealed to it) but presents an edge a stranger root signed.
    const z = await standLeaf(seed(122), await enrol(ROOT, seed(122)), [inception], (await enrol(STRANGER, seed(122))).edge);
    try {
      await until(() => x.refusals.length > 0, "the impostor's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", peerKey: z.key, reason: expect.stringMatching(/not licensed by this PersonaGroup's KEL head/) });
      expect(peersOf(x)).toEqual([]);
      // The impostor never holds x's face-plane doc, and x never takes the impostor's.
      const xs = planeDoc(x, "x's plane, never the impostor's to hold");
      const zs = planeDoc(z, "the impostor's line");
      expect(await reach(z, xs.url)).toBe("withheld");
      expect(await reach(x, zs.url)).toBe("withheld");
    } finally {
      await x.repo.shutdown(); await z.repo.shutdown();
    }
    // A non-member — an edge and a secret its own root minted, which this group's KEL seats nowhere — holds no
    // secret of this group's, computes none of its channel tags and meets nobody: no peer, no refusal at w.
    const w = await standLeaf(seed(123), await enrol(ROOT, seed(123)), [inception]);
    const outsider = await standLeaf(seed(124), await enrolDevice({ opSeed: STRANGER, prefix: inception.prefix, deviceVerifyingKey: await pubOf(seed(124)), hearthTrueName: "", boundEpoch: 0 }), [inception]);
    try {
      await new Promise((r) => setTimeout(r, 2000));
      expect(peersOf(w)).toEqual([]);
      expect(w.refusals).toEqual([]);
      expect(peersOf(outsider)).toEqual([]);
    } finally {
      await w.repo.shutdown(); await outsider.repo.shutdown();
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

  test("L4: a sibling a rotation left stale catches up off the herms' drops, and the pair syncs under the head", async () => {
    const rotated = await rotatedChain();
    const sightBefore = sight().length;
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
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the caught-up pair to stand");
      expect(y.adapter.kel.map((e) => e.eventCid)).toEqual(rotated.map((e) => e.eventCid));
      const handle = planeDoc(x, "across the rotation");
      expect(await reach(y, handle.url, 20_000)).toBe("across the rotation");
      expect([...x.refusals, ...y.refusals]).toEqual([]);
      // The KEL never rode the sibling channel: the herm's sight holds no event of it, no edge field and no
      // rotated root key.
      for (const secret of ["personaRootDid", rotated[1]!.eventCid, await pubOf(ROTATED)]) {
        expect(carriedReads(sight().slice(sightBefore), secret), `the herm read ${secret.slice(0, 16)}`).toBe(false);
      }
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
          await until(() => y.adapter.kel.length === 2 && peersOf(x).length === 1 && peersOf(y).length === 1, `the stale leaf caught up and paired (${order[0] === hungUrl ? "hung first" : "hung last"})`);
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
