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

export function makeFaceSeat(ports: FaceSeatPorts) {
  const judged = new Set<string>();
  const prefix = `${FACE_GRANT_PREFIX}${ports.group}/`;
  const self = ports.selfVerifyingKey.toLowerCase();
  let lifted = false;
  let active: Promise<boolean> | null = null;
  let dirty = false;
  let waitingOnLease = false;
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
    if (await seated()) { await lift(); return true; }
    if (!ports.personaKel) return false;
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
        if (await seated()) { await lift(); return true; }
      }
    } catch (error) { ports.log(`face-join grant read faulted: ${String(error)}`); }
    return seated();
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
