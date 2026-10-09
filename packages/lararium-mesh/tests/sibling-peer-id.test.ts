/**
 * sibling-peer-id.test — a sibling stands under the repo peer id its PROVEN device key derives, and one id names
 * one carrier. A sibling that names another peer's id — the operator's own node, a relay peer — never inherits that
 * peer's verdict: the share decision reads sibling-ness first, and the channel refuses any id the key does not
 * derive or the repo already routes through another adapter.
 *
 * Proven, each red beside its control:
 *   · RED (live): a proven sibling whose repo runs under the operator node's peer id pulls nothing the sibling gate
 *     withholds — its messages ride the id its key derives, and the node's id stays the node's;
 *   · CONTROL: the same sibling under a fresh id is withheld the same doc and syncs a face-plane doc;
 *   · RED: a sibling that NAMES a peer id its key does not derive becomes no peer, said as `peer`;
 *   · RED: an id the repo already routes through another adapter gives the sibling no route, said as `route` on
 *     both sides; and an adapter that announces a standing sibling's id takes the route, the sibling leaving;
 *   · RED (the verdict alone): sibling-ness decides before the relay ring, and an id both claim denies.
 */
import { describe, test, expect } from "vitest";
import {
  Repo, NetworkAdapter, cbor, interpretAsDocumentId, type AutomergeUrl, type DocumentId, type Message, type PeerId,
} from "@automerge/automerge-repo";
import { federationShareDecision, shareConfigOf, DeterministicFederationGate, type SiblingShare } from "../src/federation-gate.js";
import { makePersonaGroupIdentityRing } from "../src/persona-group-ring.js";
import { personaKelBoardDocUrl } from "../src/deterministic-doc.js";
import {
  startLeafPeerProof, answerLeafPeerProof, finishLeafPeerProof, acceptLeafPeerProof,
  type LeafPeerSelf, type LeafPeerState, type LeafPeerSession, type LeafPeerFrame,
} from "../src/leaf-peer-proof.js";
import { SiblingNetworkAdapter, siblingPeerIdOf } from "../src/sibling-channel.js";
import {
  SEEDS, founded, enrol, leafUnder, leafOf, memoryRelay, standLeaf, until, sleep, peersOf, shutdown,
} from "./fixtures/sibling-fleet.js";

const NODE = "operator-node-peer" as PeerId;
const NEXUS = "4e".repeat(32);

/** An adapter standing for another carrier of x's repo (its own node, a relay peer): it announces the ids a test
 *  hands it and swallows what it is sent. */
class OtherCarrier extends NetworkAdapter {
  readonly sent: Message[] = [];
  constructor(private readonly onConnect: readonly PeerId[] = []) { super(); }
  isReady(): boolean { return true; }
  whenReady(): Promise<void> { return Promise.resolve(); }
  connect(peerId: PeerId): void { this.peerId = peerId; queueMicrotask(() => { for (const p of this.onConnect) this.announce(p); }); }
  announce(peerId: PeerId): void { this.emit("peer-candidate", { peerId, peerMetadata: {} }); }
  send(m: Message): void { this.sent.push(m); }
  disconnect(): void { /* nothing held */ }
}

/** x's verdict, as a browser vessel runs it: the carriers in `relayPeers` full-sync (its own node), a sibling
 *  reaches the face's planes alone. */
function siblingVerdict(relayPeers: ReadonlySet<string>, planes: Set<DocumentId>, adapterOf: () => SiblingNetworkAdapter | null) {
  const ring = makePersonaGroupIdentityRing({
    governs: (id) => planes.has(id), provenVesselKey: () => null,
    siblingKeyOf: (peerId) => adapterOf()?.provenKeyOf(peerId) ?? null, grants: { records: () => [], verify: async () => false },
  });
  const gate = ring.composeSiblings(new DeterministicFederationGate(NEXUS));
  const siblings: SiblingShare = { isSibling: (p) => Boolean(adapterOf()?.provenKeyOf(p as PeerId)), gate: () => gate };
  return (peerId: PeerId, documentId?: string) => federationShareDecision(relayPeers, null, peerId, documentId as DocumentId | undefined, siblings);
}

async function reach(repo: Repo, url: string, ms = 2000): Promise<string> {
  const found = repo.find<{ line: string }>(url as AutomergeUrl).then((h) => h.doc()?.line ?? "empty", () => "withheld");
  return Promise.race([found, sleep(ms).then(() => "withheld")]);
}

/**
 * A HOSTILE sibling: a real member that runs the proof by hand, then names `named` as its repo peer id inside the
 * session — what a modified build would say.
 */
