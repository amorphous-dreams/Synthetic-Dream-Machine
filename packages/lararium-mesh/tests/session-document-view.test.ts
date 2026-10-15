/**
 * session-document-view.test — what a session's island may ask its own vessel for.
 *
 * Every vector runs over REAL Repos and a REAL MessageChannel. The island stands as an adversary: a Repo of its
 * own on the far port, or a bare port that forges messages by hand. A tap on the island's port reads every
 * message that crosses toward it, so "no byte" gets counted on the wire and never inferred from a failed find.
 *
 * Proven here:
 *   · the contract's first test: an island that asks its sync path for another face's plane, or for the
 *     vessel's catalog, draws no byte and no name; its own facets read (control); and the BROAD port hands
 *     the same adversary the other face's plane (the known positive that proves the probe sees);
 *   · an announcement never leaves for a document beyond the facets;
 *   · a write lands by the one table of profile against layer, and a refused write changes nothing the
 *     owner holds;
 *   · a catalog name and a content address resolve from the facets alone;
 *   · a peer ID the view did not mint takes the leg down, and a forged sender moves nothing;
 *   · the island announces as an ephemeral replica whatever storage it claims;
 *   · a closed view answers nothing;
 *   · one-way documents cross one way, from either end of a leg.
 */
import { describe, test, expect, afterEach } from "vitest";
import { Repo, type AutomergeUrl, type DocHandle, type PeerId } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import * as A from "@automerge/automerge";
import { attachMessageChannelSync, makeIslandRepo } from "../src/island-repo.js";
import { GatedSyncLeg, carriesChanges, oneWayDocumentsGate, type LegRefusal } from "../src/gated-sync-leg.js";
import {
  SessionDocumentView, SessionViewError, type DocumentFacet, type FacetLayer, type SessionDocumentFacets,
} from "../src/session-document-view.js";
import type { CapabilityProfile } from "../src/session-contract.js";

interface Doc { tiddlers: Record<string, string> }

// Content addresses, as this house spells them: a bare sha256, and one under its algorithm's tag.
const CID_CORE = "c0".repeat(32), CID_PLUGIN = `sha256:${"c1".repeat(32)}`;
const CID_BODY_A = "a0".repeat(32), CID_BODY_B = "b0".repeat(32), CID_NOBODY = "ee".repeat(32);

const until = async (cond: () => boolean, ms = 3000): Promise<boolean> => {
  const start = performance.now();
  while (performance.now() - start < ms) {
    if (cond()) return true;
    await new Promise((r) => setTimeout(r, 15));
  }
  return cond();
};
const quiet = (ms = 250): Promise<void> => new Promise((r) => setTimeout(r, ms));
const idOf = (url: string): string => url.replace(/^automerge:/, "");

/** Find a document, or null when the island's peers answer that none holds it (or nothing answers in time). */
async function tryFind(repo: Repo, url: string, ms = 1500): Promise<DocHandle<Doc> | null> {
  const found = repo.find<Doc>(url as AutomergeUrl).then((h) => h, () => null);
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), ms));
  return Promise.race([found, timeout]);
}

const repos: Repo[] = [];
const ports: MessagePort[] = [];
afterEach(async () => {
  for (const port of ports.splice(0)) port.close();
  await Promise.all(repos.splice(0).map((r) => r.shutdown().catch(() => {})));
});

