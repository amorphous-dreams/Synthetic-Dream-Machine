/**
 * face-slot-seal-restart — A FACE'S PERSONAL LAYER, SEALED FROM ITS FIRST BYTE, REOPENS AFTER THE VESSEL RESTARTS, UNDER THE
 * PRODUCTION STANDING.
 *
 * `face-slot-docs-sealed` (mesh) proves the restart under a standing that reads every writer capable (`holdsWrite: () =>
 * true`). The island stands its holder on `ownChainStanding(() => ownChain, () => daemonAuth.registerBags)`
 * (operator-daemon-behavior), and its boot's register set comes from `wornFaceWikiBags` (open-node-vessel): the mount's
 * own personal layer and each layer the face's catalog announces ride it, and any other face slot bag (`wikis/<slug>/personal`)
 * joins when the resolver names it (`registerLateFaceBags`). The holder's reading gives way when that set grows
 * (`WriterStanding.registeredOf`), so a personal layer named after another sealed document opened founds at its own open. These
 * vectors stand the same map and rest as the mesh vectors, over that standing, with the register set the boot hands and
 * the late registration the naming makes.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lararium/api/personal-slot
 */
import { afterEach, describe, expect, it } from "vitest";
import { Repo, type AutomergeUrl, type Chunk, type StorageAdapterInterface, type StorageKey } from "@automerge/automerge-repo";
import { faceProofSubjectRef } from "../../lararium-mesh/src/face-proof-subjects.js";
import type { RecordSigner } from "../../lararium-mesh/src/sealed-records.js";
import { answerDocStoreAsks, composeSealedRest, sealedBagMap, vesselDocStoreDoor, type SealedRest } from "../../lararium-mesh/src/sealed-rest.js";
import { wornFaceWikiBags, type WikiSlotBags } from "../../lararium-mesh/src/register-bags.js";
import { wikiBagUri, wikiSlotUri } from "../../lararium-mesh/src/wiki-recipe.js";
import type { SessionOwnChain } from "../../lararium-mesh/src/index.js";
import { vessel, world, type Vessel } from "../../lararium-mesh/tests/content-key-fixture.js";
import { ownChainStanding } from "../../lararium-keyhive/src/island-session-proof.js";

const SECRET = "the-personal-layer-holds-the-heron-count";
const SLOT: WikiSlotBags = { wikiBagId: wikiBagUri("lares"), workingBagId: wikiSlotUri("lares", "working"), draftBagId: wikiSlotUri("lares", "draft") };
/** The mount's own personal layer: the boot's register set carries it (`wornFaceWikiBags`). */
const MOUNT_PERSONAL = wikiSlotUri("lares", "personal");
/** Another wiki's personal layer no catalog row announced: it joins the register set at the resolver's naming. */
const LATE_PERSONAL = wikiSlotUri("notes", "personal");
const DAEMON_WORKING = wikiSlotUri("daemon", "working");
/** The register set the boot hands the island: the mount slot with its personal layer, and the lit face's own (open-node-vessel). */
const BOOT_REGISTERED = (): string[] => wornFaceWikiBags({ slot: SLOT, lit: true }).registered;

function memoryAdapter(): StorageAdapterInterface {
  const bytes = new Map<string, Uint8Array>();
  const name = (key: StorageKey): string => key.join("\u0000");
  const starts = (key: string, prefix: StorageKey): boolean => key.split("\u0000").slice(0, prefix.length).join("\u0000") === name(prefix);
  return {
    async load(key) { const got = bytes.get(name(key)); return got ? Uint8Array.from(got) : undefined; },
    async save(key, data) { bytes.set(name(key), Uint8Array.from(data)); },
    async remove(key) { bytes.delete(name(key)); },
    async loadRange(prefix): Promise<Chunk[]> {
      return [...bytes].filter(([key]) => starts(key, prefix)).map(([key, data]) => ({ key: key.split("\u0000"), data: Uint8Array.from(data) }));
    },
    async removeRange(prefix) { for (const key of [...bytes.keys()]) if (starts(key, prefix)) bytes.delete(key); },
  };
}

