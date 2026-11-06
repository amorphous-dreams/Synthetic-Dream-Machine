/**
 * vessel-sessions — the vessel worker's sessions: one per page port, each admitted by its own unlock, the face's last one
 * closing returning the vessel to its floor (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift, slice 3 part i;
 * lar:///ha.ka.ba/lares/api/pono/session-contract#/how-a-session-ends).
 *
 * ── ONE OWNER PER STORE ──────────────────────────────────────────────────────────────────────────
 * `standVesselHouse` takes the store's owner lock (`lares:vessel-owner:<idbName>`) with `ifAvailable` and holds it for the
 * worker's life. A second worker over the same store refuses `store-owned` by name. `steal` never passes, and an engine with
 * no Web Locks refuses `no-engine-locks`: a missing cap cannot prove the one-owner law.
 *
 * ── THE SESSION RECORD ───────────────────────────────────────────────────────────────────────────
 * Memory alone; the house persists no roster of sessions. Each record holds its id (minted here, fresh each worker life),
 * the tab's own id, the owner epoch that minted it, the face it wears (a field of the SESSION, never of the port, so a
 * switch, row `B8`, moves one field), its generation (a switch advances it) and its admission. A respawned house mints a
 * fresh `ownerEpoch` and fresh ids, and refuses an earlier greeting by name (`stale-owner-epoch`, `unknown-session`).
 *
 * ── ADMISSION ────────────────────────────────────────────────────────────────────────────────────
 * A session stands admitted only by its OWN unlock: over a sealed keystore the house asks THAT session for a route and opens
 * the tree with it, even while another session's unlock already holds the key, so no unlock passes between tabs. Until then
 * the session reads nothing and signs nothing (`session-unadmitted`). The face's first admitted session lights the vessel
 * (`light`); every later session still proves its own unlock. A keystore that holds no slot yet admits by a first bind
 * where a secret's mint falls due, and otherwise by its clear reading (the pre-bind window, `seedRest=open`).
 *
 * ── THE LOCK, AT THE LAST SESSION ────────────────────────────────────────────────────────────────
 * The last admitted session's close (an explicit close, a `pagehide`, a lost port or the house's own liveness budget) runs
 * the lock: every ask in flight ends (`lock-ended`), the lit vessel flushes and comes down (its daemon island, its provider
 * and its signers with it), each content-key holder locks (overwriting its keys), and the custody tree key's bytes get
 * overwritten once no custody act runs. The house then stands at its floor: public readings alone, `signer-unavailable` on
 * every ask, and the next session asks for its unlock again.
 *
 * ── LIVENESS, OWN CLOCK ALONE ────────────────────────────────────────────────────────────────────
 * An abrupt tab loss sends no close. Two roads catch it. Port loss: the tab holds a lifetime Web Lock named for its session,
 * and the house queues on it; the platform grants the house that lock when the tab's context goes. The budget: the house
 * marks each message it hears on its own monotonic clock, pings each session at every sweep, and drops a session that stood
 * past its budget for three sweeps in a row (a thread the engine froze and thawed hears its pings answered first). The
 * budget frees resources and judges no relation; no wall clock crosses a process.
 *
 * ── ONE FACE PER SESSION (slice 3 part ii) ───────────────────────────────────────────────────────
 * A session that wears a face (its PersonaGroup, never `h<N>`) admits by its own unlock of THAT face's slot tree
 * (`browser-face-custody.ts`): every ask the house raises names the face it speaks for (null names this browser itself, the
 * floor's place custody), a face with no tree refuses `no-custody-slot` until a secret's mint binds one (`bind-first`, naming
 * the face), and the face's FCK seats on this thread. The face's first admitted session lights its Keyhive provider through
 * the provider door (`daemon:face-lit` at the daemon, K19), and its last admitted session drops it (`daemon:face-drop`) and
 * overwrites that face's key alone, with no clock and no recompose; the vessel comes down only when the last session of
 * every face closes. A session reads only its own face's body (`body`; a port the house never minted refuses
 * `unknown-session`, one it never admitted `session-unadmitted`). A request books the face it acts as, by its id
 * (`book`/`spend`): a booking for a face the session does not wear refuses `face-not-worn`, and each booking spends once.
 * The asker's session seals (`seal`), on this thread, while its face stands unlocked; when the asker cannot answer, only
 * another admitted unlocked session of the SAME face seals, and otherwise the work names `seal-awaits-session`. A clear names
 * one face (`clear`; none refuses `clear-face-absent`). A face switch (row `B8`) runs the five-step fence over the session's
 * own record (`switchFace`): freeze and preflight (the target face admits by the session's own unlock), the intent, the
 * fence of the old generation (its acts end, its bookings retire, its face's provider drops where it held the last
 * session), advance and mount (the generation advances, the target's provider lights), the outcome; a refused preflight
 * leaves the old generation live, and a mount that fails closes the session. The intent and the outcome rest in the session's
 * face-private home: the target face's own tree, at `face-switch/<sessionId>` (the intent before the fence, the outcome over it
 * after the advance), each naming the faces by their digests; the session record itself stays in memory alone.
 */