/** A vessel that holds two faces' planes, one wiki of face A, a library bag, the oracle floor and the catalog. */
function vessel() {
  const owner = new Repo({ peerId: "owner" as PeerId });
  repos.push(owner);
  const make = (title: string): DocHandle<Doc> => owner.create<Doc>({ tiddlers: { [title]: `${title} body` } });
  const planeA   = make("plane-a");
  const planeB   = make("plane-b");
  const workingA = make("working-a");
  const draftA   = make("draft-a");
  const personalA = make("personal-a");
  const canonA   = make("canon-a");
  const library  = make("library");
  const oracle   = make("oracle");
  const catalog  = owner.create<Doc>({ tiddlers: {
    "lar:///persona/a": planeA.url, "lar:///persona/b": planeB.url, "lar:///wikis/a/working": workingA.url, "lar:///wikis/b": "automerge:elsewhere",
  } });
  const facet = (name: string, handle: DocHandle<Doc>, layer: FacetLayer): DocumentFacet => ({ name, document: handle.url, layer });
  const facetsA: SessionDocumentFacets = {
    documents: [
      facet("lar:///persona/a", planeA, "plane"), facet("lar:///wikis/a/working", workingA, "working"),
      facet("lar:///wikis/a/draft", draftA, "draft"), facet("lar:///wikis/a/personal", personalA, "personal"),
      facet("lar:///bags/a", canonA, "canon"), facet("lar:///bags/library", library, "library"),
      facet("lar:///bags/oracle", oracle, "oracle"),
    ],
    content: [CID_CORE, CID_PLUGIN],
  };
  return { owner, planeA, planeB, workingA, draftA, personalA, canonA, library, oracle, catalog, facetsA };
}

/** Everything that crossed toward the island, read off its own port. */
interface Tap { readonly messages: Array<{ type?: string; documentId?: string; senderId?: string; data?: unknown }> }
function tapPort(port: MessagePort): Tap {
  const messages: Tap["messages"] = [];
  port.addEventListener("message", (e) => { messages.push((e as MessageEvent).data); });
  return { messages };
}
const mentions = (tap: Tap, handle: DocHandle<Doc>): number =>
  tap.messages.filter((m) => m.documentId === handle.documentId || JSON.stringify(m).includes(idOf(handle.url))).length;

/** Open a view over `facets` and stand an adversary island Repo on the far port. */
function mountIsland(v: ReturnType<typeof vessel>, profile: CapabilityProfile = "face", opts: {
  facets?: SessionDocumentFacets; islandPeerId?: string;
  referencesContent?: (documentId: string, cid: string) => boolean;
} = {}) {
  const refusals: Array<Record<string, unknown>> = [];
  const view = new SessionDocumentView({
    profile, facets: opts.facets ?? v.facetsA,
    onRefusal: (r) => { refusals.push(r as unknown as Record<string, unknown>); },
    ...(opts.referencesContent ? { referencesContent: opts.referencesContent } : {}),
  });
  const { port1, port2 } = new MessageChannel();
  ports.push(port1, port2);
  const tap = tapPort(port2);
  view.attach(v.owner, port1);
  const island = makeIslandRepo({ syncPort: port2, peerId: opts.islandPeerId ?? view.peerId });
  repos.push(island);
  return { view, island, tap, refusals, port2 };
}

/** The same adversary over the BROAD port every island holds today. */
function mountBroadIsland(v: ReturnType<typeof vessel>) {
  const { port1, port2 } = new MessageChannel();
  ports.push(port1, port2);
  const tap = tapPort(port2);
  attachMessageChannelSync(v.owner, port1);
  const island = makeIslandRepo({ syncPort: port2 });
  repos.push(island);
  return { island, tap };
}