type Session = { readonly id: string; readonly subject: string; readonly signer: RecordSigner };
const ports: MessagePort[] = [];
afterEach(() => { while (ports.length) ports.pop()!.close(); });
const portOf = (p: MessagePort) => {
  ports.push(p);
  return {
    post: (msg: unknown) => p.postMessage(msg),
    listen: (cb: (msg: unknown) => void) => { const h = (e: MessageEvent) => cb(e.data); p.addEventListener("message", h as never); p.start(); return () => p.removeEventListener("message", h as never); },
  };
};

/** One island's state the standing reads: the chain the last session carried, and `daemonAuth.registerBags`. */
interface Island { registered: string[]; chain: SessionOwnChain | null }

async function house() {
  const w = world();
  const island: Island = { registered: BOOT_REGISTERED(), chain: null };
  const a = await vessel(w, "a", { standing: ownChainStanding(() => island.chain, () => island.registered) });
  island.chain = { scope: { faceKey: a.chain.scope.faceKey, nexus: a.chain.scope.nexus }, vesselFaceKey: a.chain.sessionCertificate.vesselFaceKey } as SessionOwnChain;
  return { a, island, inner: memoryAdapter(), named: new Map<string, Set<string>>() };
}

/** The vessel's sealed rest, its map composed as the node vessel composes it (as `face-slot-docs-sealed` stands it). */
function standVessel(a: Vessel, inner: StorageAdapterInterface, named: Map<string, Set<string>>) {
  const own = faceProofSubjectRef(a.chain.scope);
  const channel = new MessageChannel();
  const vesselSide = portOf(channel.port1), islandSide = portOf(channel.port2);
  const asks = new Map<string, { verb: string; session: Session }>();
  answerDocStoreAsks(islandSide, {
    async seal({ bagId, values, ask, peer }) {
      const booked = asks.get(ask.requestId);
      if (!booked || booked.verb !== ask.verb) return { refusal: "signer-unavailable" } as never;
      return a.holder.sealValues({ bagId, values, signer: booked.session.signer, ...(peer !== undefined ? { peer } : {}) });
    },
    open: (args) => a.holder.openValue(args),
  });
  const map = sealedBagMap({
    face: () => own,
    bags: () => wornFaceWikiBags({ slot: SLOT, lit: true, announced: named.keys() }).sealed,
    docsOf: (bagId) => [...(named.get(bagId) ?? [])],
  });
  let repo: Repo | null = null;
  const rest: SealedRest<Session> = composeSealedRest<Session>({
    inner,
    bagOf: (documentId) => map.bagOf(documentId),
    sessionFace: () => own,
    door: vesselDocStoreDoor<Session>(() => vesselSide, {
      book: (ask, verb, session) => { asks.set(ask, { verb, session }); return () => asks.delete(ask); },
      idPrefix: "test",
    }),
    flushRepo: async () => { await repo?.flush(); },
  });
  return { rest, own, map, session: { id: "s-a", subject: own, signer: a.signer } as Session, seat: (r: Repo) => { repo = r; } };
}

/** The resolver's naming, as the island runs it: `registerLateFaceBags` first, then the vessel files the name. */
const announce = (island: Island, named: Map<string, Set<string>>, bagId: string, documentId: string): void => {
  if (!island.registered.includes(bagId)) island.registered = [...island.registered, bagId];
  const set = named.get(bagId) ?? new Set<string>();
  set.add(documentId);
  named.set(bagId, set);
};

/** A daemon slot doc (registered at boot) and the personal layer, both sealed from the first byte in one boot. */
async function firstBoot(h: Awaited<ReturnType<typeof house>>, PERSONAL: string) {
  const v = standVessel(h.a, h.inner, h.named);
  const repo = new Repo({ storage: v.rest.store, network: [] });
  v.seat(repo);
  const daemon = repo.create<{ note?: string }>();
  announce(h.island, h.named, DAEMON_WORKING, daemon.documentId);
  v.rest.wrote(daemon.documentId, v.session);
  daemon.change((d) => { d.note = "daemon-ledger"; });
  const personalLayer = repo.create<{ note?: string }>();
  announce(h.island, h.named, PERSONAL, personalLayer.documentId);
  v.rest.wrote(personalLayer.documentId, v.session);
  personalLayer.change((d) => { d.note = SECRET; });
  await repo.flush();
  await v.rest.store.flush();
  expect(await v.rest.restsSealed(personalLayer.documentId)).toBe(true);
  await repo.shutdown();
  return { daemonId: daemon.documentId, personalId: personalLayer.documentId };
}