async function hostileSibling(relay: ReturnType<typeof memoryRelay>, self: LeafPeerSelf, named: string): Promise<() => void> {
  const t = await relay.transportFor(self.deviceKey)();
  let state: LeafPeerState | null = null;
  const name = (to: string, session: LeafPeerSession): void => t.send(to, { t: "seal", s: session.seal(cbor.encode({ t: "peer", peerId: named })) });
  t.onFrame((from, raw) => {
    void (async () => {
      const f = raw as { t: string; p?: LeafPeerFrame };
      if (f.t === "here") {
        if (self.deviceKey < from) { const h = startLeafPeerProof(self); state = h.state; t.send(from, { t: "proof", p: h.frame }); }
        else t.send(from, { t: "here" });
        return;
      }
      if (f.t !== "proof" || !f.p) return;
      if (f.p.step === "hello") {
        const a = await answerLeafPeerProof(self, f.p);
        if (a.kind === "answer") { state = a.state; t.send(from, { t: "proof", p: a.frame }); }
      } else if (f.p.step === "answer" && state) {
        const { verdict, frame } = await finishLeafPeerProof(self, state, f.p, from);
        if (frame) t.send(from, { t: "proof", p: frame });
        if (verdict.ok) name(from, verdict.session);
      } else if (f.p.step === "finish" && state) {
        const verdict = await acceptLeafPeerProof(self, state, f.p, from);
        if (verdict.ok) name(from, verdict.session);
      }
    })();
  });
  t.join([self.secret.secret]);
  t.send(null, { t: "here" });
  return () => t.close();
}