describe("the contract's first test: an island asks its sync path for an arbitrary document", () => {
  test("another face's plane and the vessel's catalog cross as no byte and no name", async () => {
    const v = vessel();
    const { island, tap, refusals } = mountIsland(v);
    // CONTROL FIRST: the session's own plane reads, so a later miss names the gate and never a dead leg.
    const own = await tryFind(island, v.planeA.url);
    expect(own?.doc()?.tiddlers["plane-a"]).toBe("plane-a body");

    expect(await tryFind(island, v.planeB.url)).toBeNull();
    expect(await tryFind(island, v.catalog.url)).toBeNull();
    await quiet();
    // Counted on the wire: no sync byte for either document crossed toward the island.
    const carried = (handle: DocHandle<Doc>): number =>
      tap.messages.filter((m) => m.documentId === handle.documentId && (m.type === "sync" || m.type === "request")).length;
    expect(carried(v.planeB)).toBe(0);
    expect(carried(v.catalog)).toBe(0);
    // No catalog name of the other face reached the island in any message.
    expect(tap.messages.some((m) => JSON.stringify(m).includes("lar:///persona/b"))).toBe(false);
    // The refused fetch answered as absence does.
    expect(tap.messages.some((m) => m.type === "doc-unavailable" && m.documentId === v.planeB.documentId)).toBe(true);
    expect(refusals.some((r) => r["reason"] === "beyond-facets" && r["documentId"] === v.planeB.documentId && r["direction"] === "inbound")).toBe(true);
    // And the control really carried bytes: the probe counts what it claims to count.
    expect(carried(v.planeA)).toBeGreaterThan(0);
  });

  test("KNOWN POSITIVE: the broad port hands the same adversary the other face's plane and every catalog name", async () => {
    const v = vessel();
    const { island } = mountBroadIsland(v);
    const stolen = await tryFind(island, v.planeB.url);
    expect(stolen?.doc()?.tiddlers["plane-b"]).toBe("plane-b body");
    const names = await tryFind(island, v.catalog.url);
    expect(Object.keys(names?.doc()?.tiddlers ?? {})).toContain("lar:///persona/b");
  });

  test("an announcement never leaves for a document beyond the facets", async () => {
    const v = vessel();
    const { island, tap } = mountIsland(v);
    await tryFind(island, v.planeA.url);
    // The owner changes the other face's plane and mints a document the session never heard of.
    v.planeB.change((d) => { d.tiddlers["later"] = "a secret written after the mount"; });
    const fresh = v.owner.create<Doc>({ tiddlers: { fresh: "minted after the mount" } });
    // CONTROL: a change to the session's own plane reaches the island.
    v.planeA.change((d) => { d.tiddlers["later"] = "own news"; });
    const ownHandle = await tryFind(island, v.planeA.url);
    expect(await until(() => ownHandle?.doc()?.tiddlers["later"] === "own news")).toBe(true);
    await quiet();
    expect(mentions(tap, v.planeB)).toBe(0);
    expect(mentions(tap, fresh)).toBe(0);
  });

  test("KNOWN POSITIVE: the broad port announces a document the island never asked for", async () => {
    const v = vessel();
    const { island, tap } = mountBroadIsland(v);
    await tryFind(island, v.planeA.url);
    v.planeB.change((d) => { d.tiddlers["later"] = "a secret written after the mount"; });
    expect(await until(() => mentions(tap, v.planeB) > 0)).toBe(true);
  });
});

