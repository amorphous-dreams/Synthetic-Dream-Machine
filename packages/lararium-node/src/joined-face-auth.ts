import { deriveRegisterBags, litFaceOwnBags, type IdentityAnchors, type JoinedFaceAuth } from "@lararium/mesh";

type FaceAnchor = JoinedFaceAuth["faceAnchor"];
type Chain = JoinedFaceAuth["personaKel"]["chain"];

/** The local reads required to build each unlocked sibling's independent gate input. */
export interface JoinedFaceAuthPorts {
  readonly ordinals: () => readonly number[];
  readonly mounted: number;
  readonly current: (ordinal: number) => boolean;
  readonly unlocked: (ordinal: number) => Promise<boolean>;
  readonly anchors: (ordinal: number) => Promise<IdentityAnchors | null>;
  readonly anchor: (group: string) => Promise<FaceAnchor | null>;
  readonly chain: (prefix: string) => Promise<Chain | null>;
  readonly atomSeed: (group: string) => Promise<Uint8Array | null>;
  readonly atomKey: (seed: Uint8Array, group: string) => string;
  readonly addressSecret: (group: string) => Promise<Uint8Array | null>;
  readonly veilArchive: (group: string) => Promise<Uint8Array | null>;
  /** THE LIT SET: the face's relation, read off its own proved log (`faceRelationOf`); null where no proof names one. */
  readonly relation?: (group: string) => Promise<string | null>;
  readonly log: (line: string) => void;
}

/**
 * The served faces the composition still owes a light: every face the lend serves that is neither the daemon mount nor lit
 * beside it, in ordinal order. A face the pūlama lights after the composition stood joins the served set by the pūlama's
 * standing event; until it lights, the daemon island refuses its presenter (`no provider for face`). No mount lights nothing.
 */
export function unlitServedFaces(served: readonly number[], mount: number | null, lit: ReadonlySet<number>): number[] {
  if (mount === null) return [];
  return [...new Set(served)].filter((o) => o !== mount && !lit.has(o)).sort((a, b) => a - b);
}

/**
 * The lit siblings the lend leaves unserved: every face lit beside the mount that the served set leaves out, in ordinal order.
 * A lock narrows the served set (the pūlama's standing event, the custody's own close), and each such face drops from the
 * daemon island, so its island opening ends and no visit reads it. The mount never drops here (its lock recomposes the vessel).
 */
export function unservedLitFaces(served: readonly number[], mount: number | null, lit: ReadonlySet<number>): number[] {
  const serving = new Set(served);
  return [...lit].filter((o) => o !== mount && !serving.has(o)).sort((a, b) => a - b);
}

/** What a leaving face's drop needs, every piece held in memory: no sealed read gates it. */
export interface SiblingDropOrder {
  /** The atom keys the daemon island knows the face by, as the vessel holds them in memory. */
  readonly workers: readonly string[];
  /** The face's host entries, by group. */
  readonly groups: readonly string[];
  /** The daemon island drops the face (its provider, engine, view and opening), draining its in-flight verbs first. */
  readonly dropWorker: (atomKey: string) => Promise<void>;
  /** The island acknowledged the drop of `atomKey`: only now does the vessel let its retry key go. */
  readonly acknowledged: (atomKey: string) => void;
  /** The face's queued saves flush and land sealed under its own session before that session drops. */
  readonly flushSaves: (group: string) => Promise<void>;
  /** The host side drops: what still waits unsaved, the cache, the face's session and its keepers. */
  readonly teardownHost: (group: string) => void;
  readonly log: (line: string) => void;
}

/**
 * A FACE THAT LEAVES (Sol 407d, 407e): the face stands closed to new reads before this runs (the visit gate reads the custody
 * holder, and the door's lit set leaves it out). Its queued saves seal first, while its sealing seat in the daemon island and
 * its document ownership still stand; then the island hears the drop from the key held in memory (never from a read a lock
 * could have sealed) and acknowledges it, and only then does the vessel let that retry key go; then the host side drops. A
 * failed flush logs by name and the drop goes on; a worker drop that fails keeps its key and still tears the host side down;
 * a host teardown that fails leaves the worker dropped. Each failure answers after the order ran.
 */
export async function dropSiblingInOrder(order: SiblingDropOrder): Promise<void> {
  for (const group of order.groups) {
    try { await order.flushSaves(group); }
    catch (error) { order.log(`[lit-set] face ${group}'s queued saves did not flush before it dropped: ${error instanceof Error ? error.message : String(error)}`); }
  }
  let workerFault: unknown = null;
  for (const atomKey of new Set(order.workers)) {
    try { await order.dropWorker(atomKey); order.acknowledged(atomKey); } catch (error) { workerFault ??= error; }
  }
  for (const group of order.groups) order.teardownHost(group);
  if (workerFault !== null) throw workerFault;
}

