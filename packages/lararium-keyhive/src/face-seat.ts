/** A joinee's one serialized grant take and floor lift, driven only by causal wakes. */
import { FACE_GRANT_PREFIX, type FaceGrantRecord, type FaceGrantVerdict, type FaceGrantVerifyContext } from "./face-grant-record.js";
import type { LeaseFrontier } from "./lease-frontier.js";

export interface FaceSeatPorts {
  readonly group: string;
  /** The daemon-layer title prefix that carries the group's lease slots. */
  readonly leasePrefix: string;
  readonly selfVerifyingKey: string;
  readonly personaRootDid: string;
  readonly personaKel?: FaceGrantVerifyContext["personaKel"];
  readonly knowsAgent: (group: string) => Promise<boolean>;
  readonly grants: () => Promise<readonly { title: string; record: FaceGrantRecord }[]>;
  readonly readLease: () => Promise<LeaseFrontier>;
  readonly verify: (record: FaceGrantRecord, context: FaceGrantVerifyContext) => Promise<FaceGrantVerdict>;
  readonly ingest: (record: FaceGrantRecord) => Promise<void>;
  readonly lift: () => Promise<void>;
  readonly log: (message: string) => void;
}

/** The PersonaGroup document as the listener reads it: a change event and the current tiddlers. */
export interface GroupDocHandle {
  on(event: "change", listener: (payload: { patches?: readonly { path: readonly (string | number)[] }[] }) => void): unknown;
  off(event: "change", listener: (payload: { patches?: readonly { path: readonly (string | number)[] }[] }) => void): unknown;
  doc(): { tiddlers?: Record<string, unknown> } | undefined;
}

export interface GroupDocListenerPorts {
  readonly group: string;
  readonly selfVerifyingKey: string;
  /** The catalog's row for the PersonaGroup document, or null while the catalog has not learned it. */
  readonly urlOf: () => Promise<string | null>;
  readonly open: (url: string) => Promise<GroupDocHandle>;
  /** Subscribes to the catalog document's own changes: the store that learns the URL. Returns the unsubscribe. */
  readonly subscribeCatalog: (onChange: () => void) => Promise<() => void>;
  readonly wake: () => void;
  readonly log: (message: string) => void;
}

/**
 * Attaches the group document's change listener exactly once. A missing URL or a rejected open logs by name and waits for the
 * next causal change that could bring the URL: the catalog's own change (`attempt` rides it) or the caller's `retry`.
 */
export function makeGroupDocListener(ports: GroupDocListenerPorts) {
  const prefix = `${FACE_GRANT_PREFIX}${ports.group}/`;
  const self = ports.selfVerifyingKey.toLowerCase();
  const named = (title: string) => title.startsWith(prefix) && title.toLowerCase().endsWith(self);
  let stopped = false;
  let attached = false;
  let running: Promise<void> | null = null;
  let again = false;
  let stopCatalog: (() => void) | null = null;
  let stopDoc = () => {};
  let announcedMissing = false;
  const once = async () => {
    try {
      if (!stopCatalog) {
        const unsubscribe = await ports.subscribeCatalog(() => { void attempt(); });
        if (stopped) { unsubscribe(); return; }
        stopCatalog = unsubscribe;
      }
      const url = await ports.urlOf();
      if (!url) {
        if (!announcedMissing) ports.log("face grant plane: the PersonaGroup document URL stands unknown; the listener attaches when the catalog learns it");
        announcedMissing = true;
        return;
      }
      announcedMissing = false;
      const handle = await ports.open(url);
      if (stopped || attached) return;
      const onChange = ({ patches }: { patches?: readonly { path: readonly (string | number)[] }[] }) => {
        if (stopped) return;
        if (patches ? patches.some(p => p.path[0] === "tiddlers" && typeof p.path[1] === "string" && named(p.path[1]))
          : Object.keys(handle.doc()?.tiddlers ?? {}).some(named)) ports.wake();
      };
      handle.on("change", onChange);
      stopDoc = () => handle.off("change", onChange);
      attached = true;
      if (stopCatalog) { stopCatalog(); stopCatalog = null; }
      ports.wake();
    } catch (error) { ports.log(`face grant arrival unavailable: ${String(error)}`); }
  };
  const attempt = (): Promise<void> => {
    if (stopped || attached) return running ?? Promise.resolve();
    if (running) { again = true; return running; }
    running = (async () => {
      do { again = false; await once(); } while (again && !attached && !stopped);
      running = null;
    })();
    return running;
  };
  const stop = () => { stopped = true; stopCatalog?.(); stopCatalog = null; stopDoc(); };
  return { attempt, stop, attached: () => attached };
}