import {
  readBrowserCustody, unlockBrowserCustody, overwriteBrowserCustody, browserCustodyKeysHeld,
} from "./browser-custody.js";
import { standBrowserCustody, type CustodyAnswer, type CustodyAsk } from "./browser-boot-custody.js";
import { ambientLocks, type LockHost } from "./vessel-lock.js";
import {
  FaceCustodyRefused, bindFirstFaceSlot, checkFaceName, clearFaceCustody, faceCustodyHeld, faceCustodyKeysHeld, lockFaceCustody,
  overwriteEveryFaceCustody, readFaceCustody, readFaceRow, unlockFaceCustody, writeFaceRow, type FaceCustodyClear,
} from "./browser-face-custody.js";
import type { ConfirmDoor } from "./browser-custody.js";

export type VesselSessionRefusal =
  | "store-owned" | "no-engine-locks" | "session-unadmitted" | "signer-unavailable" | "stale-owner-epoch" | "unknown-session"
  | "lock-ended" | "admission-declined" | "no-slot-opens" | "custody-unreadable"
  | "no-custody-slot" | "face-locked" | "face-not-worn" | "face-names-a-handle" | "face-index-mismatch" | "session-faceless"
  | "body-absent" | "request-booked" | "request-unbooked" | "seal-awaits-session" | "clear-face-absent" | "session-switching";

const SAYS: Record<VesselSessionRefusal, string> = {
  "store-owned": "another vessel worker owns this store; one owner per store, and steal never passes",
  "no-engine-locks": "this engine offers no Web Locks, so one owner per store cannot be proven",
  "session-unadmitted": "this session has not proven its own unlock; it reads no sealed row and signs nothing",
  "signer-unavailable": "the vessel stands at its floor: public readings alone, and no signer answers",
  "stale-owner-epoch": "the greeting names an earlier owner; this vessel respawned and mints fresh sessions",
  "unknown-session": "this vessel minted no such session",
  "lock-ended": "the face's last session closed and the lock ended this act",
  "admission-declined": "the person declined the unlock; the session stays unadmitted",
  "no-slot-opens": "no route the person gave opens a slot; the session stays unadmitted",
  "custody-unreadable": "the keystore's custody does not read; no session admits over it",
  "no-custody-slot": "this face holds no slot tree yet; it admits once a secret's mint binds its first slot",
  "face-locked": "this face's custody stands locked on this thread; the face's own unlock opens it",
  "face-not-worn": "this session wears another face; a session acts only as the face it wears",
  "face-names-a-handle": "a face names its PersonaGroup, never a local handle index h<N>",
  "face-index-mismatch": "the face's tree anchors another PersonaGroup; nothing was seated",
  "session-faceless": "this session wears no face yet; it reads no face's body",
  "body-absent": "no such row rests under this session's face",
  "request-booked": "this request id already books a face",
  "request-unbooked": "no standing booking carries this request id",
  "seal-awaits-session": "no admitted unlocked session of this face can seal; the work waits for one",
  "clear-face-absent": "a clear names one face, and this one names none",
  "session-switching": "this session is changing face; its calls wait for the switch to settle",
};

/** A refusal by name. */
export class VesselSessionRefused extends Error {
  override readonly name = "VesselSessionRefused";
  constructor(readonly refusal: VesselSessionRefusal, detail?: string) {
    super(`${refusal}: ${SAYS[refusal]}${detail ? ` (${detail})` : ""}`);
  }
}

export type SessionAdmission = "unadmitted" | "asking" | "admitted" | "closed";
export type SessionAdmittedBy = "unlock" | "bind-first" | "clear";
/** The house's floor state, a public enum: `floor` (locked: public readings alone), `lighting`, `lit`. */
export type VesselFloorState = "floor" | "lighting" | "lit";

/** One page port's session. Memory alone. */
export interface VesselSession {
  readonly sessionId: string;
  readonly tabId: string;
  readonly ownerEpoch: string;
  /** The face (PersonaGroup) this session wears; null until it wears one. A field of the session, never of the port. */
  face: string | null;
  /** Advances at a face switch (row `B8`) alone. */
  generation: number;
  admission: SessionAdmission;
  admittedBy: SessionAdmittedBy | null;
}

/** What every ask the house raises carries: the question and the face it speaks for (null names this browser itself). */
export type HouseAsk = (CustodyAsk | { readonly kind: "clear" }) & { readonly face: string | null };

/** The K19 provider door: one Keyhive provider per unlocked face, lit at its first admitted session, dropped at its last. */
export interface FaceProviderDoor {
  lit(face: string, first: VesselSession): Promise<unknown>;
  drop(face: string, why: string): Promise<unknown>;
}

/** One request's booking: the session and the face (with its generation) the request acts as. */
export interface FaceBooking { readonly sessionId: string; readonly face: string; readonly generation: number }

/** The face switch's hooks (row `B8`): the intent written before the fence, the outcome after the advance. */
export interface FaceSwitchOptions {
  readonly ask: (question: HouseAsk) => Promise<CustodyAnswer>;
  readonly intent?: (i: { readonly sessionId: string; readonly from: string | null; readonly to: string; readonly generation: number }) => Promise<unknown>;
  readonly outcome?: (o: { readonly sessionId: string; readonly face: string; readonly generation: number }) => Promise<unknown>;
}

