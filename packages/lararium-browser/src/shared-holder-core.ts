/**
 * shared-holder-core — THE HOUSE BEHIND THE LOCK: one house per (face, persona root), a port per tab.
 *
 * The Web Lock (vessel-lock.ts) refuses a second holder over one store. This core IS the one holder: it runs
 * inside a module SharedWorker (shared-holder.worker.ts) and takes the store's lock for its own life. A connecting
 * port receives a greeting with a nonce and nothing else: it answers no ask until its tab admits a session.
 *
 * A tab opens a session by presenting its face's countersigned device edge and its atom's signature over
 * (ownerEpoch, sessionId, nonce, personaGroup). The holder checks the signature under the edge's atom key and the
 * edge whole (root half and atom countersignature). The edge names a persona root and no group, so a claimed group
 * is no authority: a house keys by the PAIR (PersonaGroup, persona root), and a claim under a foreign root fills a
 * house of its own that holds none of the real one's island, Repo or store.
 *
 * A house PROVES its face through its own island. The first session's edge reaches the island with the tab's manifest;
 * the island's Binding Gate walks the pinned KEL, folds the lease frontier and reads the dyad shadow, then posts
 * `gate:clear` naming the digest of the edge and the root it verified (or `gate:refused` with a cause). The house
 * admits a session only for the edge the gate named, and every later session must present the same signed proof
 * (`session-edge-other` otherwise). The digest covers signed fields and signatures; an unsigned extra property on
 * the presented object leaves that proof unchanged. Until the gate clears, nothing flows to a tab: the claimant hears its island's
 * boot handshake alone, every other port hears nothing, and the house Repo withholds its frames from the tab.
 *
 * Each house holds its own island, Repo, ports, owner, pending requests and camera leases. An island answer reaches
 * the ports of its own house alone. A sealing ask (`custody:write`) goes to a tab of that house that announced it can
 * seal (`session:sealer`), since the key rests in the tab; with none ready the ask waits, named `seal-awaits-session`,
 * and lands when one announces. A house ends when its last session closes, its gate refuses, or its island faults:
 * the island ends, the Repo shuts down, and surviving ports hear the named end and `holder:lock`.
 * Each tab drops its own custody on that lock. One terminal state per house keeps ended houses closed.
 *
 * Pure: the lock surface, the island and Repo spawns and the ports ride in, so a witness drives it with fakes.
 * The worker entry wires the platform pieces around it and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/moves
 */

import type { LockHost } from "./vessel-lock.js";
import { defaultCryptoProvider } from "@lararium/mesh/crypto";
import { validateSessionEnvelope, type SessionEnvelope } from "@lararium/mesh/session-contract";
import { deviceEdgeDigest, verifyHolderSessionProof, type DeviceDelegationTiddler } from "@lararium/mesh/holder-session-proof";
import { HOLDER_ROUTES } from "./holder-routes.js";
import { TAB_REQUESTS } from "./holder-admission.js";

type WireMessage = Record<string, unknown> & { type: string };

function wireMessage(raw: unknown): WireMessage | null {
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") return null;
  return raw as WireMessage;
}

/** What the holder owns per face — the daemon island's worker handle, by the mesh handle shape. */
export interface HolderIsland {
  post(msg: unknown, transfer?: unknown[]): void;
  listen(onMessage: (raw: unknown) => void): () => void;
  onError(cb: (err: Error) => void): () => void;
  terminate(): void;
}

/**
 * One face house's Repo. The holder holds documents and ciphertext and no key. A Repo that takes sync ports
 * (`attachPeer`) stands as the hub between its house's island and its house's tabs: the holder hands it the tab's
 * end of the manifest channel and gives the island a fresh channel to the same Repo. A tab's port comes with the
 * promise that settles when the house's gate clears and a promise that settles when the house ends: the Repo
 * withholds its frames from that tab until clearance and closes every peer when the house ends.
 */
export interface HolderRepo {
  shutdown(): Promise<void>;
  attachPeer?(port: MessagePort, serving?: Promise<void>, closed?: Promise<void>): void;
}

