/** One face's causal effect door over its shared intent plane. */
import type { DocHandle, LarDoc, PersonaKelEvent, FaceAnchor, IntentVerbRegistry, IntentView, IntentEntryBody, SignedIntentEntry, IntentPaneModel, IntentReadInput, IntentRelayResult } from "@lararium/mesh";
import { buildIntent, buildOutcome, faceRosterForIntents, intentEntryRecordsOfGroup, intentId, intentPaneModel, mayAct, readFace, readIntentPlane, writeIntentEntry, intentAdmissionRecordsOfGroup, readIntentAdmission, signIntentAdmission, writeIntentAdmission, localIntentHeads, decideAdmission } from "@lararium/mesh";
import type { IntentSigner } from "@lararium/mesh";

type Standing = "stands" | "aside" | "unknown";

/**
 * THE ASYNCHRONOUS HALF of the authority a door decides on: every answer an async source gives (a device's standing off a
 * verified board fold, a held frontier) is fetched here, before any synchronous turn reads it, and kept with the WITNESS it
 * was read under. The commit turn never invokes it; it asks `holds()`, which reads the witness against the live documents.
 */
export interface AuthorityAcquisition {
  /** Fetch every async-sourced answer for these atoms, each under the version witness it was read at. */
  acquire(atoms: ReadonlySet<string>): Promise<void>;
  /** True while every answer the last acquisition took still stands under its witness, read synchronously and live. */
  holds(): boolean;
  /** Hear each change of the documents the witness covers (an attached door re-passes on it); returns the unsubscribe. */
  watch?(wake: () => void): () => void;
}

/** A watch over document handles: each one's change wakes, and the returned call drops every listener. */
export function watchHandles(handles: readonly { on(event: "change", listener: () => void): void; off(event: "change", listener: () => void): void }[]): (wake: () => void) => () => void {
  return (wake) => {
    const listener = (): void => wake();
    for (const h of handles) h.on("change", listener);
    return () => { for (const h of handles) h.off("change", listener); };
  };
}