describe("writes land by the one table of profile against layer", () => {
  const write = async (island: Repo, handle: DocHandle<Doc>, key: string): Promise<void> => {
    const local = await tryFind(island, handle.url);
    expect(local).not.toBeNull();
    local!.change((d) => { d.tiddlers[key] = "written by the island"; });
  };

  test("a face writes its working layer and never a bag", async () => {
    const v = vessel();
    const { island, refusals } = mountIsland(v, "face");
    await write(island, v.workingA, "edit");
    expect(await until(() => v.workingA.doc().tiddlers["edit"] === "written by the island")).toBe(true);   // control

    for (const readOnly of [v.canonA, v.library, v.oracle]) {
      const before = A.getHeads(readOnly.doc());
      await write(island, readOnly, "edit");
      expect(await until(() => refusals.some((r) => r["reason"] === "read-only-layer" && r["documentId"] === readOnly.documentId))).toBe(true);
      await quiet(100);
      expect(readOnly.doc().tiddlers["edit"]).toBeUndefined();
      expect(A.getHeads(readOnly.doc())).toEqual(before);
    }
  });

  test("a seat writes the working layer alone, and a refused layer names the profile", async () => {
    const v = vessel();
    const { view, island, refusals } = mountIsland(v, "seat");
    await write(island, v.workingA, "seat-edit");
    expect(await until(() => v.workingA.doc().tiddlers["seat-edit"] === "written by the island")).toBe(true);

    for (const beyond of [v.draftA, v.personalA, v.planeA]) {
      await write(island, beyond, "seat-edit");
      expect(await until(() => refusals.some((r) => r["reason"] === "beyond-profile" && r["documentId"] === beyond.documentId))).toBe(true);
      await quiet(100);
      expect(beyond.doc().tiddlers["seat-edit"]).toBeUndefined();
      expect(view.write(beyond.url)).toEqual({ ok: false, refusal: "beyond-profile", profile: "seat", verb: "write" });
    }
    // A seat still READS what it may not write.
    expect((await tryFind(island, v.planeA.url))?.doc()?.tiddlers["plane-a"]).toBe("plane-a body");
  });

  test("the table, read whole", () => {
    const v = vessel();
    const layers: Record<FacetLayer, DocHandle<Doc>> = {
      oracle: v.oracle, library: v.library, canon: v.canonA, working: v.workingA, personal: v.personalA, draft: v.draftA, plane: v.planeA,
    };
    const may = (profile: CapabilityProfile): FacetLayer[] => {
      const view = new SessionDocumentView({ profile, facets: v.facetsA });
      return (Object.keys(layers) as FacetLayer[]).filter((layer) => view.write(layers[layer].url).ok).sort();
    };
    expect(may("face")).toEqual(["draft", "personal", "plane", "working"]);
    expect(may("verb")).toEqual(["draft", "personal", "plane", "working"]);
    expect(may("ingest")).toEqual(["draft", "working"]);
    expect(may("seat")).toEqual(["working"]);
    // A document beyond the facets refuses as beyond the facets, whatever the profile.
    const view = new SessionDocumentView({ profile: "face", facets: v.facetsA });
    expect(view.write(v.planeB.url)).toEqual({ ok: false, refusal: "beyond-facets", verb: "write" });
  });

  test("a sync message's changes read from its bytes, and torn bytes read as a write", () => {
    let a = A.from<{ n: number }>({ n: 1 });
    let state = A.initSyncState();
    let first: Uint8Array | null;
    [state, first] = A.generateSyncMessage(a, state);
    const bare = { type: "sync", senderId: "x", targetId: "y", documentId: "d", data: first! };
    expect(carriesChanges(bare)).toBe(false);                                 // an opening message carries none
    // The far end answers with what it holds; the next message then carries the change.
    let b = A.init<{ n: number }>();
    let stateB = A.initSyncState();
    [b, stateB] = A.receiveSyncMessage(b, stateB, first!);
    let reply: Uint8Array | null;
    [stateB, reply] = A.generateSyncMessage(b, stateB);
    [a, state] = A.receiveSyncMessage(a, state, reply!);
    let second: Uint8Array | null;
    [state, second] = A.generateSyncMessage(a, state);
    expect(A.decodeSyncMessage(second!).changes.length).toBeGreaterThan(0);   // the setup took
    expect(carriesChanges({ ...bare, data: second! })).toBe(true);
    expect(carriesChanges({ ...bare, data: new Uint8Array([1, 2, 3]) })).toBe(true);
    expect(carriesChanges({ type: "sync", senderId: "x", targetId: "y", documentId: "d" })).toBe(true);
    expect(carriesChanges({ ...bare, type: "doc-unavailable" })).toBe(false);
  });
});