/** The greeting every tab receives on connect. */
export interface HolderHello {
  readonly kind:         "holder:hello";
  readonly ownerEpoch:   string;
  readonly sessionId:    string;
  readonly generation:   number;
  /** Random per port: the atom signs it with the session ids, so a proof binds to this port and no other. */
  readonly nonce:        string;
  /** How many times this holder booted an island, one per face house it stood. */
  readonly islandBoots:  number;
  /** How many ports stand connected, this one included. */
  readonly tabs:         number;
  /** The lock client the platform reports for this holder — a tab compares it to the lock's holder to ATTACH. */
  readonly lockClientId: string | null;
}

/** The refusal a holder names to one port: a lock it cannot take, or an ask it will not answer. */
export interface HolderRefused {
  readonly kind: "holder:refused";
  readonly storeName: string;
  readonly cause: string;
}

/** The holder admitted this port's session as a member of one face's house. */
export interface HolderAdmitted {
  readonly kind: "holder:admitted";
  readonly personaGroup: string;
}

/** A house ended under this port's session: its gate refused, its island faulted or its claimant left. */
export interface HolderHouseEnded {
  readonly kind: "holder:house-ended";
  readonly personaGroup: string;
  readonly cause: string;
}

/** The face locked: a tab that wears it drops its unlock. */
export interface HolderLock {
  readonly kind: "holder:lock";
  readonly personaGroup: string;
}

/** A port as the holder sees it — the two members `MessagePort` and a fake alike carry. */
export interface HolderPort {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", cb: (e: MessageEvent) => void): void;
  start?(): void;
}

export interface SharedHolderCoreOptions {
  readonly lockName:    string;
  readonly locks:       LockHost | null;
  /** Stand the daemon island of one face house; `edgeDigest` names the edge the first session presented. */
  readonly spawnIsland: (personaGroup: string, personaRoot: string, edgeDigest: string) => HolderIsland;
  /** Stand the Repo of one face house; the holder shuts it down with the house. */
  readonly makeRepo?:   (personaGroup: string, personaRoot: string) => HolderRepo | Promise<HolderRepo>;
  /** A sealing ask waits because no ready tab of its face stands. */
  readonly onWait?:     (kind: "seal-awaits-session", personaGroup: string, messageType: string) => void;
  readonly onDrop?: (kind: string, reason: string) => void;
  /** Watch a minted session until its tab releases its lifetime lock. */
  readonly watchSession?: (sessionId: string, onDead: () => void) => void;
  /** Start the queued watch once the tab has opened under its held lock. */
  readonly armSession?: (sessionId: string) => void;
  readonly forgetSession?: (sessionId: string) => void;
  readonly mint?: () => string;
}

export interface SharedHolderCore {
  /** A tab connected: greet it. It answers nothing until its tab admits a session. */
  connect(port: HolderPort): Promise<void>;
  disconnect(port: HolderPort): void;
  readonly islandBoots: number;
  readonly tabs:        number;
  readonly houses:      number;
}

/** The island kinds a house's claimant hears while its island proves the face: the boot handshake and the gate's own asks. */
const PROVING_KINDS = new Set(["ready", "ea", "breath", "fault", "teardown:ack", "cas:want", "doc:rest"]);
const BOOT_REPLIES: Readonly<Record<string, string>> = { "cas:block": "cas:want", "doc:rested": "doc:rest" };

interface PortState {
  readonly envelope: SessionEnvelope;
  readonly nonce:    string;
  /** The house this port joined, once its session opened. */
  house:             House | null;
  admitted:          boolean;
  opening:           boolean;
}