/** A content-key holder the lit vessel stands: its lock overwrites every key it holds; `held` counts them, naming none. */
export interface SessionKeyHolder { lock(): unknown; held(): number }

/** What `light` stands: the vessel the face's admitted sessions share, and its way down. */
export interface LitVessel {
  /** The face (PersonaGroup) the vessel boots: a faceless session that lit it (a founding) wears it from then on. */
  readonly face?: string | null;
  flush?(): Promise<unknown>;
  close(): Promise<unknown>;
  readonly keyHolders?: readonly SessionKeyHolder[];
}

/** What the lock did, counted. */
export interface VesselLockReport {
  readonly treeKeysOverwritten: number;
  readonly contentKeyHolders: number;
  readonly actsEnded: number;
  readonly vesselDown: boolean;
  readonly why: string;
}

export interface VesselHouseCensus {
  readonly floor: VesselFloorState;
  readonly sessions: number;
  readonly admitted: number;
  /** Tree keys this thread holds (any store); content keys the lit vessel's holders hold. */
  readonly treeKeys: number;
  readonly contentKeys: number;
}

export interface VesselHouseOptions<V extends LitVessel> {
  readonly idbName: string;
  /** `navigator.locks` by default; null reads as an engine with none. */
  readonly locks?: LockHost | null;
  /** Light the vessel at the face's first admitted session. */
  readonly light: (first: VesselSession) => Promise<V>;
  /** The house's own monotonic clock (`performance.now`); never a wall clock. */
  readonly now?: () => number;
  /** A session the house has not heard within this many ms of its own clock drops. Absent: no budget runs. */
  readonly livenessBudgetMs?: number;
  /** How many routes one admission tries. A count, never a clock. Default 3. */
  readonly attempts?: number;
  readonly mint?: () => string;
  /** One Keyhive provider per unlocked face (K19); absent, the house lights none. */
  readonly providers?: FaceProviderDoor;
  /** Hear each session's floor reading as it moves. */
  readonly onFloor?: (session: VesselSession, floor: VesselFloorState) => void;
  /** Hear each session drop, with why. */
  readonly onDrop?: (session: VesselSession, why: string) => void;
  /** Ping a session at each sweep; any message it sends back counts as heard. */
  readonly ping?: (session: VesselSession) => void;
  /** How many sweeps in a row a session may stand past its budget before it drops. Default 3, so a thread the engine froze and
   *  thawed (its clock ran on while it stood still) hears its pings answered before any session drops. */
  readonly sweepsPastBudget?: number;
}

export interface OpenSessionOptions {
  readonly tabId: string;
  /** An earlier greeting the tab holds: refused by name when this house did not mint it. */
  readonly resume?: { readonly ownerEpoch: string; readonly sessionId: string };
  /** The face (PersonaGroup) the session wears; null or absent names this browser itself (the floor's place custody). */
  readonly face?: string | null;
}

export interface AdmitOptions {
  readonly ask: (question: HouseAsk) => Promise<CustodyAnswer>;
  /** A secret's mint falls due: a keystore with no slot binds its first one through this session. */
  readonly secretMintDue?: boolean;
}

const digestOf = async (face: string): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(face)))].map((x) => x.toString(16).padStart(2, "0")).join("");