/** A new process over the same rest: a fresh holder, the boot's register set, the vessel's names re-filed by the island. */
function restart(h: Awaited<ReturnType<typeof house>>) {
  h.a.restart();
  h.island.registered = BOOT_REGISTERED();
  const v = standVessel(h.a, h.inner, h.named);
  return { v, repo: new Repo({ storage: v.rest.store, network: [] }) };
}

const read = async (repo: Repo, id: string): Promise<string> => {
  try { return ((await repo.find<{ note?: string }>(id as unknown as AutomergeUrl)).doc() as { note?: string }).note ?? "(no note)"; }
  catch (error) { return `REFUSED: ${error instanceof Error ? error.message : String(error)}`; }
};

describe("a face's personal layer reopens sealed after a restart, under the production standing", () => {
  it("BOOT SET: the register set the boot hands carries the mount's own personal layer, and a personal layer no catalog row announced joins at its naming", () => {
    expect(BOOT_REGISTERED()).toContain(MOUNT_PERSONAL);
    expect(BOOT_REGISTERED()).toContain(DAEMON_WORKING);
    expect(BOOT_REGISTERED()).not.toContain(LATE_PERSONAL);
  });

  it("THE MOUNT'S PERSONAL LAYER opens on the boot's register set alone, after another sealed document opened", async () => {
    const h = await house();
    const { daemonId, personalId } = await firstBoot(h, MOUNT_PERSONAL);
    const { repo } = restart(h);
    expect(await read(repo, daemonId)).toBe("daemon-ledger");
    expect(await read(repo, personalId)).toBe(SECRET);
    await repo.shutdown();
  });

  it("A LATE-NAMED PERSONAL LAYER: the naming re-registers before the holder's first reading, and the personal layer opens", async () => {
    const h = await house();
    const { personalId } = await firstBoot(h, LATE_PERSONAL);
    const { repo } = restart(h);
    // The island names the personal layer again before any sealed document of this boot opens.
    h.island.registered = [...h.island.registered, LATE_PERSONAL];
    expect(await read(repo, personalId)).toBe(SECRET);
    await repo.shutdown();
  });

  it("A LATE-NAMED PERSONAL LAYER: another sealed document opens first (the holder takes its reading), then the naming re-registers, and the personal layer opens", async () => {
    const h = await house();
    const { daemonId, personalId } = await firstBoot(h, LATE_PERSONAL);
    const { repo } = restart(h);
    // THE BOOT'S ORDER: the daemon's own slot (registered at boot) hydrates before the resolver names any personal layer.
    expect(await read(repo, daemonId)).toBe("daemon-ledger");
    // The resolver names the personal layer: `registerLateFaceBags` adds it to the register set the standing reads.
    h.island.registered = [...h.island.registered, LATE_PERSONAL];
    expect(await read(repo, personalId)).toBe(SECRET);
    await repo.shutdown();
  });

  it("BOOKINGS HOLD: a document booked and open before the register set grows keeps sealing after it, and the personal layer opens beside it", async () => {
    const h = await house();
    const { daemonId, personalId } = await firstBoot(h, LATE_PERSONAL);
    const { v, repo } = restart(h);
    v.seat(repo);
    const daemon = await repo.find<{ note?: string; later?: string }>(daemonId as unknown as AutomergeUrl);
    v.rest.wrote(daemonId, v.session);
    daemon.change((d) => { d.note = "booked-before-the-growth"; });
    await repo.flush();
    await v.rest.store.flush();
    expect(v.rest.store.waiting(daemonId), "the booked save rested sealed before the growth").toBe(0);
    // THE GROWTH, mid-boot: the holder's reading gives way, and the book the rest holds stands as it stood.
    h.island.registered = [...h.island.registered, LATE_PERSONAL];
    expect(await read(repo, personalId)).toBe(SECRET);
    daemon.change((d) => { d.later = "written-after-the-growth"; });
    await repo.flush();
    await v.rest.store.flush();
    expect(v.rest.store.waiting(daemonId), "the booked document's save after the growth rested sealed, none waiting").toBe(0);
    await repo.shutdown();
    const next = restart(h);
    const again = (await next.repo.find<{ note?: string; later?: string }>(daemonId as unknown as AutomergeUrl)).doc();
    expect(again).toMatchObject({ note: "booked-before-the-growth", later: "written-after-the-growth" });
    await next.repo.shutdown();
  });
});