describe("a sibling stands under the peer id its proven key derives — one id, one carrier", () => {
  test("RED (live): a sibling whose repo runs under the operator node's id pulls nothing the sibling gate withholds", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    let xAdapter: SiblingNetworkAdapter | null = null;
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay, {
      sharePolicy: siblingVerdict(new Set([NODE]), new Set(), () => xAdapter),
    });
    xAdapter = x.adapter;
    x.repo.networkSubsystem.addNetworkAdapter(new OtherCarrier([NODE]));
    const ySelf = await leafUnder(SEEDS.deviceY, ey, [inception]);
    const yAdapter = new SiblingNetworkAdapter({ transports: [relay.transportFor(ySelf.deviceKey)], kel: [inception], leaf: async (k) => leafOf(SEEDS.deviceY, ey, k) });
    const yRepo = new Repo({ peerId: NODE, network: [yAdapter], shareConfig: shareConfigOf(async () => true) });
    yAdapter.bindRepo(yRepo);
    try {
      const derived = siblingPeerIdOf(ySelf.deviceKey);
      await until(() => x.adapter.provenKeyOf(derived) === ySelf.deviceKey, "y proven under the id its key derives");
      expect(x.adapter.provenKeyOf(NODE)).toBeNull();
      const daemon = x.repo.create<{ line: string }>({ line: "x's own @daemon" });
      expect(await reach(yRepo, daemon.url)).toBe("withheld");
      expect(x.refusals).toEqual([]);
    } finally { await x.repo.shutdown(); await yRepo.shutdown(); }
  });

  test("CONTROL: the same sibling under a fresh id is withheld the @daemon and syncs a face-plane doc", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const planes = new Set<DocumentId>();
    let xAdapter: SiblingNetworkAdapter | null = null;
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay, {
      sharePolicy: siblingVerdict(new Set([NODE]), planes, () => xAdapter),
    });
    xAdapter = x.adapter;
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair");
      expect(peersOf(x)).toEqual([siblingPeerIdOf(y.self.deviceKey)]);
      const daemon = x.repo.create<{ line: string }>({ line: "x's own @daemon" });
      const plane = x.repo.create<{ line: string }>({ line: "x's face plane" });
      planes.add(interpretAsDocumentId(plane.url));
      expect(await reach(y.repo, daemon.url)).toBe("withheld");
      expect(await reach(y.repo, plane.url)).toBe("x's face plane");
    } finally { await shutdown(x, y); }
  });

  test("RED: a sibling that NAMES a peer id its proven key does not derive becomes no peer, said as `peer`", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
    const close = await hostileSibling(relay, await leafUnder(SEEDS.deviceY, ey, [inception]), NODE);
    try {
      await until(() => x.refusals.length > 0, "the misnamed sibling's refusal");
      expect(x.refusals[0]).toMatchObject({ suspect: "peer", reason: expect.stringMatching(/does not derive/) });
      expect(x.adapter.provenKeyOf(NODE)).toBeNull();
      expect(peersOf(x)).toEqual([]);
    } finally { close(); await shutdown(x); }
    // CONTROL: the same hand-run sibling naming the id its key derives stands.
    const relay2 = memoryRelay();
    const x2 = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay2);
    const ySelf = await leafUnder(SEEDS.deviceY, ey, [inception]);
    const close2 = await hostileSibling(relay2, ySelf, siblingPeerIdOf(ySelf.deviceKey));
    try {
      await until(() => peersOf(x2).length === 1, "the lawfully named sibling");
      expect(x2.refusals).toEqual([]);
    } finally { close2(); await shutdown(x2); }
  });

  test("RED: an id the repo already routes elsewhere gives the sibling no route — said as `route`, and the sibling hears why", async () => {
    const { inception } = await founded();
    const relay = memoryRelay();
    const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
    const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
    const yKey = (await leafUnder(SEEDS.deviceY, ey, [inception])).deviceKey;
    const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
    x.repo.networkSubsystem.addNetworkAdapter(new OtherCarrier([siblingPeerIdOf(yKey)]));
    await until(() => x.repo.peers.includes(siblingPeerIdOf(yKey)), "the other carrier to hold the id");
    const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
    try {
      await until(() => x.refusals.length > 0 && y.refusals.length > 0, "both sides to say why");
      expect(x.refusals[0]).toMatchObject({ suspect: "route", peerKey: yKey, peerId: siblingPeerIdOf(yKey) });
      expect(y.refusals[0]).toMatchObject({ suspect: "peer", reason: expect.stringMatching(/another adapter/) });
      expect(x.adapter.provenKeyOf(siblingPeerIdOf(yKey))).toBeNull();
      expect(peersOf(y)).toEqual([]);
    } finally { await shutdown(x, y); }
  });

  test("RED: an adapter that announces a standing sibling's id takes the route — the sibling leaves, said as `route`", async () => {
    const { x, y } = await (async () => {
      const { inception } = await founded();
      const relay = memoryRelay();
      const ex = await enrol(SEEDS.opA, SEEDS.deviceX, inception.prefix);
      const ey = await enrol(SEEDS.opA, SEEDS.deviceY, inception.prefix);
      const x = standLeaf(SEEDS.deviceX, ex, await leafOf(SEEDS.deviceX, ex, [inception]), relay);
      const y = standLeaf(SEEDS.deviceY, ey, await leafOf(SEEDS.deviceY, ey, [inception]), relay);
      await until(() => peersOf(x).length === 1 && peersOf(y).length === 1, "the pair");
      return { x, y };
    })();
    const taker = new OtherCarrier();
    try {
      const id = siblingPeerIdOf(y.self.deviceKey);
      x.repo.networkSubsystem.addNetworkAdapter(taker);
      taker.announce(id);
      expect(x.refusals[0]).toMatchObject({ suspect: "route", peerKey: y.self.deviceKey, peerId: id });
      expect(x.adapter.provenKeyOf(id)).toBeNull();
      await until(() => peersOf(y).length === 0, "y to hear its route moved");
      expect(y.refusals[0]).toMatchObject({ suspect: "peer", reason: expect.stringMatching(/another adapter/) });
    } finally { await shutdown(x, y); }
  });

  test("RED (the verdict alone): sibling-ness decides before the relay ring, and an id both claim denies", async () => {
    const daemonDoc = "4NMNnkMhL8jXrdJ9jamS9xSbz1i" as DocumentId;
    const board = interpretAsDocumentId(personaKelBoardDocUrl(NEXUS) as AutomergeUrl);
    const gate = new DeterministicFederationGate(NEXUS);
    const siblings: SiblingShare = { isSibling: (p) => p === "sib" || p === "node-peer", gate: () => gate };
    // An id a relay carrier and a sibling both claim reads as neither.
    expect(await federationShareDecision(new Set(["node-peer"]), null, "node-peer", daemonDoc, siblings)).toBe(false);
    expect(await federationShareDecision(new Set(["node-peer"]), null, "node-peer", board, siblings)).toBe(false);
    // A sibling reads the sibling gate.
    expect(await federationShareDecision(new Set(["node-peer"]), null, "sib", daemonDoc, siblings)).toBe(false);
    expect(await federationShareDecision(new Set(["node-peer"]), null, "sib", board, siblings)).toBe(true);
    // CONTROL: the own node, no sibling claiming its id, full-syncs.
    expect(await federationShareDecision(new Set(["node-peer"]), null, "node-peer", daemonDoc, { isSibling: () => false, gate: () => gate })).toBe(true);
  });
});