describe("catalog names and content addresses resolve from the facets alone", () => {
  test("a name beyond the facets refuses, and a supplied plane address grants nothing", () => {
    const v = vessel();
    const view = new SessionDocumentView({ profile: "face", facets: v.facetsA });
    expect(view.catalog("lar:///persona/a")).toEqual({ ok: true, documentUrl: v.planeA.url });
    expect(view.catalog("lar:///persona/b")).toEqual({ ok: false, refusal: "beyond-facets", verb: "catalog" });
    expect(view.catalog("lar:///wikis/b")).toEqual({ ok: false, refusal: "beyond-facets", verb: "catalog" });
    // The other face's plane address, supplied as a URL, a bare ID or a name, opens no gate.
    for (const supplied of [v.planeB.url, v.planeB.documentId, "lar:///persona/b", "", "automerge:not-an-address"]) {
      expect(view.fetch(supplied).ok).toBe(false);
      expect(view.announce(supplied).ok).toBe(false);
      expect(view.write(supplied).ok).toBe(false);
    }
    expect(view.fetch(v.planeA.documentId)).toEqual({ ok: true });            // control: a bare ID of its own reads
  });

  test("content reads when the facets name it or a readable document references it", () => {
    const v = vessel();
    const references = new Map<string, string>([[v.workingA.documentId, CID_BODY_A], [v.planeB.documentId, CID_BODY_B]]);
    const asked: string[] = [];
    const view = new SessionDocumentView({
      profile: "face", facets: v.facetsA,
      referencesContent: (documentId, cid) => { asked.push(documentId); return references.get(documentId) === cid; },
    });
    expect(view.content(CID_CORE)).toEqual({ ok: true });
    expect(view.content(CID_PLUGIN)).toEqual({ ok: true });
    expect(view.content(CID_BODY_A)).toEqual({ ok: true });
    expect(view.content(CID_BODY_B)).toEqual({ ok: false, refusal: "beyond-facets", verb: "content" });
    expect(view.content(CID_NOBODY)).toEqual({ ok: false, refusal: "beyond-facets", verb: "content" });
    // A string that names no content address refuses before the owner's reader hears of it, whatever a
    // readable document claims to reference: a path, a separator, an empty name, a wrong length.
    const everything = new SessionDocumentView({ profile: "face", facets: v.facetsA, referencesContent: (_d, cid) => { asked.push(`!${cid}`); return true; } });
    for (const torn of ["../../identity/seed", "/etc/passwd", "", "c0", `${CID_CORE}/..`, `sha256:../${"c1".repeat(31)}`, ` ${CID_CORE}`]) {
      expect(everything.content(torn)).toEqual({ ok: false, refusal: "beyond-facets", verb: "content" });
    }
    expect(asked.filter((a) => a.startsWith("!"))).toEqual([]);
    expect(everything.content(CID_NOBODY)).toEqual({ ok: true });                        // control: a well-formed address reaches the reader
    // The owner's reader never got asked about a document beyond the facets.
    expect(asked).not.toContain(v.planeB.documentId);
    expect(asked).toContain(v.workingA.documentId);
    // With no reader, a content address opens only by the facets' own list.
    const bare = new SessionDocumentView({ profile: "face", facets: v.facetsA });
    expect(bare.content(CID_BODY_A).ok).toBe(false);
    expect(bare.content(CID_PLUGIN).ok).toBe(true);
  });

  test("facets that could answer two ways refuse at the open", () => {
    const v = vessel();
    const doc = (name: string, handle: DocHandle<Doc>, layer: FacetLayer): DocumentFacet => ({ name, document: handle.url, layer });
    const open = (documents: DocumentFacet[], profile: unknown = "face") =>
      new SessionDocumentView({ profile: profile as CapabilityProfile, facets: { documents, content: [] } });
    expect(() => open([doc("a", v.canonA, "canon"), doc("b", v.canonA, "working")])).toThrow("facet-layer-ambiguous");
    expect(() => open([doc("a", v.canonA, "canon"), doc("a", v.library, "canon")])).toThrow("facet-name-ambiguous");
    expect(() => open([{ name: "a", document: "not-an-address", layer: "canon" }])).toThrow(SessionViewError);
    expect(() => open([doc("a", v.canonA, "kernel" as FacetLayer)])).toThrow("facets-malformed");
    expect(() => open([], "root")).toThrow("profile-unknown");
    expect(open([doc("a", v.canonA, "canon"), doc("b", v.canonA, "canon")]).fetch(v.canonA.url).ok).toBe(true);   // control
  });
});