export interface FaceIntentDoorPorts {
  readonly group: string;
  readonly atom: IntentSigner;
  readonly plane: DocHandle<LarDoc>;
  readonly personaRecords: () => readonly unknown[];
  /** The face's KEL chain as the local replica holds it NOW: a live synchronous reader, read at each decision, never a captured array. */
  readonly kelChain: () => readonly PersonaKelEvent[] | null;
  readonly anchor?: FaceAnchor | null;
  /** A device's standing as of NOW, synchronously. An answer an async source fetched stands only while its witness holds (`witnessedStandings`). */
  readonly standing: (atom: string) => Standing;
  /** The async acquisition behind `standing` and `heldFrontiers`: awaited before the commit turn, never invoked inside it. */
  readonly acquisition?: AuthorityAcquisition;
  readonly holdsCapability?: (atom: string, capability: string) => boolean;
  readonly verbs: IntentVerbRegistry;
  readonly heldFrontiers?: () => ReadonlySet<string>;
  readonly effects?: ReadonlyMap<string, (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => Promise<unknown>>;
  readonly runDeclaredEffect?: (verb: string, args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => Promise<unknown>;
  readonly log: (message: string) => void;
}

/**
 * One authority input an async source answers, kept with its synchronous WITNESS: `version` names the heads of every document
 * the fetch reads. A fetch counts only when the version reads the same before and after it (a merge that lands DURING the
 * fetch voids it, and the fetch runs again, `tries` times at most), and its answer stands only while the live version still
 * reads that value, so a merge that lands AFTER it voids it in the very turn that would act on it. A fetch whose own writes
 * move the version (a ledger that keeps what it counted) settles on the next try, since those writes keep only what is new.
 */
export function witnessed<T>(fetch: () => Promise<T>, version: () => string, options: { readonly tries?: number; readonly watch?: (wake: () => void) => () => void } = {}): { readonly now: () => T | null; readonly acquisition: AuthorityAcquisition } {
  const tries = options.tries ?? 3;
  let held: { readonly version: string; readonly value: T } | null = null;
  return {
    now: () => (held !== null && held.version === version() ? held.value : null),
    acquisition: {
      async acquire() {
        for (let attempt = 0; attempt < tries; attempt++) {
          const before = version(), value = await fetch();
          if (version() === before) { held = { version: before, value }; return; }
        }
      },
      holds: () => held !== null && held.version === version(),
      ...(options.watch ? { watch: options.watch } : {}),
    },
  };
}

/** Each atom's standing off an async reader under one witness over every document the reader reads; an atom never fetched, or fetched under a moved witness, reads `unknown`. */
export function witnessedStandings(read: (atom: string) => Promise<Standing>, version: () => string, options: { readonly tries?: number; readonly watch?: (wake: () => void) => () => void } = {}): { readonly standing: (atom: string) => Standing; readonly acquisition: AuthorityAcquisition } {
  const tries = options.tries ?? 3;
  const held = new Map<string, { readonly version: string; readonly standing: Standing }>();
  let asked: readonly string[] = [];
  return {
    standing: (atom) => { const got = held.get(atom.toLowerCase()); return got !== undefined && got.version === version() ? got.standing : "unknown"; },
    acquisition: {
      async acquire(atoms) {
        asked = [...atoms].map((a) => a.toLowerCase());
        for (let attempt = 0; attempt < tries; attempt++) {
          const before = version(), answers: [string, Standing][] = [];
          for (const atom of asked) answers.push([atom, await read(atom)]);
          if (version() !== before) continue;
          for (const [atom, standing] of answers) held.set(atom, { version: before, standing });
          return;
        }
      },
      holds: () => { const now = version(); return asked.every((a) => held.get(a)?.version === now); },
      ...(options.watch ? { watch: options.watch } : {}),
    },
  };
}

/** What an outcome keeps of an effect's answer: names, counts, flags and short reasons, never a body (the rubric: content never rides an entry). */
export function receiptFields(result: unknown): Record<string, unknown> {
  if (typeof result !== "object" || result === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
    if (typeof value === "boolean" || typeof value === "number") out[key] = value;
    else if (typeof value === "string" && value.length <= 512) out[key] = value;
    else if (Array.isArray(value)) {
      if (value.length <= 16 && value.every((v) => typeof v === "string" && v.length <= 128)) out[key] = value;
      else out[`${key}Count`] = value.length;
    }
  }
  return out;
}

export type FaceIntentAdmissionPorts = Pick<FaceIntentDoorPorts, "group" | "plane" | "personaRecords" | "kelChain" | "anchor" | "standing" | "acquisition" | "holdsCapability" | "verbs" | "heldFrontiers"> & {
  /** The relay ring's durable row, read asynchronously before the commit turn: a face switched off refuses `face-off`. */
  readonly relayAdmits?: () => boolean | Promise<boolean>;
  /**
   * The ring's synchronous mirror, read IN the commit turn: a PROCESS-LOCAL veto. It reads a switch this process threw in the
   * same turn; a switch another process throws reaches an admission only through the durable read above, so an admission
   * already past that read when it lands may still append.
   */
  readonly relayStands?: () => boolean;
};
const standingAtoms = (ports: FaceIntentAdmissionPorts, face: NonNullable<ReturnType<typeof readFace>>): Set<string> => {
  const projection = face.project(ports.personaRecords(), ports.group);
  return new Set([...projection.devices.map((d) => d.toLowerCase()), ...intentEntryRecordsOfGroup(ports.plane.doc(), ports.group).map((r) => String((r as { signer?: unknown })?.signer ?? "").toLowerCase())].filter(Boolean));
};
const faceNow = (ports: FaceIntentAdmissionPorts): NonNullable<ReturnType<typeof readFace>> => {
  const face = readFace(ports.kelChain() ?? undefined, ports.anchor);
  if (!face) throw new Error("face-intent-door: no verified face lineage");
  return face;
};
/** The asynchronous half of a read: every async-sourced authority answer, fetched under its witness before any synchronous turn reads it. */
export async function acquireAuthority(ports: FaceIntentAdmissionPorts): Promise<void> {
  if (ports.acquisition) await ports.acquisition.acquire(standingAtoms(ports, faceNow(ports)));
}
/**
 * The synchronous half: the lineage, the roster, the records, the admissions, the standings and the frontiers, each read from
 * its LIVE port in one turn, with no await between them and whatever acts on the result. No async port runs here: an answer an
 * async source fetched reads through its witness, and reads `unknown` once the documents behind it moved.
 */
export function readIntentNow(ports: FaceIntentAdmissionPorts): { view: IntentView; records: unknown[]; readInput: Omit<IntentReadInput, "records"> } {
  const face = faceNow(ports);
  const settled = face.project(ports.personaRecords(), ports.group);
  const records = intentEntryRecordsOfGroup(ports.plane.doc(), ports.group);
  const readInput: Omit<IntentReadInput, "records"> = { group: ports.group, admissions: intentAdmissionRecordsOfGroup(ports.plane.doc(), ports.group),
    face: faceRosterForIntents(settled, face.lineage), standing: (atom) => ports.standing(atom.toLowerCase()),
    ...(ports.holdsCapability ? { holdsCapability: ports.holdsCapability } : {}), verbs: ports.verbs, ...(ports.heldFrontiers ? { heldFrontiers: ports.heldFrontiers() } : {}) };
  return { view: readIntentPlane({ ...readInput, records }), records, readInput };
}
export function makeFaceIntentReader(ports: FaceIntentAdmissionPorts) {
  const read = async (): Promise<{ view: IntentView; records: unknown[]; readInput: Omit<IntentReadInput, "records"> }> => { await acquireAuthority(ports); return readIntentNow(ports); };
  return { read };
}

/** One plane's key across handles: its document id where the handle names one, so two handles over one document share one queue and one fence. */
const planeKey = (plane: DocHandle<LarDoc>): unknown => (plane as { readonly documentId?: unknown }).documentId ?? plane;
const admissionQueues = new Map<unknown, Promise<void>>();
export async function admitAgentEntry(ports: FaceIntentAdmissionPorts, raw: unknown, relay: IntentSigner): Promise<IntentRelayResult> {
  const key = planeKey(ports.plane);
  const prior = admissionQueues.get(key) ?? Promise.resolve();
  const task = prior.then(async (): Promise<IntentRelayResult> => {
    try {
      const priorReceipt = (doc: LarDoc | undefined, cid: string) => {
        for (const rawReceipt of intentAdmissionRecordsOfGroup(doc, ports.group)) {
          const found = readIntentAdmission(rawReceipt, { group: ports.group });
          if (found.ok && found.admission.body.relay === relay.key.toLowerCase() && found.admission.body.entry === cid) return found.admission;
        }
        return null;
      };
      const fingerprint = (read: Omit<IntentReadInput, "records">) => JSON.stringify({ roster: [...read.face.rosterCids].sort(), lineage: read.face.lineage.at(-1), frontiers: [...(read.heldFrontiers ?? [])].sort() });
      const witnessHolds = () => !ports.acquisition || ports.acquisition.holds();
      for (let attempt = 0; attempt < 3; attempt++) {
        await acquireAuthority(ports);
        if (!witnessHolds()) continue;
        const { records, readInput } = readIntentNow(ports);
        const decision = decideAdmission({ group: ports.group, raw, records, read: readInput });
        if (!decision.ok) return { status: "refused", refusal: decision.refusal };
        const receipt = await signIntentAdmission({ group: ports.group, entry: decision.cid, delegation: decision.delegation, heads: localIntentHeads(records) }, relay);
        if (!readIntentAdmission(receipt, { group: ports.group }).ok) return { status: "refused", refusal: "fault" };
        // Every async acquisition runs first: the async-sourced answers under their witnesses, then the ring's durable row.
        await acquireAuthority(ports);
        if (ports.relayAdmits && (await ports.relayAdmits()) !== true) return { status: "refused", refusal: "face-off" };
        // THE COMMIT TURN: from here to the append nothing awaits. Every authority input reads live (the chain, the roster, the
        // records), or through a witness checked against the live documents (a moved witness re-acquires, never acts).
        if (ports.relayStands && !ports.relayStands()) return { status: "refused", refusal: "face-off" };
        if (!witnessHolds()) continue;
        const fresh = readIntentNow(ports);
        const doc = ports.plane.doc();
        const current = decideAdmission({ group: ports.group, raw: decision.entry, records: intentEntryRecordsOfGroup(doc, ports.group), read: { ...fresh.readInput, admissions: intentAdmissionRecordsOfGroup(doc, ports.group) } });
        if (!current.ok) return { status: "refused", refusal: current.refusal };
        if (fingerprint(readInput) !== fingerprint(fresh.readInput)) continue;
        const previous = priorReceipt(doc, current.cid);
        if (current.duplicate && previous) return { status: "duplicate", receipt: previous };
        ports.plane.change(draft => {
          if (!current.duplicate) writeIntentEntry(draft, current.entry);
          writeIntentAdmission(draft, receipt);
        });
        return { status: current.duplicate ? "duplicate" : "admitted", receipt };
      }
      return { status: "refused", refusal: "fault" };
    } catch { return { status: "refused", refusal: "fault" }; }
  });
  const tail = task.then(() => undefined); admissionQueues.set(key, tail);
  try { return await task; } finally { if (admissionQueues.get(key) === tail) admissionQueues.delete(key); }
}

/**
 * THE IN-FLIGHT FENCE: a single-effect run in flight on a plane fences every other executor of its id until it settles, and its
 * settling (an outcome or a fault) wakes each door it fenced. Its reach: the doors of ONE process over one document (any handle
 * naming that document). Another process, another device, or this one after a crash holds no part of it, so a re-pin that lands
 * while the effect runs elsewhere can still open a second run there; closing that wants a durable claim the effect checks.
 */
/** Per plane, each fenced id and the doors waiting on it; a plane's map stays once made, so no door ever fences into a map another dropped. */
const flights = new Map<unknown, Map<string, Set<() => void>>>();
/**
 * Per document, each single-effect id whose effect RAN TO COMPLETION in this process, with the handles that have read its outcome.
 * The id stays fenced from the moment the effect returns, whether or not its receipt lands (a failed receipt is owed and retried as
 * a receipt, never as a run): an outcome reaches the completing handle's replica first, and a door over another handle whose
 * replica lacks it still reads the intent open. The entry leaves once every handle whose doors read this document has read the
 * outcome, which then fences the id itself.
 */
const settledRuns = new Map<unknown, Map<string, Set<DocHandle<LarDoc>>>>();
/** Per document, the handles whose doors read it, counted per door; a door counts from its first pass until it detaches. */
const visitors = new Map<unknown, Map<DocHandle<LarDoc>, number>>();
/** The settled ids this process still fences on a document: the retention `settledRuns` keeps. */
export function settledRunsOf(plane: DocHandle<LarDoc>): ReadonlySet<string> { return new Set(settledRuns.get(planeKey(plane))?.keys() ?? []); }
export function makeFaceIntentDoor(ports: FaceIntentDoorPorts) {
  let running: Promise<void> | null = null, dirty = false, visiting = false;
  const read = async (): Promise<IntentView> => (await makeFaceIntentReader(ports).read()).view;
  const wake = (): void => { void heed(); };
  /** The fence-waiter sets this door joined, so its detach leaves none of them. */
  const waits = new Set<Set<() => void>>();
  /** Receipts this door owes: effects that ran to completion whose outcome never landed. */
  const owed = new Map<string, Record<string, unknown>>();
  const publish = async (id: string, fields: Record<string, unknown>): Promise<void> => {
    const receipt = await buildOutcome({ group: ports.group, signer: ports.atom, cause: id, result: { status: "done", ...fields } });
    ports.plane.change((draft) => writeIntentEntry(draft, receipt));
  };
  /** One pass; true when a standing it needed went stale under its witness, so another pass re-acquires. */
  const pass = async (): Promise<boolean> => {
    // The async-sourced answers arrive first; everything after rebuilds from the LIVE ports in one turn.
    await acquireAuthority(ports);
    const key = planeKey(ports.plane);
    const flying = flights.get(key) ?? new Map<string, Set<() => void>>();
    flights.set(key, flying);
    const settled = settledRuns.get(key) ?? new Map<string, Set<DocHandle<LarDoc>>>();
    settledRuns.set(key, settled);
    const readers = visitors.get(key) ?? new Map<DocHandle<LarDoc>, number>();
    visitors.set(key, readers);
    if (!visiting) { visiting = true; readers.set(ports.plane, (readers.get(ports.plane) ?? 0) + 1); }
    // An owed receipt lands before anything else runs: it settles an effect that already ran, and never runs it again.
    for (const [id, fields] of [...owed]) {
      try { await publish(id, fields); owed.delete(id); settled.get(id)?.add(ports.plane); } catch (error) { ports.log(`face intent ${id} receipt still owed: ${String(error)}`); }
    }
    let view = readIntentNow(ports).view, stale = false, again = false;
    // The retention: this handle reads each settled id's outcome, and an id every reading handle has seen leaves.
    for (const [id, seen] of [...settled]) {
      if (!view.intents.find((i) => i.id === id)?.slots.some((slot) => slot.winner !== null)) continue;
      seen.add(ports.plane);
      if ([...readers.keys()].every((handle) => seen.has(handle))) settled.delete(id);
    }
    for (const first of view.intents) {
      // Each effect revalidates from the CURRENT documents in the turn that invokes it: a revocation, a cancel, a takeover, an
      // outcome an earlier effect merged, or a standing whose witness moved stops the later ones. Only a pass that has awaited
      // since its last build rebuilds.
      if (stale) { view = readIntentNow(ports).view; stale = false; }
      const state = view.intents.find((i) => i.id === first.id);
      if (!state) continue;
      const may = mayAct(view, state.id, ports.atom.key.toLowerCase());
      if (!may.act) { if (may.reason === "unknown-frontier" && ports.acquisition && !ports.acquisition.holds()) again = true; continue; }
      if (state.class === "single-effect" && settled.has(state.id)) continue;
      if (state.class === "single-effect" && flying.has(state.id)) { const waiting = flying.get(state.id)!; waiting.add(wake); waits.add(waiting); continue; }
      const effect = ports.effects?.get(state.verb) ?? (ports.runDeclaredEffect && state.class === "idempotent" ? (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => ports.runDeclaredEffect!(state.verb, args, ctx) : undefined);
      if (!effect || !ports.verbs.classOfVerb(state.verb)) continue;
      const invocation = (intentEntryRecordsOfGroup(ports.plane.doc(), ports.group) as SignedIntentEntry[]).find((r) => r?.body?.entry === "intent" && r.body.issuer === state.issuer &&
        intentId(r.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }) === state.id);
      if (!invocation) continue;
      const pinnedAtom = state.audience.mode === "pinned" ? state.audience.atom : state.audience.mode === "asks" && state.answer && state.answer !== "contested"
        ? (state.answer.entry.body.executor as string | undefined) : undefined;
      if (state.class === "single-effect" && !pinnedAtom) continue;
      const fenced = state.class === "single-effect";
      if (fenced) flying.set(state.id, new Set());
      stale = true;
      try {
        const result = await effect(invocation.body.args, { intentId: state.id, intent: invocation.body, pinnedAtom: pinnedAtom ?? ports.atom.key, agent: state.agent ? { key: state.issuer, delegation: state.agent.delegation } : null });
        // The effect RAN: from here the id stays settled whatever its receipt does.
        if (fenced) settled.set(state.id, new Set());
        const fields = receiptFields(result);
        try { await publish(state.id, fields); settled.get(state.id)?.add(ports.plane); }
        catch (error) { owed.set(state.id, fields); ports.log(`face intent ${state.id} ran; its receipt is owed: ${String(error)}`); }
      } catch (error) { ports.log(`face intent ${state.id} faulted: ${String(error)}`); }
      finally {
        if (fenced) {
          const waiting = flying.get(state.id); flying.delete(state.id);
          for (const fencedDoor of waiting ?? []) fencedDoor();
        }
      }
    }
    return again;
  };
  const heed = (): Promise<void> => {
    if (running) { dirty = true; return running; }
    running = (async () => {
      // A stale witness asks for another pass, three at most per heed: a source whose documents churn rests until the next change.
      let repasses = 0;
      do { dirty = false; try { if ((await pass()) && repasses++ < 3) dirty = true; } catch (error) { ports.log(`face intent read faulted: ${String(error)}`); } } while (dirty);
      running = null;
    })();
    return running;
  };
  /** Wake on the plane's changes and on the documents behind the acquisition's witness; the returned call drops both, every fence wait this door joined, and its count among the document's readers. */
  const attach = (): (() => void) => {
    const changed = () => { void heed(); };
    ports.plane.on("change", changed);
    const unwatch = ports.acquisition?.watch?.(changed);
    void heed();
    return () => {
      ports.plane.off("change", changed); unwatch?.();
      for (const waiting of waits) waiting.delete(wake);
      waits.clear();
      if (visiting) {
        visiting = false;
        const readers = visitors.get(planeKey(ports.plane)), left = (readers?.get(ports.plane) ?? 1) - 1;
        if (left > 0) readers!.set(ports.plane, left); else readers?.delete(ports.plane);
      }
    };
  };
  const describe = async (): Promise<{ readonly view: IntentView; readonly pane: IntentPaneModel }> => { const view = await read(); return { view, pane: intentPaneModel(view) }; };
  return { heed, attach, describe };
}

/**
 * THE FACE-JOIN NONCE names the joinee's atom AND the hearth it pins: the intent id excludes the audience, so one nonce
 * over two pins named one intent and the fold kept whichever record sorted first. One pin over the same bytes keeps one
 * id across every replay (the join stays idempotent); a summons pinned to another hearth is its own intent.
 */
export function faceJoinNonce(atomKey: string, audience: { readonly mode: string; readonly atom?: string }): string {
  const atom = atomKey.toLowerCase();
  return audience.mode === "pinned" && audience.atom ? `${atom}:${audience.atom.toLowerCase()}` : atom;
}

/** The joinee issues one invocation through the shared plane, keyed by its atom and the hearth it pins. */
export async function requestFaceJoin(input: { readonly group: string; readonly plane: DocHandle<LarDoc>; readonly atom: IntentSigner;
  readonly hearthAtom?: string; readonly projection?: { readonly admissions: readonly { readonly deviceKey: string }[] };
  readonly summons: unknown; readonly verbs: IntentVerbRegistry }): Promise<string> {
  const hearth = input.hearthAtom ?? input.projection?.admissions[0]?.deviceKey;
  if (!hearth) throw new Error("face-join: no founding hearth admission");
  const entry = await buildIntent({ group: input.group, signer: input.atom, verb: "face-join", args: { summons: input.summons },
    nonce: faceJoinNonce(input.atom.key, { mode: "pinned", atom: hearth }), audience: { mode: "pinned", atom: hearth.toLowerCase() }, verbs: input.verbs });
  const id = intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  input.plane.change((draft) => writeIntentEntry(draft, entry));
  return id;
}
