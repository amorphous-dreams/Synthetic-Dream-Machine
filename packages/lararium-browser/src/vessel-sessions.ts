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
 */
import {
  readBrowserCustody, unlockBrowserCustody, overwriteBrowserCustody, browserCustodyKeysHeld,
} from "./browser-custody.js";
import { standBrowserCustody, type CustodyAnswer, type CustodyAsk } from "./browser-boot-custody.js";
import { ambientLocks, type LockHost } from "./vessel-lock.js";

export type VesselSessionRefusal =
  | "store-owned" | "no-engine-locks" | "session-unadmitted" | "signer-unavailable" | "stale-owner-epoch" | "unknown-session"
  | "lock-ended" | "admission-declined" | "no-slot-opens" | "custody-unreadable";

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

/** A content-key holder the lit vessel stands: its lock overwrites every key it holds; `held` counts them, naming none. */
export interface SessionKeyHolder { lock(): unknown; held(): number }

/** What `light` stands: the vessel the face's admitted sessions share, and its way down. */
export interface LitVessel {
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
}

export interface AdmitOptions {
  readonly ask: (question: CustodyAsk) => Promise<CustodyAnswer>;
  /** A secret's mint falls due: a keystore with no slot binds its first one through this session. */
  readonly secretMintDue?: boolean;
}

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
  let floor: VesselFloorState = "floor";
  let lit: V | null = null;
  let lighting: Promise<V> | null = null;
  let locking: Promise<VesselLockReport> | null = null;
  let released = false;

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
  const act = <T>(sessionId: string, body: Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
    const set = inflight.get(sessionId) ?? new Set<(e: unknown) => void>();
    inflight.set(sessionId, set);
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
      let vesselDown = false;
      if (vessel) {
        await vessel.flush?.().catch((e: unknown) => console.warn("[vessel-sessions] the flush before the lock did not land:", e));
        try { await vessel.close(); vesselDown = true; } catch (e) { console.warn("[vessel-sessions] the vessel did not come down whole:", e); }
      }
      const holders = vessel?.keyHolders ?? [];
      for (const h of holders) { try { await h.lock(); } catch (e) { console.warn("[vessel-sessions] a content-key holder refused its lock:", e); } }
      const treeKeysOverwritten = (await overwriteBrowserCustody(opts.idbName)) ? 1 : 0;
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
    opts.onDrop?.(s, why);
    // The face's last admitted session runs the lock, which ends every act in flight; any other session ends its own.
    if (wasAdmitted && admittedCount() === 0 && floor !== "floor") return lock(why);
    for (const end of [...inflight.get(sessionId) ?? []]) end(new VesselSessionRefused("lock-ended", why));
    inflight.delete(sessionId);
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
      const sessionId = mint();
      if (!sessionId || sessions.has(sessionId) || sessionId === ownerEpoch) throw new Error("session-id-mint-refused");
      const s: VesselSession = { sessionId, tabId: o.tabId, ownerEpoch, face: null, generation: 0, admission: "unadmitted", admittedBy: null };
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
      s.admission = "asking";
      try {
        const status = await readBrowserCustody(opts.idbName);
        if (status.reading === "unreadable") throw new VesselSessionRefused("custody-unreadable", status.why);
        let by: SessionAdmittedBy;
        if (status.reading === "clear") {
          const stood = await act(sessionId, standBrowserCustody({ idbName: opts.idbName, ask: a.ask, ...(a.secretMintDue ? { secretMintDue: true } : {}) }));
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
      return act(sessionId, light(s));
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

  async function askOwnUnlock(sessionId: string, a: AdmitOptions): Promise<SessionAdmittedBy> {
    const attempts = opts.attempts ?? 3;
    let notes: readonly string[] = [];
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const route = await act(sessionId, a.ask({ kind: "unlock", attempt, of: attempts, notes }));
      if (route === null) throw new VesselSessionRefused("admission-declined");
      const opened = await act(sessionId, unlockBrowserCustody(opts.idbName, [route]));
      if (opened.reading === "opens") return "unlock";
      notes = opened.notes;
    }
    throw new VesselSessionRefused("no-slot-opens");
  }
}

export type VesselHouse<V extends LitVessel = LitVessel> = Awaited<ReturnType<typeof standVesselHouse<V>>>;

/** The tab's lifetime lock for a session: the page holds it for its life; the house queues on it to hear the tab go. */
export function sessionLifetimeLock(sessionId: string): string { return `lares:vessel-session:${sessionId}`; }
