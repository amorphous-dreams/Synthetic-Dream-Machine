/**
 * shared-holder-core — THE HOUSE BEHIND THE LOCK: one house per face, a port per tab.
 *
 * The Web Lock (vessel-lock.ts) refuses a second holder over one store. This core IS the one holder: it runs
 * inside a module SharedWorker (shared-holder.worker.ts) and takes the store's lock for its own life. A connecting
 * port receives a greeting with a nonce and nothing else: it answers no ask until its tab admits a session.
 *
 * A tab admits a session by presenting its face's countersigned device edge and its atom's signature over
 * (ownerEpoch, sessionId, nonce, personaGroup). The holder checks the signature under the edge's atom key, the
 * edge whole (root half and atom countersignature), and the (PersonaGroup -> persona root) pin it keeps from the
 * face's first admitted session for its own life. The holder holds no secret and verifies a self-contained chain.
 *
 * Each PersonaGroup stands in its own HOUSE: its own island, its own Repo, its own ports, owner, pending requests
 * and camera leases. An island answer reaches the ports of its own house alone. A sealing ask (`custody:write`)
 * goes to a tab of that house that announced it can seal (`session:sealer`), since the key rests in the tab; with
 * none ready the ask waits, named `seal-awaits-session`, and lands when one announces. The last session of a house
 * to close ends its island and Repo and then locks the face (`lockFace`).
 *
 * Pure: the lock surface, the island and Repo spawns and the ports ride in, so a witness drives it with fakes.
 * The worker entry wires the platform pieces around it and nothing else.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/moves
 */

import type { LockHost } from "./vessel-lock.js";
import { defaultCryptoProvider } from "@lararium/mesh/crypto";
import { validateSessionEnvelope, type SessionEnvelope } from "@lararium/mesh/session-contract";
import { verifyHolderSessionProof, type DeviceDelegationTiddler } from "@lararium/mesh";
import { HOLDER_ROUTES } from "./holder-routes.js";

type WireMessage = Record<string, unknown> & { type: string };

function wireMessage(raw: unknown): WireMessage | null {
  if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") return null;
  return raw as WireMessage;
}

// These tab-originated requests expect an island result. Island-originated asks also carry requestId,
// but their answers must keep that id whole on the return crossing.
const TAB_REQUESTS = new Set([
  "wiki:place-verb",
  "daemon:place-verb",
  "daemon:derive-skeleton-request",
  "daemon:worldline-compare-request",
  "daemon:worldline-trajectory-request",
  "daemon:resolve-binding-request",
]);


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
 * end of the manifest channel and gives the island a fresh channel to the same Repo.
 */
export interface HolderRepo {
  shutdown(): Promise<void>;
  attachPeer?(port: MessagePort): void;
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

/** A port as the holder sees it — the two members `MessagePort` and a fake alike carry. */
export interface HolderPort {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", cb: (e: MessageEvent) => void): void;
  start?(): void;
}

export interface SharedHolderCoreOptions {
  readonly lockName:    string;
  readonly locks:       LockHost | null;
  /** Stand the daemon island of one face house. */
  readonly spawnIsland: (personaGroup: string) => HolderIsland;
  /** Stand the Repo of one face house; the holder shuts it down with the house. */
  readonly makeRepo?:   (personaGroup: string) => HolderRepo | Promise<HolderRepo>;
  /** Lock a face once its last session closed and its island and Repo stand down. */
  readonly lockFace?:   (personaGroup: string) => void | Promise<void>;
  /** A sealing ask waits because no ready tab of its face stands. */
  readonly onWait?:     (kind: "seal-awaits-session", personaGroup: string, messageType: string) => void;
  readonly onDrop?: (kind: string, reason: string) => void;
  readonly mint?: () => string;
}

export interface SharedHolderCore {
  /** A tab connected: greet it. It answers nothing until its tab admits a session. */
  connect(port: HolderPort): Promise<void>;
  disconnect(port: HolderPort): void;
  readonly islandBoots: number;
  readonly tabs:        number;
}

interface PortState {
  readonly envelope: SessionEnvelope;
  readonly nonce:    string;
  /** The face this port admitted, once admitted. */
  group:             string | null;
  opening:           boolean;
}

/** One face's house: its island, Repo, admitted ports and the routes between them. */
interface House {
  readonly group: string;
  readonly repo:  HolderRepo | null;
  island:         HolderIsland | null;
  unlisten:       (() => void) | null;
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
  const housesStanding = new Map<string, Promise<House>>();
  /** Each face's persona root, pinned at its first admitted session for the holder's life. */
  const groupRoots = new Map<string, string>();
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
    while (house.queue.length > 0) {
      const sealer = sealerOf(house);
      if (!sealer) return;
      deliver(sealer, house.queue.shift()!);
    }
  };