/** Stand the house over one store, or refuse `store-owned` by name. */
export async function standVesselHouse<V extends LitVessel>(opts: VesselHouseOptions<V>) {
  const host = opts.locks === undefined ? ambientLocks() : opts.locks;
  if (!host || typeof host.request !== "function") throw new VesselSessionRefused("no-engine-locks");
  const ownerLock = `lares:vessel-owner:${opts.idbName}`;
  let endLife: () => void = () => {};
  const life = new Promise<void>((resolve) => { endLife = resolve; });
  let lockSettled: Promise<unknown> = Promise.resolve();
  const granted = await new Promise<boolean>((resolve, reject) => {
    lockSettled = host.request(ownerLock, { ifAvailable: true }, (lock) => { resolve(lock !== null); return lock === null ? undefined : life; }).catch(reject);
  });
  if (!granted) throw new VesselSessionRefused("store-owned", `lock "${ownerLock}"`);

  const mint = opts.mint ?? (() => crypto.randomUUID());
  const now = opts.now ?? (() => performance.now());
  const ownerEpoch = mint();
  const sessions = new Map<string, VesselSession>();
  const heard = new Map<string, number>();
  const inflight = new Map<string, Set<(e: unknown) => void>>();
  /** Each session's act bodies in flight: a close awaits them, so no act of a closed session lands after its close. */
  const bodies = new Map<string, Set<Promise<unknown>>>();
  let floor: VesselFloorState = "floor";
  let lit: V | null = null;
  let lighting: Promise<V> | null = null;
  let locking: Promise<VesselLockReport> | null = null;
  let released = false;
  /** Each unlocked face's provider, lit at its first admitted session (K19). */
  const faceLit = new Map<string, Promise<unknown>>();
  const bookings = new Map<string, FaceBooking>();
  const switching = new Set<string>();

  /** A face custody refusal, read by the house's own name where one stands. */
  const named = (e: unknown): unknown => {
    if (!(e instanceof FaceCustodyRefused)) return e;
    const map: Partial<Record<FaceCustodyRefused["reading"], VesselSessionRefusal>> = {
      "no-custody-slot": "no-custody-slot", "face-locked": "face-locked", "face-names-a-handle": "face-names-a-handle",
      "face-index-mismatch": "face-index-mismatch", "tree-unreadable": "custody-unreadable", "face-absent": "clear-face-absent",
    };
    const r = map[e.reading];
    return r ? new VesselSessionRefused(r, e.message) : e;
  };
  const admittedOf = (face: string, except?: string): VesselSession[] =>
    [...sessions.values()].filter((x) => x.face === face && x.admission === "admitted" && x.sessionId !== except);
  const lightFace = (face: string, first: VesselSession): Promise<unknown> => {
    const standing = faceLit.get(face);
    if (standing) return standing;
    const p = Promise.resolve(opts.providers?.lit(face, first));
    faceLit.set(face, p);
    p.catch(() => { if (faceLit.get(face) === p) faceLit.delete(face); });
    return p;
  };
  /** The face's last admitted session left: its provider drops, then its key gets overwritten; every other face stands. */
  const dropFace = async (face: string, why: string): Promise<void> => {
    const lit = faceLit.get(face);
    faceLit.delete(face);
    if (lit) {
      await lit.catch(() => undefined);
      try { await opts.providers?.drop(face, why); } catch (e) { console.warn(`[vessel-sessions] face ${face.slice(0, 12)}'s provider refused its drop:`, e); }
    }
    lockFaceCustody(opts.idbName, face);
  };
  const retireBookings = (sessionId: string): void => { for (const [id, b] of bookings) if (b.sessionId === sessionId) bookings.delete(id); };

  const setFloor = (next: VesselFloorState): void => {
    floor = next;
    for (const s of sessions.values()) opts.onFloor?.(s, next);
  };
  const sessionOf = (sessionId: string): VesselSession => {
    const s = sessions.get(sessionId);
    if (!s) throw new VesselSessionRefused("unknown-session");
    return s;
  };
  const admittedCount = (): number => [...sessions.values()].filter((s) => s.admission === "admitted").length;

  /** Run `body` as an act of `session`: the lock ends it by name when the face's last session closes meanwhile. */
  /** `fence` marks a custody act (an unlock, a bind, a clear, a sealed read): the session's close awaits its body. A person's ask
   *  never fences, since a person may never answer. */
  const act = <T>(sessionId: string, body: Promise<T>, fence = false): Promise<T> => new Promise<T>((resolve, reject) => {
    const set = inflight.get(sessionId) ?? new Set<(e: unknown) => void>();
    inflight.set(sessionId, set);
    if (fence) {
      const running = bodies.get(sessionId) ?? new Set<Promise<unknown>>();
      bodies.set(sessionId, running);
      const settled: Promise<unknown> = body.then(() => undefined, () => undefined).finally(() => { running.delete(settled); });
      running.add(settled);
    }
    const end = (e: unknown): void => { set.delete(end); reject(e); };
    set.add(end);
    body.then((v) => { set.delete(end); resolve(v); }, (e: unknown) => { set.delete(end); reject(e); });
  });

  const lock = async (why: string): Promise<VesselLockReport> => {
    if (locking) return locking;
    locking = (async () => {
      let actsEnded = 0;
      for (const set of inflight.values()) for (const end of [...set]) { end(new VesselSessionRefused("lock-ended", why)); actsEnded++; }
      inflight.clear();
      const pending = lighting;
      lighting = null;
      const vessel = lit ?? (pending ? await pending.catch(() => null) : null);
      lit = null;
      for (const face of [...faceLit.keys()]) await dropFace(face, why);
      bookings.clear();
      let vesselDown = false;
      if (vessel) {
        await vessel.flush?.().catch((e: unknown) => console.warn("[vessel-sessions] the flush before the lock did not land:", e));
        try { await vessel.close(); vesselDown = true; } catch (e) { console.warn("[vessel-sessions] the vessel did not come down whole:", e); }
      }
      const holders = vessel?.keyHolders ?? [];
      for (const h of holders) { try { await h.lock(); } catch (e) { console.warn("[vessel-sessions] a content-key holder refused its lock:", e); } }
      const treeKeysOverwritten = (await overwriteBrowserCustody(opts.idbName)) ? 1 : 0;
      overwriteEveryFaceCustody(opts.idbName);
      setFloor("floor");
      return { treeKeysOverwritten, contentKeyHolders: holders.length, actsEnded, vesselDown, why };
    })();
    try { return await locking; } finally { locking = null; }
  };

  const drop = async (sessionId: string, why: string): Promise<VesselLockReport | null> => {
    const s = sessions.get(sessionId);
    if (!s) return null;
    const wasAdmitted = s.admission === "admitted";
    s.admission = "closed";
    sessions.delete(sessionId);
    heard.delete(sessionId);
    switching.delete(sessionId);
    retireBookings(sessionId);
    opts.onDrop?.(s, why);
    // THE CLOSE AWAITS ITS ACTS: each wrapper ends by name, then every body in flight settles before the close goes on, so a key
    // an act seats lands before the close's own drop overwrites it.
    // The face's last admitted session leaves its wrappers to the lock, which ends and counts every act in flight.
    const lockFollows = wasAdmitted && admittedCount() === 0 && floor !== "floor";
    if (!lockFollows) {
      for (const end of [...inflight.get(sessionId) ?? []]) end(new VesselSessionRefused("lock-ended", why));
      inflight.delete(sessionId);
    }
    await Promise.all([...bodies.get(sessionId) ?? []]);
    bodies.delete(sessionId);
    // AN ASKING SESSION'S DROP RUNS THE DROP PATH TOO: a key its act seated for a face no other session wears drops at once, and
    // the place key drops where no session stands at all at the floor.
    if (!wasAdmitted) {
      if (s.face !== null && ![...sessions.values()].some((x) => x.face === s.face)) lockFaceCustody(opts.idbName, s.face);
      if (sessions.size === 0 && floor === "floor") await overwriteBrowserCustody(opts.idbName);
    }
    // THE FACE'S LAST SESSION drops that face's provider and key; the vessel stands while another face's session stands.
    if (wasAdmitted && s.face !== null && admittedOf(s.face).length === 0) await dropFace(s.face, why);
    // The face's last admitted session runs the lock, which ends every act in flight; any other session ends its own.
    if (wasAdmitted && admittedCount() === 0 && floor !== "floor") return lock(why);
    return null;
  };

  const light = (first: VesselSession): Promise<V> => {
    if (lit) return Promise.resolve(lit);
    if (lighting) return lighting;
    setFloor("lighting");
    const p = opts.light(first);
    lighting = p;
    return p.then((v) => {
      // The lock took this lighting meanwhile, and brings the vessel down itself.
      if (lighting !== p) throw new VesselSessionRefused("lock-ended", "the face's last session closed while the vessel lit");
      lighting = null;
      lit = v;
      setFloor("lit");
      return v;
    }, (e: unknown) => { if (lighting === p) { lighting = null; setFloor("floor"); } throw e; });
  };

  const requireLit = (sessionId: string): V => {
    const s = sessionOf(sessionId);
    if (s.admission !== "admitted") throw new VesselSessionRefused("session-unadmitted");
    if (switching.has(sessionId)) throw new VesselSessionRefused("session-switching");
    if (!lit) throw new VesselSessionRefused("signer-unavailable", `the vessel reads ${floor}`);
    return lit;
  };

  let sweeper: ReturnType<typeof setInterval> | null = null;
  const missed = new Map<string, number>();
  const sweep = async (): Promise<readonly string[]> => {
    if (opts.livenessBudgetMs === undefined) return [];
    const t = now();
    const stale: string[] = [];
    for (const [id, at] of heard) {
      const n = t - at > opts.livenessBudgetMs ? (missed.get(id) ?? 0) + 1 : 0;
      missed.set(id, n);
      if (n >= (opts.sweepsPastBudget ?? 3)) stale.push(id);
    }
    for (const id of stale) { missed.delete(id); await drop(id, "liveness-budget"); }
    for (const s of sessions.values()) opts.ping?.(s);
    return stale;
  };
  if (opts.livenessBudgetMs !== undefined && opts.now === undefined) {
    sweeper = setInterval(() => { void sweep(); }, Math.max(1_000, Math.floor(opts.livenessBudgetMs / 2)));
  }

  return {
    ownerEpoch,
    ownerLock,
    floor: (): VesselFloorState => floor,
    session: (sessionId: string): VesselSession => sessionOf(sessionId),

    /** Open a session for a tab's port. An earlier greeting this house did not mint refuses by name; the tab then opens afresh. */
    open(o: OpenSessionOptions): VesselSession {
      if (o.resume) {
        if (o.resume.ownerEpoch !== ownerEpoch) throw new VesselSessionRefused("stale-owner-epoch");
        if (!sessions.has(o.resume.sessionId)) throw new VesselSessionRefused("unknown-session");
      }
      let face: string | null = null;
      if (o.face !== undefined && o.face !== null) { try { face = checkFaceName(o.face); } catch (e) { throw named(e); } }
      const sessionId = mint();
      if (!sessionId || sessions.has(sessionId) || sessionId === ownerEpoch) throw new Error("session-id-mint-refused");
      const s: VesselSession = { sessionId, tabId: o.tabId, ownerEpoch, face, generation: 0, admission: "unadmitted", admittedBy: null };
      sessions.set(sessionId, s);
      heard.set(sessionId, now());
      return s;
    },

    /** Mark the session heard on the house's own clock. */
    heard(sessionId: string): void { if (sessions.has(sessionId)) { heard.set(sessionId, now()); missed.set(sessionId, 0); } },

    /**
     * Admit the session by its OWN unlock, then light the vessel where none stands. Over a sealed keystore it always asks
     * this session, whatever another session's unlock already holds.
     */
    async admit(sessionId: string, a: AdmitOptions): Promise<V> {
      const s = sessionOf(sessionId);
      if (s.admission === "admitted") return light(s);
      if (s.face !== null) return admitFace(s, a);
      s.admission = "asking";
      try {
        const status = await readBrowserCustody(opts.idbName);
        if (status.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", status.why);
        let by: SessionAdmittedBy;
        if (status.reading === "clear") {
          const stood = await act(sessionId, standBrowserCustody({ idbName: opts.idbName, ask: (q) => a.ask({ ...q, face: null }), ...(a.secretMintDue ? { secretMintDue: true } : {}) }));
          if (stood.reading === "declined") throw new VesselSessionRefused("admission-declined");
          if (stood.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", stood.why);
          if (stood.reading === "no-slot-opens") throw new VesselSessionRefused("no-slot-opens");
          by = stood.reading === "clear" ? "clear" : stood.reading === "bound" ? "bind-first" : "unlock";
          // Another tab sealed meanwhile and this thread already held its key: this session still proves its own route.
          if (stood.reading === "held") by = await askOwnUnlock(sessionId, a);
        } else {
          by = await askOwnUnlock(sessionId, a);
        }
        if (!sessions.has(sessionId)) throw new VesselSessionRefused("lock-ended", "the session closed while it admitted");
        s.admission = "admitted";
        s.admittedBy = by;
      } catch (e) {
        if (s.admission === "asking") s.admission = "unadmitted";
        throw e;
      }
      const v = await act(sessionId, light(s));
      // A FACELESS SESSION THAT LIT THE VESSEL (a founding) wears the face the vessel boots, and that face's provider lights.
      if (s.face === null && typeof v.face === "string" && v.face.length > 0) {
        s.face = v.face;
        await act(sessionId, lightFace(v.face, s));
      }
      return v;
    },

    /** The lit vessel, for an admitted session; refused by name otherwise. */
    require: requireLit,

    /** Run one act as an admitted session; the lock ends it by name. */
    act<T>(sessionId: string, body: (vessel: V) => Promise<T>): Promise<T> {
      let vessel: V;
      try { vessel = requireLit(sessionId); } catch (e) { return Promise.reject(e); }
      return act(sessionId, body(vessel));
    },

    /** Close a session: the face's last admitted one runs the lock. */
    close: (sessionId: string, why: string): Promise<VesselLockReport | null> => drop(sessionId, why),

    /** Port loss: queue on the tab's lifetime lock; the platform grants it when the tab's context goes, and the session drops. */
    watch(sessionId: string, lifetimeLock: string): void {
      void host.request(lifetimeLock, {}, async () => { await drop(sessionId, "port-lost"); }).catch(() => undefined);
    },

    /** Drop every session the house has not heard within its budget, on its own clock. */
    sweep,

    /** Read one row of the session's own face: a port the house never minted, or never admitted, reads nothing. */
    async body(sessionId: string, row: string): Promise<Uint8Array> {
      const s = sessionOf(sessionId);
      if (s.admission !== "admitted") throw new VesselSessionRefused("session-unadmitted");
      if (switching.has(sessionId)) throw new VesselSessionRefused("session-switching");
      if (s.face === null) throw new VesselSessionRefused("session-faceless");
      const face = s.face;
      const bytes = await act(sessionId, readFaceRow(opts.idbName, face, row).catch((e: unknown) => { throw named(e); }), true);
      if (bytes === null) throw new VesselSessionRefused("body-absent", row);
      return bytes;
    },

    /** Book `requestId` as `face` for an admitted session that wears it. */
    book(sessionId: string, requestId: string, face: string): FaceBooking {
      const s = sessionOf(sessionId);
      if (s.admission !== "admitted") throw new VesselSessionRefused("session-unadmitted");
      if (s.face === null || s.face !== face) throw new VesselSessionRefused("face-not-worn");
      if (bookings.has(requestId)) throw new VesselSessionRefused("request-booked");
      const b: FaceBooking = { sessionId, face, generation: s.generation };
      bookings.set(requestId, b);
      return b;
    },

    /** Spend one booking: the face the request acts as, once; a session gone or switched retired it. */
    spend(requestId: string): FaceBooking {
      const b = bookings.get(requestId);
      bookings.delete(requestId);
      const s = b ? sessions.get(b.sessionId) : undefined;
      if (!b || !s || s.face !== b.face || s.generation !== b.generation || s.admission !== "admitted") throw new VesselSessionRefused("request-unbooked");
      return b;
    },

    /**
     * The asker's session seals, on this thread, while its face stands unlocked. With the asker gone (or unable), only another
     * admitted unlocked session of the SAME face seals; otherwise the work names `seal-awaits-session`.
     */
    seal<T>(askerSessionId: string, face: string, body: (sealer: VesselSession) => Promise<T>): Promise<T> {
      try {
        const worn = checkFaceName(face);
        const asker = sessions.get(askerSessionId);
        if (asker && asker.face !== worn) throw new VesselSessionRefused("face-not-worn");
        const eligible = (x: VesselSession): boolean => x.admission === "admitted" && !switching.has(x.sessionId) && faceCustodyHeld(opts.idbName, worn);
        if (asker && eligible(asker)) return act(asker.sessionId, body(asker));
        const sibling = admittedOf(worn, askerSessionId).find(eligible);
        if (!sibling) throw new VesselSessionRefused("seal-awaits-session");
        return act(sibling.sessionId, body(sibling));
      } catch (e) { return Promise.reject(named(e)); }
    },

    /** A clear names ONE face, the one the session wears; its own route and the person's yes clear that face alone. */
    async clear(sessionId: string, c: { readonly face: string | null; readonly ask: (question: HouseAsk) => Promise<CustodyAnswer>; readonly confirm: ConfirmDoor }): Promise<FaceCustodyClear> {
      if (typeof c.face !== "string" || c.face.length === 0) throw new VesselSessionRefused("clear-face-absent");
      let face: string;
      try { face = checkFaceName(c.face); } catch (e) { throw named(e); }
      const s = sessionOf(sessionId);
      if (s.admission !== "admitted") throw new VesselSessionRefused("session-unadmitted");
      if (s.face !== face) throw new VesselSessionRefused("face-not-worn");
      const route = await act(sessionId, c.ask({ kind: "clear", face }));
      if (route === null) throw new VesselSessionRefused("admission-declined");
      const cleared = await act(sessionId, clearFaceCustody(opts.idbName, face, [route], c.confirm), true).catch((e: unknown) => { throw named(e); });
      if (cleared.reading === "cleared") {
        await dropFace(face, "face-cleared");
        for (const x of admittedOf(face)) { x.admission = "unadmitted"; x.admittedBy = null; retireBookings(x.sessionId); }
      }
      return cleared;
    },

    /**
     * The face switch (row `B8`), the five-step fence over one session's own record: freeze and preflight (the target face
     * admits by THIS session's own unlock), the intent, the fence of the old generation, advance and mount, the outcome.
     * A refused preflight leaves the old generation live; a mount that fails closes the session. Every other session stands.
     */
    async switchFace(sessionId: string, target: string, o: FaceSwitchOptions): Promise<VesselSession> {
      const s = sessionOf(sessionId);
      if (s.admission !== "admitted") throw new VesselSessionRefused("session-unadmitted");
      let to: string;
      try { to = checkFaceName(target); } catch (e) { throw named(e); }
      if (switching.has(sessionId)) throw new VesselSessionRefused("session-switching");
      if (s.face === to) return s;
      // 1. FREEZE AND PREFLIGHT: new calls on this session refuse `session-switching`; the target face admits by this session's own unlock.
      switching.add(sessionId);
      // A FAILED SWITCH DROPS WHAT ITS PREFLIGHT SEATED: a target key no admitted session held before the switch leaves with it.
      const targetHeldBefore = faceCustodyHeld(opts.idbName, to) && admittedOf(to).length > 0;
      const dropPreflight = async (why: string): Promise<void> => {
        if (!targetHeldBefore && admittedOf(to, sessionId).length === 0 && !(s.face === to && sessions.has(sessionId))) await dropFace(to, why);
      };
      try {
        await preflightFace(s, to, o.ask);
      } catch (e) { switching.delete(sessionId); await dropPreflight("switch-refused"); throw named(e); }
      const from = s.face;
      const record = async (phase: "intent" | "outcome"): Promise<void> => {
        const body = { phase, sessionId, from: from === null ? null : await digestOf(from), to: await digestOf(to), generation: s.generation };
        await writeFaceRow(opts.idbName, to, `face-switch/${sessionId}`, new TextEncoder().encode(JSON.stringify(body)));
      };
      try {
        // 2. THE INTENT, rested under the target face before the fence.
        await record("intent");
        await o.intent?.({ sessionId, from, to, generation: s.generation });
        // 3. FENCE THE OLD GENERATION: its acts end, its bookings retire, and its face's provider drops where this was its last session.
        for (const end of [...inflight.get(sessionId) ?? []]) end(new VesselSessionRefused("lock-ended", "face-switch"));
        inflight.delete(sessionId);
        retireBookings(sessionId);
        // 4. ADVANCE AND MOUNT.
        s.face = to;
        s.generation += 1;
        if (from !== null && admittedOf(from).length === 0) await dropFace(from, "face-switch");
        await lightFace(to, s);
      } catch (e) {
        switching.delete(sessionId);
        await drop(sessionId, "switch-failed");
        await dropPreflight("switch-failed");
        throw named(e);
      }
      switching.delete(sessionId);
      // 5. THE OUTCOME, rested over the intent.
      await record("outcome");
      await o.outcome?.({ sessionId, face: to, generation: s.generation });
      return s;
    },

    /** Lit providers and held face keys, counted: never a face's name, never a key. */
    faceCensus(): { readonly lit: number; readonly faceKeys: number } {
      return { lit: faceLit.size, faceKeys: faceCustodyKeysHeld(opts.idbName) };
    },

    census(): VesselHouseCensus {
      const contentKeys = (lit?.keyHolders ?? []).reduce((n, h) => n + h.held(), 0);
      return { floor, sessions: sessions.size, admitted: admittedCount(), treeKeys: browserCustodyKeysHeld(), contentKeys };
    },

    /** Give the store back (the worker's end): every session drops, the lock runs, the owner lock releases. */
    async release(why = "house-released"): Promise<void> {
      if (released) return;
      released = true;
      if (sweeper) clearInterval(sweeper);
      for (const id of [...sessions.keys()]) await drop(id, why);
      if (floor !== "floor" || lit || lighting) await lock(why);
      endLife();
      await lockSettled;
    },
  };

  /** A session that wears a face admits by its own unlock of THAT face's tree, then lights the vessel and the face's provider. */
  async function admitFace(s: VesselSession, a: AdmitOptions): Promise<V> {
    const face = s.face!;
    s.admission = "asking";
    try {
      const status = await readFaceCustody(opts.idbName, face);
      if (status.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", status.why);
      let by: SessionAdmittedBy;
      if (status.reading === "absent") {
        // THE FIRST PERSISTENCE waits on the face's own slot: no tree, no admission, until a secret's mint binds one.
        if (!a.secretMintDue) throw new VesselSessionRefused("no-custody-slot");
        const route = await act(s.sessionId, a.ask({ kind: "bind-first", why: "face-secret-mint-due", face }));
        if (route === null) throw new VesselSessionRefused("admission-declined");
        // A face's first slot binds a human route: a passkey binds beside one, never alone.
        if (route.kind === "passkey") throw new FaceCustodyRefused("passkey-alone-refused");
        await act(s.sessionId, bindFirstFaceSlot(opts.idbName, face, route), true);
        by = "bind-first";
      } else {
        by = await askOwnFaceUnlock(s.sessionId, face, a.ask, true);
      }
      if (!sessions.has(s.sessionId)) {
        // A key seated for a session that closed meanwhile drops at once, where no other session wears the face.
        if (![...sessions.values()].some((x) => x.face === face)) lockFaceCustody(opts.idbName, face);
        throw new VesselSessionRefused("lock-ended", "the session closed while it admitted");
      }
      s.admission = "admitted";
      s.admittedBy = by;
    } catch (e) {
      if (s.admission === "asking") s.admission = "unadmitted";
      throw named(e);
    }
    const v = await act(s.sessionId, light(s));
    await act(s.sessionId, lightFace(face, s));
    return v;
  }

  /** The switch's preflight: the target face admits by this session's own unlock, before the old face falls. */
  async function preflightFace(s: VesselSession, to: string, ask: (q: HouseAsk) => Promise<CustodyAnswer>): Promise<void> {
    const status = await readFaceCustody(opts.idbName, to);
    if (status.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", status.why);
    if (status.reading === "absent") throw new VesselSessionRefused("no-custody-slot");
    await askOwnFaceUnlock(s.sessionId, to, ask);
  }

  /**
   * The session's own unlock of `face`'s tree. Where the session admits (`place`), the same one route opens this browser's
   * place tree too when it stands sealed and this thread holds no place key (the place seed the boot reads), the node's "one
   * typed credential per unlock" read on the browser; a route that opens the face and not the place admits nothing.
   */
  async function askOwnFaceUnlock(sessionId: string, face: string, ask: (q: HouseAsk) => Promise<CustodyAnswer>, place = false): Promise<SessionAdmittedBy> {
    const attempts = opts.attempts ?? 3;
    let notes: readonly string[] = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const route = await act(sessionId, ask({ kind: "unlock", attempt, of: attempts, notes, face }));
      if (route === null) throw new VesselSessionRefused("admission-declined");
      const opened = await act(sessionId, unlockFaceCustody(opts.idbName, face, [route]), true);
      if (opened.reading === "opens") {
        if (place) await openPlaceWith(sessionId, face, route);
        return "unlock";
      }
      notes = opened.notes;
    }
    throw new VesselSessionRefused("no-slot-opens");
  }

  async function openPlaceWith(sessionId: string, face: string, route: NonNullable<CustodyAnswer>): Promise<void> {
    const status = await readBrowserCustody(opts.idbName);
    if (status.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", status.why);
    if (status.reading !== "sealed" || status.unlocked) return;
    const opened = await act(sessionId, unlockBrowserCustody(opts.idbName, [route]), true);
    if (opened.reading === "opens") return;
    if (admittedOf(face).length === 0) lockFaceCustody(opts.idbName, face);
    throw new VesselSessionRefused("no-slot-opens", "the face's route opens no slot of this browser's place tree");
  }

  async function askOwnUnlock(sessionId: string, a: AdmitOptions): Promise<SessionAdmittedBy> {
    const attempts = opts.attempts ?? 3;
    let notes: readonly string[] = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const route = await act(sessionId, a.ask({ kind: "unlock", attempt, of: attempts, notes, face: null }));
      if (route === null) throw new VesselSessionRefused("admission-declined");
      const opened = await act(sessionId, unlockBrowserCustody(opts.idbName, [route]), true);
      if (opened.reading === "opens") return "unlock";
      notes = opened.notes;
    }
    throw new VesselSessionRefused("no-slot-opens");
  }
}

export type VesselHouse<V extends LitVessel = LitVessel> = Awaited<ReturnType<typeof standVesselHouse<V>>>;

/** The tab's lifetime lock for a session: the page holds it for its life; the house queues on it to hear the tab go. */
export function sessionLifetimeLock(sessionId: string): string { return `lares:vessel-session:${sessionId}`; }