export function makeFaceSeat(ports: FaceSeatPorts) {
  const judged = new Set<string>();
  const prefix = `${FACE_GRANT_PREFIX}${ports.group}/`;
  const self = ports.selfVerifyingKey.toLowerCase();
  let lifted = false;
  let active: Promise<boolean> | null = null;
  let dirty = false;
  let waitingOnLease = false;
  let announcedUnseated = false;
  const seated = () => ports.knowsAgent(ports.group);
  const lift = async () => {
    if (lifted) return;
    lifted = true;
    try { await ports.lift(); }
    catch (error) {
      lifted = false;
      ports.log(`face lift faulted: ${String(error)}`);
    }
  };
  const pass = async (): Promise<boolean> => {
    waitingOnLease = false;
    if (await seated()) { announcedUnseated = false; await lift(); return true; }
    let taken = false;
    const settle = async (): Promise<boolean> => {
      const answer = await seated();
      if (answer) announcedUnseated = false;
      else if (!taken && !announcedUnseated) {
        announcedUnseated = true;
        ports.log(`face ${ports.group.slice(0, 16)}… pinned, not yet seated — bindings mint vessel-only until a face-join lands`);
      }
      return answer;
    };
    if (!ports.personaKel) return settle();
    try {
      const grants = await ports.grants();
      for (const { title, record } of grants) {
        if (!title.startsWith(prefix) || !title.toLowerCase().endsWith(self)) continue;
        if (typeof record?.sig !== "string" || judged.has(record.sig)) continue;
        const lease = await ports.readLease();
        if (lease.kind === "unavailable") {
          waitingOnLease = true;
          ports.log(`face-join grant pending (${title.slice(-16)}): current lease frontier unavailable (${lease.why})`);
          continue;
        }
        const verdict = await ports.verify(record, {
          personaRootDid: ports.personaRootDid, selfVerifyingKey: self, groupId: ports.group,
          ...(ports.personaKel ? { personaKel: ports.personaKel } : {}), expectedEpoch: lease.n,
        });
        if (!verdict.ok) {
          judged.add(record.sig);
          ports.log(`face-join grant record REFUSED (${title.slice(-16)}): ${verdict.reason}`);
          continue;
        }
        try { await ports.ingest(record); }
        catch (error) { ports.log(`face-join grant atom ingest faulted: ${String(error)}`); continue; }
        judged.add(record.sig);
        taken = true;
        const nowSeated = await seated();
        ports.log(`face-join grant record taken from the PersonaGroup plane (${record.capEvents.length} cap events, ${record.reSealed?.length ?? 0} chunks re-sealed) — face ${nowSeated ? "SEATED" : "still unseated after ingest"}`);
        if (nowSeated) { announcedUnseated = false; await lift(); return true; }
        announcedUnseated = true;
      }
    } catch (error) { ports.log(`face-join grant read faulted: ${String(error)}`); }
    return settle();
  };
  const run = (): Promise<boolean> => {
    if (active) { dirty = true; return active; }
    active = (async () => {
      let answer = false;
      do {
        dirty = false;
        try { answer = await pass(); }
        catch (error) { ports.log(`face seat faulted: ${String(error)}`); answer = false; }
      } while (dirty);
      active = null;
      return answer;
    })();
    return active;
  };
  const wake = () => { void run(); };
  // A lease slot always wakes the act; while a grant waits on an unavailable lease frontier, any daemon-layer change does,
  // since a layer can join holding records but no lease slot.
  const daemonChanged = (title: string) => { if (waitingOnLease || title.startsWith(ports.leasePrefix)) wake(); };
  return { seated, daemonChanged, settled: async () => { if (active) await active; }, wake, run };
}