describe("the leg rides the carrier, never the peer ID the far end claims", () => {
  test("an island that announces another ID loses its leg", async () => {
    const v = vessel();
    const { view, island, tap, refusals } = mountIsland(v, "face", { islandPeerId: "daemon-island" });
    expect(island.peerId).not.toBe(view.peerId);                              // the setup took
    expect(await until(() => refusals.some((r) => r["reason"] === "peer-not-admitted" && r["direction"] === "peer"))).toBe(true);
    expect(await tryFind(island, v.planeA.url, 600)).toBeNull();              // even its own facet stays shut
    expect(v.owner.peers).not.toContain("daemon-island");
    expect(tap.messages.filter((m) => m.type === "sync").length).toBe(0);
  });

  test("KNOWN POSITIVE: on the broad port an island that announces another peer's ID takes that peer's place", async () => {
    const v = vessel();
    const first = new MessageChannel(); ports.push(first.port1, first.port2);
    attachMessageChannelSync(v.owner, first.port1);
    const trusted = makeIslandRepo({ syncPort: first.port2, peerId: "daemon-island" });
    repos.push(trusted);
    expect(await until(() => v.owner.peers.includes("daemon-island" as PeerId))).toBe(true);
    const second = new MessageChannel(); ports.push(second.port1, second.port2);
    const tap = tapPort(second.port2);
    attachMessageChannelSync(v.owner, second.port1);
    const impostor = makeIslandRepo({ syncPort: second.port2, peerId: "daemon-island" });
    repos.push(impostor);
    expect((await tryFind(impostor, v.planeB.url))?.doc()?.tiddlers["plane-b"]).toBe("plane-b body");
    expect(tap.messages.some((m) => m.type === "sync")).toBe(true);
  });

  test("a forged sender, a kind beyond the table and a torn message all move nothing", async () => {
    const v = vessel();
    const refusals: LegRefusal[] = [];
    const view = new SessionDocumentView({ profile: "face", facets: v.facetsA, onRefusal: (r) => { refusals.push(r as LegRefusal); } });
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    const tap = tapPort(port2);
    port2.start();
    view.attach(v.owner, port1);
    // The island speaks the wire by hand: it arrives under the minted ID, then forges.
    port2.postMessage({ type: "arrive", senderId: view.peerId, peerMetadata: { storageId: "stolen-storage", isEphemeral: false } });
    expect(await until(() => tap.messages.some((m) => m.type === "welcome"))).toBe(true);
    const opening = A.generateSyncMessage(A.init(), A.initSyncState())[1]!;
    const send = (message: Record<string, unknown>): void => { port2.postMessage({ targetId: "owner", data: opening.slice().buffer, ...message }); };

    send({ type: "request", senderId: "owner", documentId: v.planeA.documentId });                 // the owner's own ID
    send({ type: "request", senderId: "some-relay", documentId: v.planeA.documentId });            // a stranger's ID
    send({ type: "remote-subscription-change", senderId: view.peerId, add: ["storage-x"] });       // no document
    send({ type: "remote-heads-changed", senderId: view.peerId, documentId: v.planeA.documentId, newHeads: {} });
    send({ type: "leak-everything", senderId: view.peerId, documentId: v.planeA.documentId });
    send({ type: "request", senderId: view.peerId, documentId: v.planeB.documentId });             // beyond the facets
    port2.postMessage("not a message");
    const inbound = (): LegRefusal[] => refusals.filter((r) => r.direction === "inbound");
    expect(await until(() => inbound().length >= 7)).toBe(true);
    await quiet(100);
    expect(inbound().map((r) => r.reason).sort()).toEqual([
      "beyond-facets", "kind-not-carried", "kind-not-carried", "kind-not-carried", "malformed-message", "peer-not-admitted", "peer-not-admitted",
    ]);
    // Nothing but the session's own facets crossed, and the refused fetch answered as absence does.
    const own = new Set(v.facetsA.documents.map((f) => idOf(f.document)));
    expect(tap.messages.filter((m) => m.type === "sync" && !own.has(String(m.documentId))).length).toBe(0);
    expect(tap.messages.filter((m) => m.documentId === v.planeB.documentId).map((m) => m.type)).toEqual(["doc-unavailable"]);
    // CONTROL: the same hand, asking under the minted ID for its own facet, draws an answer that carries it.
    const before = tap.messages.filter((m) => m.type === "sync" && m.documentId === v.personalA.documentId).length;
    send({ type: "request", senderId: view.peerId, documentId: v.personalA.documentId });
    expect(await until(() => tap.messages.filter((m) => m.type === "sync" && m.documentId === v.personalA.documentId).length > before)).toBe(true);
  });

  test("a message past the byte bound refuses unread", async () => {
    const v = vessel();
    const refusals: LegRefusal[] = [];
    const view = new SessionDocumentView({ profile: "face", facets: v.facetsA, maxInboundBytes: 4096, onRefusal: (r) => { refusals.push(r as LegRefusal); } });
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    const tap = tapPort(port2);
    port2.start();
    view.attach(v.owner, port1);
    port2.postMessage({ type: "arrive", senderId: view.peerId, peerMetadata: {} });
    expect(await until(() => tap.messages.some((m) => m.type === "welcome"))).toBe(true);
    const before = A.getHeads(v.workingA.doc());
    // A payload past the bound, aimed at a document the session may write: the leg never hands it to the Repo.
    port2.postMessage({ type: "sync", senderId: view.peerId, targetId: "owner", documentId: v.workingA.documentId, data: new Uint8Array(4097).buffer });
    expect(await until(() => refusals.some((r) => r.reason === "message-too-large" && r.documentId === v.workingA.documentId))).toBe(true);
    expect(A.getHeads(v.workingA.doc())).toEqual(before);
    // CONTROL: a real island under the same bound still reads and writes its working layer.
    const island = makeIslandRepo({ syncPort: (() => { const c = new MessageChannel(); ports.push(c.port1, c.port2); const second = new SessionDocumentView({ profile: "face", facets: v.facetsA, maxInboundBytes: 4096, mintPeerId: () => "second-island" }); second.attach(v.owner, c.port1); return c.port2; })(), peerId: "second-island" });
    repos.push(island);
    const local = await tryFind(island, v.workingA.url);
    local!.change((d) => { d.tiddlers["small"] = "within the bound"; });
    expect(await until(() => v.workingA.doc().tiddlers["small"] === "within the bound")).toBe(true);
  });

  test("the island announces as an ephemeral replica whatever storage it claims", async () => {
    const v = vessel();
    const seen: Array<{ peerId: string; storageId?: string; isEphemeral?: boolean }> = [];
    v.owner.networkSubsystem.on("peer", ({ peerId, peerMetadata }) => { seen.push({ peerId, ...peerMetadata }); });
    const view = new SessionDocumentView({ profile: "face", facets: v.facetsA });
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    port2.start();
    view.attach(v.owner, port1);
    port2.postMessage({ type: "arrive", senderId: view.peerId, peerMetadata: { storageId: "durable-claim", isEphemeral: false } });
    expect(await until(() => seen.length === 1)).toBe(true);
    expect(seen[0]).toEqual({ peerId: view.peerId, isEphemeral: true });
  });

  test("a closed view answers nothing, and one view carries one leg", async () => {
    const v = vessel();
    const { view, island, tap } = mountIsland(v);
    expect((await tryFind(island, v.planeA.url))?.doc()?.tiddlers["plane-a"]).toBe("plane-a body");   // control: it stood
    expect(() => view.attach(v.owner, new MessageChannel().port1)).toThrow("leg-already-attached");
    await quiet();                                                            // the opening exchange settles
    view.close();
    expect(view.closed).toBe(true);
    const crossed = tap.messages.length;
    v.planeA.change((d) => { d.tiddlers["after-close"] = "unseen"; });
    await quiet();
    expect((await tryFind(island, v.planeA.url))?.doc()?.tiddlers["after-close"]).toBeUndefined();
    expect(tap.messages.slice(crossed).filter((m) => m.type === "sync").length).toBe(0);
    for (const verb of ["announce", "fetch", "write"] as const) {
      expect(view[verb](v.planeA.url)).toEqual({ ok: false, refusal: "view-closed", verb });
    }
    expect(view.catalog("lar:///persona/a")).toEqual({ ok: false, refusal: "view-closed", verb: "catalog" });
    expect(view.content(CID_CORE)).toEqual({ ok: false, refusal: "view-closed", verb: "content" });
    expect(() => view.attach(v.owner, new MessageChannel().port1)).toThrow("view-closed");
    expect(v.owner.peers).not.toContain(view.peerId);
  });
});