/** One face's house: its island, Repo, ports and the routes between them. */
interface House {
  readonly key:   string;
  readonly group: string;
  readonly root:  string;
  state:          "standing" | "ended";
  repo:           HolderRepo | null;
  readonly ready: Promise<void>;
  /** Sessions still verifying or waiting on the Repo: a house with one never ends for want of ports. */
  admitting:      number;
  island:         HolderIsland | null;
  unlisten:       Array<() => void>;
  /** The digest of the edge the first session presented: the one edge this house's gate may clear. */
  edgeDigest:     string | null;
  cleared:        boolean;
  served:         Promise<void>;
  serve:          () => void;
  endServing:     (reason: Error) => void;
  closed:         Promise<void>;
  endClosed:      () => void;
  bootRequests:   Set<string>;
  manifestSent:   boolean;
  /** The first session, whose manifest boots the island; it hears the boot handshake while the island proves. */
  claimant:       HolderPort | null;
  readonly ports:    HolderPort[];
  readonly sealers:  Set<HolderPort>;
  readonly pending:  Map<string, { port: HolderPort; requestId: string }>;
  readonly cameras:  Map<string, HolderPort>;
  readonly queue:    WireMessage[];
  owner:          HolderPort | null;
}

const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

export function makeSharedHolderCore(opts: SharedHolderCoreOptions): SharedHolderCore {
  const ports = new Set<HolderPort>();
  const ended = new WeakSet<HolderPort>();
  const sessions = new Map<string, HolderPort>();
  const portStates = new Map<HolderPort, PortState>();
  const houses = new Map<string, House>();
  const mint = opts.mint ?? (() => defaultCryptoProvider.randomUUID());
  const ownerEpoch = mint();
  if (!ownerEpoch) throw new Error("owner-epoch-absent");
  const requestNamespace = crypto.randomUUID();
  let nextRequest = 0;
  let islandBoots = 0;
  let lockClientId: string | null = null;
  let lockTaken: Promise<void> | null = null;
  const onDrop = opts.onDrop ?? ((kind: string, reason: string) => {
    console.warn(`[shared-holder] dropped ${kind}: ${reason}`);
  });
  const deliver = (port: HolderPort, message: WireMessage): void => {
    const state = portStates.get(port);
    if (state) port.postMessage({ ...message, ...state.envelope });
  };
  const refuse = (port: HolderPort, cause: string, kind: string): void => {
    const state = portStates.get(port);
    port.postMessage({ kind: "holder:refused", storeName: opts.lockName, cause, ...(state?.envelope ?? {}) });
    onDrop(kind, cause);
  };

  /** The tab to seal for a house: its owner when ready, else the first ready session in admission order. */
  const sealerOf = (house: House): HolderPort | null => {
    if (house.owner && house.sealers.has(house.owner) && ports.has(house.owner)) return house.owner;
    return house.ports.find((p) => house.sealers.has(p) && ports.has(p)) ?? null;
  };
  const flushQueue = (house: House): void => {
    if (!house.cleared) return;
    while (house.queue.length > 0) {
      const sealer = sealerOf(house);
      if (!sealer) return;
      deliver(sealer, house.queue.shift()!);
    }
  };

  /**
   * End a house once. `cause` names why when the house ends under a session (its gate refused, its island faulted or
   * its claimant left); a house whose last session closed ends without one. Surviving ports hear the named end and
   * the lock, and fall back to unadmitted.
   */
  const closeHouse = (house: House, cause: string | null): void => {
    if (house.state === "ended") return;
    house.state = "ended";
    house.endClosed();
    if (!house.cleared) house.endServing(new Error(cause ?? "house ended before its gate cleared"));
    if (houses.get(house.key) === house) houses.delete(house.key);
    for (const stop of house.unlisten.splice(0)) stop();
    house.island?.terminate();
    for (const port of house.ports.splice(0)) {
      const state = portStates.get(port);
      if (state) { state.house = null; state.admitted = false; }
      if (!ports.has(port)) continue;
      if (cause !== null) deliver(port, { type: "holder:house-ended", kind: "holder:house-ended", personaGroup: house.group, cause } as unknown as WireMessage);
      deliver(port, { type: "holder:lock", kind: "holder:lock", personaGroup: house.group } as unknown as WireMessage);
    }
    house.sealers.clear(); house.pending.clear(); house.cameras.clear(); house.queue.length = 0;
    house.owner = null; house.claimant = null;
    let shut: Promise<void>;
    try { shut = house.repo ? house.repo.shutdown() : Promise.resolve(); } catch (error) { shut = Promise.reject(error); }
    void shut.catch((error) => onDrop("repo:shutdown", error instanceof Error ? error.message : String(error)));
  };

  /** The island proved the face for the edge it names: serve the house, or end it for an edge no session presented. */
  const settleGate = (house: House, msg: WireMessage): void => {
    if (house.cleared) return;
    if (msg.type === "gate:refused") {
      closeHouse(house, `gate refused: ${String(msg["cause"])}`);
      return;
    }
    if (msg["edgeDigest"] !== house.edgeDigest || msg["personaRoot"] !== house.root) {
      for (const port of [...house.ports]) refuse(port, "session-edge-other", msg.type);
      closeHouse(house, null);
      return;
    }
    house.cleared = true;
    house.serve();
    for (const port of house.ports) {
      const state = portStates.get(port);
      if (state && !state.admitted) {
        state.admitted = true;
        deliver(port, { type: "holder:admitted", kind: "holder:admitted", personaGroup: house.group } as unknown as WireMessage);
      }
    }
    flushQueue(house);
  };

  const routeFromIsland = (house: House) => (raw: unknown): void => {
    if (house.state === "ended") return;
    const msg = wireMessage(raw);
    if (!msg) { onDrop("unknown", "invalid-message"); return; }
    if (msg.type === "gate:clear" || msg.type === "gate:refused") { settleGate(house, msg); return; }
    const route = HOLDER_ROUTES[msg.type as keyof typeof HOLDER_ROUTES];
    if (!route) { onDrop(msg.type, "unknown-route"); return; }
    if (!house.cleared) {
      // While the island proves the face, the claimant hears the boot handshake and nothing else; a sealing ask waits.
      if (msg.type === "custody:write") { house.queue.push(msg); return; }
      if (route === "owner" && PROVING_KINDS.has(msg.type) && house.claimant && ports.has(house.claimant)) {
        if ((msg.type === "cas:want" || msg.type === "doc:rest") && typeof msg.requestId === "string") house.bootRequests.add(`${msg.type}:${msg.requestId}`);
        deliver(house.claimant, msg); return;
      }
      onDrop(msg.type, "house-uncleared");
      return;
    }
    if (route === "owner") {
      if (msg.type === "custody:write") {
        const sealer = sealerOf(house);
        if (!sealer) {
          house.queue.push(msg);
          opts.onWait?.("seal-awaits-session", house.group, msg.type);
          return;
        }
        deliver(sealer, msg);
        return;
      }
      if (!house.owner || !ports.has(house.owner)) { onDrop(msg.type, "no-owner"); return; }
      deliver(house.owner, msg);
      return;
    }
    if (route === "camera") {
      const cameraId = msg.cameraId;
      if (typeof cameraId !== "string") { onDrop(msg.type, "missing-camera-id"); return; }
      const port = house.cameras.get(cameraId);
      if (!port || !ports.has(port)) { onDrop(msg.type, "no-camera-lease"); return; }
      deliver(port, msg);
      return;
    }
    const holderId = msg.requestId;
    if (typeof holderId !== "string") { onDrop(msg.type, "missing-request-id"); return; }
    const asking = house.pending.get(holderId);
    if (!asking || !ports.has(asking.port)) { onDrop(msg.type, "unknown-request"); return; }
    house.pending.delete(holderId);
    deliver(asking.port, { ...msg, requestId: asking.requestId });
  };

  // Take the store's lock for the holder's whole life. The callback's promise never settles, so the platform
  // never lets go; a reaped SharedWorker releases it the one way a crashed holder can.
  const takeLock = (): Promise<void> => {
    if (lockTaken) return lockTaken;
    const attempt = (async () => {
      if (!opts.locks || typeof opts.locks.request !== "function") {
        throw new Error(`[vessel] shared holder cannot open store "${opts.lockName}": this engine offers no Web Locks.`);
      }
      let granted: (v: boolean) => void = () => {};
      const grant = new Promise<boolean>((r) => { granted = r; });
      let requestFailure: string | null = null;
      void opts.locks.request(opts.lockName, { ifAvailable: true }, (lock) => {
        granted(lock !== null);
        return lock === null ? undefined : new Promise<never>(() => {});
      }).catch((error) => {
        requestFailure = error instanceof Error ? error.message : String(error);
        granted(false);
      });
      if (!(await grant)) {
        const cause = requestFailure ? `: ${requestFailure}` : " — another holder owns the lock";
        throw new Error(`[vessel] shared holder refused store "${opts.lockName}"${cause}.`);
      }
      if (typeof opts.locks.query === "function") {
        try {
          const held = (await opts.locks.query()).held ?? [];
          lockClientId = held.find((h) => h.name === opts.lockName)?.clientId ?? null;
        } catch { lockClientId = null; }
      }
    })();
    lockTaken = attempt;
    // A refusal describes this lock attempt, not the holder's whole lifetime. Once the other owner
    // releases, a later tab may retry through this same SharedWorker and become the sole holder.
    void attempt.catch(() => {
      if (lockTaken === attempt) lockTaken = null;
    });
    return attempt;
  };

  /** The standing house of one (group, root), or a new one whose Repo is being made. */
  const houseOf = (group: string, root: string): House => {
    const key = `${group}|${root}`;
    const standing = houses.get(key);
    if (standing && standing.state === "standing") return standing;
    let serve!: () => void;
    let endServing!: (reason: Error) => void;
    const served = new Promise<void>((resolve, reject) => { serve = resolve; endServing = reject; });
    let endClosed!: () => void;
    const closed = new Promise<void>((resolve) => { endClosed = resolve; });
    void served.catch(() => undefined);
    const house: House = {
      key, group, root, state: "standing", repo: null, ready: Promise.resolve(), admitting: 0,
      island: null, unlisten: [], edgeDigest: null, cleared: false, served, serve, endServing, closed, endClosed,
      bootRequests: new Set(), manifestSent: false, claimant: null,
      ports: [], sealers: new Set(), pending: new Map(), cameras: new Map(), queue: [], owner: null,
    };
    (house as { ready: Promise<void> }).ready = (async () => {
      if (opts.makeRepo) house.repo = await opts.makeRepo(group, root);
    })();
    houses.set(key, house);
    return house;
  };

  /** A session opened: verify it, join the house of its (group, root), and boot that house's island on the first. */
  const admitOnce = async (port: HolderPort, state: PortState, msg: WireMessage): Promise<void> => {
    const group = msg["personaGroup"];
    const edge = msg["edge"] as DeviceDelegationTiddler | undefined;
    const signature = msg["signature"];
    if (state.house !== null) { refuse(port, "session-open-malformed", msg.type); return; }
    if (typeof group !== "string" || group.length === 0 || typeof signature !== "string" || !edge || typeof edge !== "object") {
      refuse(port, "session-open-malformed", msg.type);
      return;
    }
    const reading = await verifyHolderSessionProof({
      edge, signature,
      fields: { ownerEpoch: state.envelope.ownerEpoch, sessionId: state.envelope.sessionId, nonce: state.nonce, personaGroup: group },
    });
    if (!reading.ok) { refuse(port, reading.reason, msg.type); return; }
    const root = edge.personaRootDid;
    const digest = deviceEdgeDigest(edge);
    // The house counts this admission before it waits on the Repo, so it cannot end under it; one that ended while
    // this session waited stands again fresh, and no port joins a house that has ended.
    let house = houseOf(group, root);
    for (;;) {
      house.admitting++;
      try { await house.ready; } catch (error) {
        house.admitting--;
        refuse(port, "session-unadmitted", msg.type);
        onDrop("house:repo", error instanceof Error ? error.message : String(error));
        closeHouse(house, null);
        return;
      }
      house.admitting--;
      if (house.state === "standing") break;
      if (ended.has(port)) return;
      house = houseOf(group, root);
    }
    if (ended.has(port)) {
      if (house.ports.length === 0 && house.admitting === 0) closeHouse(house, null);
      return;
    }
    if (house.edgeDigest !== null && house.edgeDigest !== digest) {
      refuse(port, "session-edge-other", msg.type);
      if (house.ports.length === 0 && house.admitting === 0) closeHouse(house, null);
      return;
    }
    state.house = house;
    house.ports.push(port);
    if (house.edgeDigest === null) {
      house.edgeDigest = digest;
      house.claimant = port;
      house.owner = port;
      const island = opts.spawnIsland(group, root, digest);
      house.island = island;
      islandBoots++;
      house.unlisten.push(island.listen(routeFromIsland(house)));
      house.unlisten.push(island.onError((error) => closeHouse(house, `island-crashed: ${error.message}`)));
      return;
    }
    if (house.cleared) {
      state.admitted = true;
      deliver(port, { type: "holder:admitted", kind: "holder:admitted", personaGroup: group } as unknown as WireMessage);
    }
  };
  const admit = async (port: HolderPort, state: PortState, msg: WireMessage): Promise<void> => {
    state.opening = true;
    try { await admitOnce(port, state, msg); }
    finally { state.opening = false; }
  };

  const forwardToIsland = (house: House, port: HolderPort, msg: WireMessage, e: MessageEvent): void => {
    const isl = house.island;
    if (!isl) { onDrop(msg.type, "island-absent"); return; }
    if (msg.type === "manifest") {
      if (house.owner && house.owner !== port) {
        refuse(port, "island-owned", msg.type);
        return;
      }
      if (house.manifestSent) { refuse(port, "session-unadmitted", msg.type); return; }
      house.owner = port;
      house.manifestSent = true;
    }
    if ((msg.type === "lar:control-event" || msg.type === "lar:resend") && typeof msg.cameraId === "string") {
      house.cameras.set(msg.cameraId, port);
    }
    const { ownerEpoch: _epoch, sessionId: _session, generation: _generation, ...islandMessage } = msg;
    let forwarded: unknown = islandMessage;
    if (TAB_REQUESTS.has(msg.type) && typeof msg.requestId === "string") {
      const holderId = `${requestNamespace}:${++nextRequest}`;
      house.pending.set(holderId, { port, requestId: msg.requestId });
      forwarded = { ...islandMessage, requestId: holderId };
    }
    let transfer = (e.ports ?? []) as unknown as unknown[];
    // THE REPO STANDS BETWEEN: a manifest's sync port carries the tab's Repo; the house Repo takes it as a peer,
    // withholding its frames until the gate clears, and the island syncs with the house Repo over a channel of its
    // own, so the island's documents rest in the holder.
    if (msg.type === "manifest" && house.repo?.attachPeer && transfer.length === 1) {
      const channel = new MessageChannel();
      house.repo.attachPeer(transfer[0] as MessagePort, house.served, house.closed);
      house.repo.attachPeer(channel.port1, undefined, house.closed);
      forwarded = { ...(islandMessage as Record<string, unknown>), syncPort: channel.port2 };
      transfer = [channel.port2];
    }
    isl.post(forwarded, transfer.length ? transfer : undefined);
  };

  const core: SharedHolderCore = {
    get islandBoots() { return islandBoots; },
    get tabs()        { return ports.size; },
    get houses()      { return houses.size; },
    disconnect(port) {
      ended.add(port);
      ports.delete(port);
      const state = portStates.get(port);
      if (state) { sessions.delete(state.envelope.sessionId); opts.forgetSession?.(state.envelope.sessionId); }
      portStates.delete(port);
      const house = state?.house;
      if (!house || house.state === "ended") return;
      const at = house.ports.indexOf(port);
      if (at >= 0) house.ports.splice(at, 1);
      house.sealers.delete(port);
      if (house.claimant === port && !house.cleared) {
        // The island boots from the claimant's manifest: with it gone before the gate clears, no session can finish proving.
        closeHouse(house, house.ports.length > 0 ? "claimant-left" : null);
        return;
      }
      if (house.owner === port) house.owner = null;
      for (const [id, asking] of house.pending) if (asking.port === port) house.pending.delete(id);
      for (const [id, holder] of house.cameras) if (holder === port) house.cameras.delete(id);
      if (house.ports.length === 0 && house.admitting === 0) closeHouse(house, null);
    },
    async connect(port) {
      // The attachment door needs the named cause now; a silent port would make the tab wait on its bound.
      try { await takeLock(); } catch (error) {
        const cause = error instanceof Error ? error.message : String(error);
        const refused: HolderRefused = { kind: "holder:refused", storeName: opts.lockName, cause };
        port.postMessage(refused);
        return;
      }
      if (ended.has(port)) return;
      const sessionId = mint();
      if (!sessionId || sessions.has(sessionId)) throw new Error("session-id-mint-refused");
      const envelope = Object.freeze({ ownerEpoch, sessionId, generation: 0 });
      const state: PortState = { envelope, nonce: randomHex(16), house: null, admitted: false, opening: false };
      sessions.set(sessionId, port);
      portStates.set(port, state);
      ports.add(port);
      opts.watchSession?.(sessionId, () => core.disconnect(port));
      port.addEventListener("message", (e) => {
        if (!ports.has(port)) return;
        const msg = wireMessage(e.data);
        if (!msg) { onDrop("unknown", "invalid-message"); return; }
        const sent = validateSessionEnvelope(msg);
        const refusal = !sent ? "malformed-message"
          : sent.ownerEpoch !== ownerEpoch ? "stale-owner-epoch"
          : !sessions.has(sent.sessionId) ? "unknown-session"
          : sessions.get(sent.sessionId) !== port ? "unbound-session"
          : sent.generation !== envelope.generation ? "stale-generation" : null;
        if (refusal) {
          port.postMessage({ kind: "holder:refused", storeName: opts.lockName, cause: refusal, ...envelope });
          onDrop(msg.type, refusal);
          return;
        }
        if (msg.type === "session:close") { core.disconnect(port); return; }
        const house = state.house;
        // A port that has not joined a house may ask one thing: to open a session.
        if (house === null) {
          if (msg.type === "session:open") {
            if (state.opening) refuse(port, "session-open-malformed", msg.type);
            else {
              // The tab takes its lifetime lock before opening; only now may the queued request start.
              opts.armSession?.(sessionId);
              void admit(port, state, msg);
            }
            return;
          }
          refuse(port, "session-unadmitted", msg.type);
          return;
        }
        if (msg.type === "session:open") { refuse(port, "session-open-malformed", msg.type); return; }
        if (!state.admitted) {
          // While its island proves the face, the claimant boots it: the manifest and the answers to the island's asks
          // cross, and no verb or camera lease does. Any other port waits unanswered.
          const request = BOOT_REPLIES[msg.type];
          const key = typeof msg.requestId === "string" ? `${request}:${msg.requestId}` : "";
          const claimantBoot = port === house.claimant &&
            (msg.type === "manifest" && !house.manifestSent || Boolean(request && house.bootRequests.has(key)));
          if (!claimantBoot) { refuse(port, "session-unadmitted", msg.type); return; }
          if (request) house.bootRequests.delete(key);
          forwardToIsland(house, port, msg, e);
          return;
        }
        if (msg.type === "session:sealer") {
          if (msg["ready"] === true) { house.sealers.add(port); flushQueue(house); }
          else house.sealers.delete(port);
          return;
        }
        forwardToIsland(house, port, msg, e);
      });
      port.start?.();
      const hello: HolderHello = { kind: "holder:hello", islandBoots, tabs: ports.size, lockClientId, nonce: state.nonce, ...envelope };
      port.postMessage(hello);
    },
  };
  return core;
}