/** A torn sibling cannot take the mounted face's boot down. A sibling receives the vessel ground and the bags it OWNS while lit
 *  (`litFaceOwnBags`: the daemon wiki's device slots, its daemon canon by its relation, its catalog half, its selves record), so its own memory seals
 *  under its own hive; its planes need their own face proof, and the mounted slot's user wiki bags and the house canon belong to
 *  the mounted face. Each entry names its handle index and relation, so a face-named wave finds it. */
export async function joinedFaceAuth(ports: JoinedFaceAuthPorts): Promise<JoinedFaceAuth[]> {
  const result: JoinedFaceAuth[] = [];
  for (const ordinal of ports.ordinals()) {
    if (ordinal === ports.mounted) continue;
    let seed: Uint8Array | null = null;
    let secret: Uint8Array | null = null;
    try {
      if (!ports.current(ordinal)) continue;
      if (!await ports.unlocked(ordinal) || !ports.current(ordinal)) continue;
      const pins = await ports.anchors(ordinal);
      if (!ports.current(ordinal)) continue;
      if (!pins?.personaGroupId || !pins.signerDid || !pins.personaKelPrefix || !pins.deviceEdge) throw new Error("identity anchors missing");
      const group = pins.personaGroupId;
      const anchor = await ports.anchor(group);
      if (!ports.current(ordinal)) continue;
      const chain = await ports.chain(pins.personaKelPrefix);
      if (!ports.current(ordinal)) continue;
      seed = await ports.atomSeed(group);
      if (!ports.current(ordinal)) continue;
      if (!anchor || !chain?.length || !seed) throw new Error("face anchor, KEL chain, or atom missing");
      const key = ports.atomKey(seed, group);
      if (key !== pins.deviceEdge.deviceVerifyingKey) throw new Error("atom differs from device edge");
      secret = await ports.addressSecret(group);
      if (!ports.current(ordinal)) continue;
      const archive = await ports.veilArchive(group);
      if (!ports.current(ordinal)) continue;
      const relation = (await ports.relation?.(group)) ?? null;
      if (!ports.current(ordinal)) continue;
      result.push({ atom: { seed: Buffer.from(seed).toString("hex"), key }, personaGroupId: group, faceAnchor: anchor, handleIndex: ordinal,
        ...(relation ? { faceRelation: relation } : {}),
        personaKel: { prefix: pins.personaKelPrefix, chain }, deviceEdge: pins.deviceEdge, signerDid: pins.signerDid,
        ...(pins.meshCabalDocIdHex ? { meshCabalDocIdHex: pins.meshCabalDocIdHex } : {}),
        ...(secret ? { faceAddressSecret: Buffer.from(secret).toString("hex") } : {}),
        ...(archive ? { veilArchiveBytes: archive } : {}), registerBags: deriveRegisterBags({ fleets: [], wikiBags: litFaceOwnBags(relation, group) }) });
    } catch (e) {
      ports.log(`joined face h${ordinal} skipped: ${e instanceof Error ? e.message : String(e)}`);
    } finally { seed?.fill(0); secret?.fill(0); }
  }
  return result;
}

/** Read the lit set from the entries that own each face's live resources. */
export function litSiblingOrdinals(entries: Iterable<{ readonly ordinal: number }>): ReadonlySet<number> {
  return new Set(Array.from(entries, (entry) => entry.ordinal));
}

/** Own each face's generation and serialize its provider admission/removal. Detached work retains the same live check. */
export function siblingFaceWork() {
  type Generation = { readonly live: () => boolean; flight?: Promise<void> };
  const generations = new Map<number, Generation>();
  const tails = new Map<number, Promise<void>>();
  let closed = false;
  const generation = (ordinal: number): Generation => {
    let held = generations.get(ordinal);
    if (!held) {
      const next: Generation = { live: () => !closed && generations.get(ordinal) === next };
      held = next;
      if (!closed) generations.set(ordinal, held);
    }
    return held;
  };
  const track = (ordinal: number, task: Promise<void>): Promise<void> => {
    // Keep a handled tail so a failed task neither escapes nor poisons an explicit retry.
    const tail = task.then(() => {}, () => {});
    tails.set(ordinal, tail);
    void tail.then(() => { if (tails.get(ordinal) === tail) tails.delete(ordinal); });
    return task;
  };
  return {
    capture: (ordinal: number): (() => boolean) => generation(ordinal).live,
    invalidate: (ordinal: number): void => { generations.delete(ordinal); },
    run(ordinal: number, action: (live: () => boolean) => Promise<void>): Promise<void> {
      if (closed) return Promise.resolve();
      const held = generation(ordinal);
      if (held.flight) return held.flight;
      const task = (tails.get(ordinal) ?? Promise.resolve()).then(async () => {
        if (held.live()) await action(held.live);
      }).finally(() => { if (held.flight === task) delete held.flight; });
      held.flight = task;
      return track(ordinal, task);
    },
    remove(ordinal: number, action: () => Promise<void>): Promise<void> {
      generations.delete(ordinal);
      return track(ordinal, (tails.get(ordinal) ?? Promise.resolve()).then(action));
    },
    close(): void { closed = true; generations.clear(); },
  };
}