  const routeFromIsland = (house: House) => (raw: unknown): void => {
    const msg = wireMessage(raw);
    if (!msg) { onDrop("unknown", "invalid-message"); return; }
    const route = HOLDER_ROUTES[msg.type as keyof typeof HOLDER_ROUTES];
    if (!route) { onDrop(msg.type, "unknown-route"); return; }
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

  /** The house of one face: stand its Repo once, and its island on the first admitted session. */
  const houseOf = (group: string): Promise<House> => {
    const standing = housesStanding.get(group);
    if (standing) return standing;
    const made = (async (): Promise<House> => {
      const repo = opts.makeRepo ? await opts.makeRepo(group) : null;
      const house: House = {
        group, repo, island: null, unlisten: null,
        ports: [], sealers: new Set(), pending: new Map(), cameras: new Map(), queue: [], owner: null,
      };
      houses.set(group, house);
      return house;
    })();
    housesStanding.set(group, made);
    return made;
  };

  /** The last session left: the island ends, the Repo shuts down, and only then does the face lock. */
  const closeHouse = (house: House): void => {
    houses.delete(house.group);
    housesStanding.delete(house.group);
    house.unlisten?.();
    house.island?.terminate();
    let shut: Promise<void>;
    try { shut = house.repo ? house.repo.shutdown() : Promise.resolve(); } catch (error) { shut = Promise.reject(error); }
    const lock = (): Promise<void> | void => opts.lockFace?.(house.group);
    // The face locks after its Repo stands down, and also when the Repo fails to: a face never stays open on a fault.
    void shut.then(lock, (error) => {
      onDrop("repo:shutdown", error instanceof Error ? error.message : String(error));
      return lock();
    }).catch((error) => onDrop("face:lock", error instanceof Error ? error.message : String(error)));
  };

  const admit = async (port: HolderPort, state: PortState, msg: WireMessage): Promise<void> => {
    const group = msg["personaGroup"];
    const edge = msg["edge"] as DeviceDelegationTiddler | undefined;
    const signature = msg["signature"];
    if (state.group !== null) { refuse(port, "session-open-malformed", msg.type); return; }
    if (typeof group !== "string" || group.length === 0 || typeof signature !== "string" || !edge || typeof edge !== "object") {
      refuse(port, "session-open-malformed", msg.type);
      return;
    }
    state.opening = true;
    const reading = await verifyHolderSessionProof({
      edge, signature,
      fields: { ownerEpoch: state.envelope.ownerEpoch, sessionId: state.envelope.sessionId, nonce: state.nonce, personaGroup: group },
    });
    if (!reading.ok) { state.opening = false; refuse(port, reading.reason, msg.type); return; }
    const root = edge.personaRootDid;
    const pinned = groupRoots.get(group);
    if (pinned !== undefined && pinned !== root) { state.opening = false; refuse(port, "session-root-mismatch", msg.type); return; }
    if (pinned === undefined) groupRoots.set(group, root);
    const house = await houseOf(group);
    state.opening = false;
    if (ended.has(port)) {
      if (house.ports.length === 0) closeHouse(house);
      return;
    }
    state.group = group;
    house.ports.push(port);
    if (house.owner === null || !ports.has(house.owner)) house.owner = port;
    deliver(port, { type: "holder:admitted", kind: "holder:admitted", personaGroup: group } as unknown as WireMessage);
    // THE OWNER IS THE PORT THAT STANDS THE ISLAND: the island speaks `ready` before any manifest arrives, so its
    // boot traffic needs a destination from the first message.
    if (!house.island) {
      house.island = opts.spawnIsland(group);
      islandBoots++;
      house.unlisten = house.island.listen(routeFromIsland(house));
    }
  };

  const forwardToIsland = (house: House, port: HolderPort, msg: WireMessage, e: MessageEvent): void => {
    const isl = house.island;
    if (!isl) { onDrop(msg.type, "island-absent"); return; }
    if (msg.type === "manifest") {
      if (house.owner && house.owner !== port) {
        const refused: HolderRefused = { kind: "holder:refused", storeName: opts.lockName, cause: "island-owned" };
        port.postMessage({ ...refused, ...portStates.get(port)!.envelope });
        onDrop(msg.type, "island-owned");
        return;
      }
      house.owner = port;
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
    // THE REPO STANDS BETWEEN: a manifest's sync port carries the tab's Repo; the house Repo takes it as a peer and
    // the island syncs with the house Repo over a channel of its own, so the island's documents rest in the holder.
    if (msg.type === "manifest" && house.repo?.attachPeer && transfer.length === 1) {
      const channel = new MessageChannel();
      house.repo.attachPeer(transfer[0] as MessagePort);
      house.repo.attachPeer(channel.port1);
      forwarded = { ...(islandMessage as Record<string, unknown>), syncPort: channel.port2 };
      transfer = [channel.port2];
    }
    isl.post(forwarded, transfer.length ? transfer : undefined);
  };

  return {
    get islandBoots() { return islandBoots; },
    get tabs()        { return ports.size; },
    disconnect(port) {
      ended.add(port);
      ports.delete(port);
      const state = portStates.get(port);
      if (state) sessions.delete(state.envelope.sessionId);
      portStates.delete(port);
      const group = state?.group;
      const house = group ? houses.get(group) : undefined;
      if (!house) return;
      const at = house.ports.indexOf(port);
      if (at >= 0) house.ports.splice(at, 1);
      house.sealers.delete(port);
      if (house.owner === port) house.owner = null;
      for (const [id, asking] of house.pending) if (asking.port === port) house.pending.delete(id);
      for (const [id, holder] of house.cameras) if (holder === port) house.cameras.delete(id);
      if (house.ports.length === 0) closeHouse(house);
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
      const state: PortState = { envelope, nonce: randomHex(16), group: null, opening: false };
      sessions.set(sessionId, port);
      portStates.set(port, state);
      ports.add(port);
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
        // A port answers nothing until its session admits: the one ask it may make is `session:open`.
        if (state.group === null) {
          if (msg.type === "session:open" && !state.opening) { void admit(port, state, msg); return; }
          refuse(port, "session-unadmitted", msg.type);
          return;
        }
        const house = houses.get(state.group);
        if (!house) { onDrop(msg.type, "house-absent"); return; }
        if (msg.type === "session:open") { refuse(port, "session-open-malformed", msg.type); return; }
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
}