describe("one-way documents cross one way, from either end of a leg", () => {
  /** A hearth and a leaf over one channel; each end wears the gate it would wear in production, or none. */
  function crossing(gates: { hearth: boolean; leaf: boolean }) {
    const hearth = new Repo({ peerId: "hearth" as PeerId });
    const canon = hearth.create<Doc>({ tiddlers: { law: "the hearth's canon" } });
    const shared = hearth.create<Doc>({ tiddlers: { note: "a shared board" } });
    const canonIds = new Set([canon.documentId as string]);
    const { port1, port2 } = new MessageChannel();
    ports.push(port1, port2);
    const refusals: LegRefusal[] = [];
    const hearthInner = new MessageChannelNetworkAdapter(port1);
    hearth.networkSubsystem.addNetworkAdapter(gates.hearth
      ? new GatedSyncLeg(hearthInner, oneWayDocumentsGate({ sendOnly: canonIds }), (r) => { refusals.push(r); })
      : hearthInner);
    const leafInner = new MessageChannelNetworkAdapter(port2);
    const leaf = new Repo({
      peerId: "leaf" as PeerId,
      network: [gates.leaf ? new GatedSyncLeg(leafInner, oneWayDocumentsGate({ receiveOnly: canonIds }), (r) => { refusals.push(r); }) : leafInner],
    });
    repos.push(hearth, leaf);
    return { hearth, leaf, canon, shared, refusals };
  }

  for (const gates of [{ hearth: true, leaf: false }, { hearth: false, leaf: true }, { hearth: true, leaf: true }]) {
    test(`canon crosses hearth to leaf alone (gate at ${gates.hearth ? "the hearth" : ""}${gates.hearth && gates.leaf ? " and " : ""}${gates.leaf ? "the leaf" : ""})`, async () => {
      const { leaf, canon, shared, refusals } = crossing(gates);
      const leafCanon = await tryFind(leaf, canon.url);
      expect(leafCanon?.doc()?.tiddlers["law"]).toBe("the hearth's canon");            // canon reaches the leaf
      const before = A.getHeads(canon.doc());
      leafCanon!.change((d) => { d.tiddlers["law"] = "rewritten by the leaf"; });
      expect(await until(() => refusals.some((r) => r.reason === "one-way-document"))).toBe(true);
      await quiet(150);
      expect(canon.doc().tiddlers["law"]).toBe("the hearth's canon");
      expect(A.getHeads(canon.doc())).toEqual(before);
      // The hearth's later canon still reaches the leaf.
      canon.change((d) => { d.tiddlers["amendment"] = "from the hearth"; });
      expect(await until(() => leafCanon!.doc()?.tiddlers["amendment"] === "from the hearth")).toBe(true);
      // CONTROL: a document the gate does not name crosses both ways.
      const leafShared = await tryFind(leaf, shared.url);
      leafShared!.change((d) => { d.tiddlers["reply"] = "from the leaf"; });
      expect(await until(() => shared.doc().tiddlers["reply"] === "from the leaf")).toBe(true);
    });
  }

  test("KNOWN POSITIVE: with no gate at either end the leaf rewrites the hearth's canon", async () => {
    const { leaf, canon } = crossing({ hearth: false, leaf: false });
    const leafCanon = await tryFind(leaf, canon.url);
    leafCanon!.change((d) => { d.tiddlers["law"] = "rewritten by the leaf"; });
    expect(await until(() => canon.doc().tiddlers["law"] === "rewritten by the leaf")).toBe(true);
  });
});
