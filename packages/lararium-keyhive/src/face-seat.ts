/** A joinee's one serialized grant take and floor lift, driven only by causal wakes. */
import type { EdgeStanding } from "@lararium/mesh";
import { FACE_GRANT_PREFIX, type FaceGrantRecord, type FaceGrantVerdict, type FaceGrantVerifyContext } from "./face-grant-record.js";

/** Follow the island's own fleet replica, including proof already present when attachment finishes. */
export function watchFaceSeatFleet(ports: {
  readonly open: () => Promise<{ on(event: "change", listener: () => void): unknown; off(event: "change", listener: () => void): unknown }>;
  readonly wake: () => void;
  readonly log: (message: string) => void;
}) {
  let stopped = false, attached = false, again = false;
  let pending: Promise<void> | null = null;
  let detach = () => {};
  const changed = () => { if (!stopped) ports.wake(); };
  const attach = (): Promise<void> => {
    if (stopped || attached) return Promise.resolve();
    if (pending) { again = true; return pending; }
    pending = (async () => {
      do {
        again = false;
        try {
          const handle = await ports.open();
          if (stopped) return;
          handle.on("change", changed);
          detach = () => handle.off("change", changed);
          attached = true;
          changed();
        } catch (error) { if (!stopped) ports.log(`face fleet watch unavailable: ${String(error)}`); }
      } while (again && !attached && !stopped);
    })().finally(() => { pending = null; });
    return pending;
  };
  return { attach, stop: () => { stopped = true; detach(); } };
}

export interface FaceSeatPorts {
  readonly group: string;
  readonly selfVerifyingKey: string;
  readonly personaRootDid: string;
  readonly personaKel?: FaceGrantVerifyContext["personaKel"];
  readonly knowsAgent: (group: string) => Promise<boolean>;
  readonly grants: () => Promise<readonly { title: string; record: FaceGrantRecord }[]>;
  /** This vessel's remove-wins reading of a FOUNDER's device-face dyad, off its own fold of the fleet board. */
  readonly founderStanding: (deviceVerifyingKey: string) => Promise<EdgeStanding>;
  readonly verify: (record: FaceGrantRecord, context: FaceGrantVerifyContext) => Promise<FaceGrantVerdict>;
  readonly ingest: (record: FaceGrantRecord) => Promise<void>;
  /** Lifts the floor under the face; answers how many records a silent floor document held back, so the next pass tries again. */
  readonly lift: () => Promise<void | { readonly skipped: number; /** One promise per skipped document, settling when it arrives (a read peers never answered) or rests (a flush storage never confirmed): that wakes the seat. */ readonly arrivals?: readonly Promise<unknown>[] }>;
  readonly log: (message: string) => void;
}

/** The PersonaGroup document as the listener reads it: a change event and the current tiddlers. */
export interface GroupDocHandle {
  on(event: "change", listener: (payload: { patches?: readonly { path: readonly (string | number)[] }[] }) => void): unknown;
  off(event: "change", listener: (payload: { patches?: readonly { path: readonly (string | number)[] }[] }) => void): unknown;
  /** The titles the document holds now. */
  titles(): readonly string[];
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
          : handle.titles().some(named)) ports.wake();
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
  let proofVersion = 0;
  let waitingOnProof = false;
  let announcedUnseated = false;
  const seated = () => ports.knowsAgent(ports.group);
  const lift = async () => {
    if (lifted) return;
    lifted = true;
    try {
      const result = await ports.lift();
      // A floor record the lift skipped (its document silent) has not moved: the latch stays open, so a later pass lifts it.
      if (result && result.skipped > 0) { lifted = false; ports.log(`face lift skipped ${result.skipped} floor record(s) its document held back; the document's arrival wakes the next pass`); for (const arrival of result.arrivals ?? []) void arrival.then(() => wake(), () => {}); }
    } catch (error) {
      lifted = false;
      ports.log(`face lift faulted: ${String(error)}`);
    }
  };
  const pass = async (): Promise<boolean> => {
    waitingOnProof = false;
    // The SEATED VERDICT is what the bindings wait on; the lift moves floor documents under the face afterwards and stands off that path
    // (guarded by `lifted`, its faults named, retried by the next pass).
    if (await seated()) { announcedUnseated = false; void lift(); return true; }
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
        // THE FOUNDER'S STANDING, read once per record for the device its edge names: the verifier decides from it.
        const founderKey = record.founderEdge?.deviceVerifyingKey;
        const proofAtRead = proofVersion;
        const standing: EdgeStanding = typeof founderKey === "string" ? await ports.founderStanding(founderKey) : "unknown";
        // Walk the held lineage even when standing is unknown, so a fork cannot hide behind a pending frontier.
        const verdict = await ports.verify(record, {
          personaRootDid: ports.personaRootDid, selfVerifyingKey: self, groupId: ports.group, personaKel: ports.personaKel,
          dyad: (asked) => typeof founderKey === "string" && asked.toLowerCase() === founderKey.toLowerCase() ? standing : "unknown",
        });
        // A proof change overtook this reading. The queued pass must read again before ingest or memoization.
        if (proofAtRead !== proofVersion) return false;
        if (!verdict.ok) {
          // A refusal for proof this vessel does not yet hold judges nothing: the record waits, and the proof's arrival wakes it.
          if (verdict.pending) {
            waitingOnProof = true;
            ports.log(`face-join grant pending (${title.slice(-16)}): ${verdict.reason}`);
            continue;
          }
          // Standing can change after a lift; retain the refusal but revisit it on daemon changes.
          if (standing === "aside") waitingOnProof = true;
          else judged.add(record.sig);
          ports.log(`face-join grant record REFUSED (${title.slice(-16)}): ${verdict.reason}`);
          continue;
        }
        // Retain the seat's own fail-closed boundary even if a supplied verifier accepts unknown standing.
        if (standing === "aside") {
          waitingOnProof = true;
          ports.log(`face-join grant record REFUSED (${title.slice(-16)}): founder device set aside`);
          continue;
        }
        if (standing === "unknown") {
          waitingOnProof = true;
          ports.log(`face-join grant pending (${title.slice(-16)}): founder dyad standing unknown`);
          continue;
        }
        try { await ports.ingest(record); }
        catch (error) { ports.log(`face-join grant atom ingest faulted: ${String(error)}`); continue; }
        judged.add(record.sig);
        taken = true;
        const nowSeated = await seated();
        ports.log(`face-join grant record taken from the PersonaGroup plane (${record.capEvents.length} cap events, ${record.reSealed?.length ?? 0} chunks re-sealed) — face ${nowSeated ? "SEATED" : "still unseated after ingest"}`);
        if (nowSeated) { announcedUnseated = false; void lift(); return true; }
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
  // A change during an in-flight read must also queue a pass: the read may have captured the old standing before
  // the change, and has not yet marked the grant as waiting. Idle seats without pending proof do no work.
  const daemonChanged = (_title: string) => { proofVersion++; if (waitingOnProof || active) wake(); };
  return { seated, daemonChanged, settled: async () => { if (active) await active; }, wake, run };
}
