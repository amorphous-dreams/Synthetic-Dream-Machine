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
 * EACH HAT ITS OWN CHAIN (vessel-audit P1 #2): two faces stand lit, the worn A and the sibling B, and B's save travels the
 * actual route: the vessel's session sign book (`SessionSignBook`), the island's session door (`islandSessionDoor`) over a
 * port, the island's face seats (`faceSeatTable`) and the document store's door both ways. B seals under B's chain, B's
 * holder and B's fold; B's lock leaves A sealing.
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
import { islandSessionDoor, ownChainStanding } from "../../lararium-keyhive/src/island-session-proof.js";
import { faceSeatTable, type FaceSeatTable } from "../../lararium-keyhive/src/face-seat-table.js";
import type { ContentKeySeat } from "../../lararium-keyhive/src/content-key-seat.js";
import { SessionSignBook, type BookedSession } from "../../lararium-mesh/src/session-sign-book.js";
import { answerSessionSign } from "../../lararium-mesh/src/capability-record.js";

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

// ── EACH HAT ITS OWN CHAIN ──────────────────────────────────────────────────────────────────────────────────────────
const SECRET_B = "the-sibling-keeps-the-crane-count";
const ATOM_B = "atom-of-face-b";
type HatSession = Session & { readonly booked: BookedSession };

/** A fixture holder as the island's seat reads it, counting the seals it makes. */
function seatOf(v: Vessel, sealed: string[], name: string): ContentKeySeat {
  return {
    get holder() { return v.holder; },
    sealValues: async (args: Parameters<ContentKeySeat["sealValues"]>[0]) => { sealed.push(name); return v.holder.sealValues(args); },
    lock: () => {},
  } as unknown as ContentKeySeat;
}

const ownChainOf = (v: Vessel): SessionOwnChain =>
  ({ scope: { faceKey: v.chain.scope.faceKey, nexus: v.chain.scope.nexus }, vesselFaceKey: v.chain.sessionCertificate.vesselFaceKey }) as SessionOwnChain;

async function hats() {
  const w = world();
  let table!: FaceSeatTable;
  const a = await vessel(w, "a", { standing: ownChainStanding(() => table.mounted.chain, BOOT_REGISTERED) });
  const b = await vessel(w, "b", { standing: ownChainStanding(() => table.lit(ATOM_B)?.chain ?? null, BOOT_REGISTERED) });
  const faceA = faceProofSubjectRef(a.chain.scope), faceB = faceProofSubjectRef(b.chain.scope);
  const lit = new Set<string>([faceA, faceB]);
  const signerOf = (v: Vessel) => {
    const s = { dropped: false, certificate: v.signer.certificate, sign: async (purpose: "act", payload: Uint8Array) => (s.dropped ? { refusal: "signer-refused" } : v.signer.sign(purpose, payload) as never) };
    return s;
  };
  const sessionA: HatSession = { id: "s-a", subject: faceA, signer: a.signer, booked: { signer: signerOf(a), anchor: { kind: "nexus" }, subject: faceA } };
  const sessionB: HatSession = { id: "s-b", subject: faceB, signer: b.signer, booked: { signer: signerOf(b), anchor: { kind: "nexus" }, subject: faceB, face: ATOM_B } };
  // THE VESSEL'S SIDE: one book, one door; each face's chain and fold as the vessel reads it (B's only while B stands lit).
  const book = new SessionSignBook();
  const raisesRead: Array<string | null> = [];
  const caps = {
    sessionSign: book.door(
      (face) => (face === null ? ownChainOf(a) : face === ATOM_B && lit.has(faceB) ? ownChainOf(b) : null),
      async (face) => { raisesRead.push(face ?? null); return { read: true, counted: [], unanswered: [] }; },
    ),
  };
  const signChannel = new MessageChannel();
  const vesselSign = portOf(signChannel.port1), islandSign = portOf(signChannel.port2);
  vesselSign.listen((m) => {
    const ask = m as { type?: string; requestId?: string };
    if (ask?.type !== "session:sign" || typeof ask.requestId !== "string") return;
    void answerSessionSign(caps, ask as never).then((reply) => vesselSign.post(reply));
  });
  // THE ISLAND'S SIDE: the session door over the port, the face seats, and the document store's door.
  table = faceSeatTable({ proof: () => sessionDoor });
  const sessionDoor = islandSessionDoor({ post: (msg) => islandSign.post(msg), listen: (cb) => { islandSign.listen(cb); } }, { idPrefix: "hats" });
  const sealed: string[] = [];
  const standSeats = (): void => { table.mounted.seat = seatOf(a, sealed, "a"); table.light(ATOM_B, seatOf(b, sealed, "b")); };
  standSeats();
  const inner = memoryAdapter();
  const docsOfB = new Set<string>();
  const held: string[] = [];
  const vesselRest = () => {
    const storeChannel = new MessageChannel();
    const vesselStore = portOf(storeChannel.port1), islandStore = portOf(storeChannel.port2);
    answerDocStoreAsks(islandStore, table.docStoreHolder());
    let repo: Repo | null = null;
    const rest: SealedRest<HatSession> = composeSealedRest<HatSession>({
      inner,
      bagOf: (documentId) => ({ bagId: DAEMON_WORKING, face: docsOfB.has(documentId) ? faceB : faceA }),
      sessionFace: () => faceA,
      openFaces: () => [...lit],
      door: vesselDocStoreDoor<HatSession>(() => vesselStore, {
        book: (ask, verb, session) => book.hold(ask, verb, session.booked),
        idPrefix: "hats",
        faceKeyOf: (subject) => (subject === faceB ? ATOM_B : undefined),
      }),
      flushRepo: async () => { await repo?.flush(); },
      onHeld: (notice) => held.push(`${notice.refusal}:${docsOfB.has(notice.documentId) ? "b" : "a"}${notice.cause ? `:${notice.cause.split(" — ")[0]}` : notice.error ? `:${notice.error.split(" — ")[0]}` : ""}`),
    });
    repo = new Repo({ storage: rest.store, network: [] });
    return { rest, repo };
  };
  return { a, b, faceA, faceB, lit, sessionA, sessionB, table, sealed, raisesRead, docsOfB, held, vesselRest, standSeats };
}

describe("each hat its own chain: a sibling's save seals under the sibling, through the book-to-holder route", () => {
  it("B SEALS UNDER B: B's save books B's session, reads B's chain and B's fold, and seals through B's holder; A's beside it seals through A's; both reopen after a restart", async () => {
    const h = await hats();
    const { rest, repo } = h.vesselRest();
    const docB = repo.create<{ note?: string }>();
    h.docsOfB.add(docB.documentId);
    rest.wrote(docB.documentId, h.sessionB);
    docB.change((d) => { d.note = SECRET_B; });
    await repo.flush();
    await rest.store.flush();
    expect(h.held, "nothing of B's held").toEqual([]);
    expect(rest.store.waiting(docB.documentId), "B's save rested, none waiting").toBe(0);
    expect(await rest.restsSealed(docB.documentId)).toBe(true);
    expect(h.sealed).toEqual(expect.arrayContaining(["b"]));
    expect(h.sealed).not.toContain("a");
    expect(h.raisesRead).toContain(ATOM_B);
    const docA = repo.create<{ note?: string }>();
    rest.wrote(docA.documentId, h.sessionA);
    docA.change((d) => { d.note = SECRET; });
    await repo.flush();
    await rest.store.flush();
    expect(await rest.restsSealed(docA.documentId)).toBe(true);
    expect(h.sealed).toContain("a");
    // THE MOUNTED FACE'S READING STANDS ITS OWN: B's session never wrote A's chain.
    expect(h.table.mounted.chain).toEqual(ownChainOf(h.a));
    await repo.shutdown();
    h.a.restart(); h.b.restart(); h.standSeats();
    const next = h.vesselRest();
    expect(await read(next.repo, docB.documentId)).toBe(SECRET_B);
    expect(await read(next.repo, docA.documentId)).toBe(SECRET);
    await next.repo.shutdown();
  });

  it("B'S LOCK LEAVES A WORKING: B shut, B's next save waits by name and seals nothing; A's keeps sealing under A", async () => {
    const h = await hats();
    const { rest, repo } = h.vesselRest();
    const docB = repo.create<{ note?: string }>();
    h.docsOfB.add(docB.documentId);
    rest.wrote(docB.documentId, h.sessionB);
    docB.change((d) => { d.note = "before the lock"; });
    const docA = repo.create<{ note?: string }>();
    rest.wrote(docA.documentId, h.sessionA);
    docA.change((d) => { d.note = "a before"; });
    await repo.flush();
    await rest.store.flush();
    expect(rest.store.waiting(docB.documentId)).toBe(0);
    // THE LOCK OF B: the vessel drops B's signer and B leaves the lit set; the island closes B's entry.
    (h.sessionB.booked.signer as { dropped: boolean }).dropped = true;
    h.lit.delete(h.faceB);
    h.table.drop(ATOM_B);
    await rest.lock(h.sessionB.id);
    const before = h.sealed.length;
    docB.change((d) => { d.note = "after the lock"; });
    docA.change((d) => { d.note = "a after"; });
    await repo.flush();
    await rest.store.flush();
    expect(rest.store.waiting(docB.documentId), "B's save waits in memory").toBeGreaterThan(0);
    expect(h.sealed.slice(before)).toEqual(expect.arrayContaining(["a"]));
    expect(h.sealed.slice(before)).not.toContain("b");
    expect(h.table.lit(ATOM_B)).toBeUndefined();
    await repo.shutdown();
  });

  it("B UNADMITTED ON THE ISLAND: the vessel answers B's chain but the island holds B shut; B's save refuses face-not-open on its own, and A seals", async () => {
    const h = await hats();
    h.table.drop(ATOM_B);
    const { rest, repo } = h.vesselRest();
    const docB = repo.create<{ note?: string }>();
    h.docsOfB.add(docB.documentId);
    rest.wrote(docB.documentId, h.sessionB);
    docB.change((d) => { d.note = "no seat stands for b"; });
    const docA = repo.create<{ note?: string }>();
    rest.wrote(docA.documentId, h.sessionA);
    docA.change((d) => { d.note = "a seals"; });
    await repo.flush();
    await rest.store.flush();
    expect(h.held).toContain("save-unsealed:b:[daemon] docstore-seal: face-not-open");
    expect(rest.store.waiting(docB.documentId)).toBeGreaterThan(0);
    expect(await rest.restsSealed(docA.documentId)).toBe(true);
    expect(h.sealed).toEqual(["a"]);
    expect(h.table.mounted.chain).toEqual(ownChainOf(h.a));
    await repo.shutdown();
  });
});

