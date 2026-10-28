/** One face's causal effect door over its shared intent plane. */
import type { DocHandle, LarDoc, PersonaKelEvent, FaceAnchor, IntentVerbRegistry, IntentView, IntentEntryBody, SignedIntentEntry, IntentPaneModel, IntentReadInput, IntentRelayResult } from "@lararium/mesh";
import { buildIntent, buildOutcome, faceRosterForIntents, intentEntryRecordsOfGroup, intentId, intentPaneModel, mayAct, readFace, readIntentPlane, writeIntentEntry, intentAdmissionRecordsOfGroup, readIntentAdmission, signIntentAdmission, writeIntentAdmission, localIntentHeads, decideAdmission } from "@lararium/mesh";
import type { IntentSigner } from "@lararium/mesh";

export interface FaceIntentDoorPorts {
  readonly group: string;
  readonly atom: IntentSigner;
  readonly plane: DocHandle<LarDoc>;
  readonly personaRecords: () => readonly unknown[];
  readonly kelChain: readonly PersonaKelEvent[];
  readonly anchor?: FaceAnchor | null;
  readonly standing: (atom: string) => "stands" | "aside" | "unknown" | Promise<"stands" | "aside" | "unknown">;
  readonly holdsCapability?: (atom: string, capability: string) => boolean;
  readonly verbs: IntentVerbRegistry;
  readonly heldFrontiers?: () => ReadonlySet<string>;
  readonly effects?: ReadonlyMap<string, (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => Promise<unknown>>;
  readonly runDeclaredEffect?: (verb: string, args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => Promise<unknown>;
  readonly log: (message: string) => void;
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

export type FaceIntentAdmissionPorts = Pick<FaceIntentDoorPorts, "group" | "plane" | "personaRecords" | "kelChain" | "anchor" | "standing" | "holdsCapability" | "verbs" | "heldFrontiers">;
export function makeFaceIntentReader(ports: FaceIntentAdmissionPorts) {
  const read = async (): Promise<{ view: IntentView; records: unknown[]; readInput: Omit<IntentReadInput, "records"> }> => {
    const face = readFace(ports.kelChain, ports.anchor);
    if (!face) throw new Error("face-intent-door: no verified face lineage");
    const projection = face.project(ports.personaRecords(), ports.group);
    const standings = new Map<string, "stands" | "aside" | "unknown">();
    for (const atom of new Set([...projection.devices.map((d) => d.toLowerCase()), ...intentEntryRecordsOfGroup(ports.plane.doc(), ports.group).map((r) => String((r as { signer?: unknown })?.signer ?? "").toLowerCase())])) {
      if (atom) standings.set(atom, await ports.standing(atom));
    }
    const records = intentEntryRecordsOfGroup(ports.plane.doc(), ports.group);
    const readInput: Omit<IntentReadInput, "records"> = { group: ports.group, admissions: intentAdmissionRecordsOfGroup(ports.plane.doc(), ports.group),
      face: faceRosterForIntents(projection, face.lineage), standing: (atom) => standings.get(atom.toLowerCase()) ?? "unknown",
      ...(ports.holdsCapability ? { holdsCapability: ports.holdsCapability } : {}), verbs: ports.verbs, ...(ports.heldFrontiers ? { heldFrontiers: ports.heldFrontiers() } : {}) };
    return { view: readIntentPlane({ ...readInput, records }), records, readInput };
  };
  return { read };
}

const admissionQueues = new WeakMap<object, Promise<void>>();
export async function admitAgentEntry(ports: FaceIntentAdmissionPorts, raw: unknown, relay: IntentSigner): Promise<IntentRelayResult> {
  const prior = admissionQueues.get(ports.plane) ?? Promise.resolve();
  const task = prior.then(async (): Promise<IntentRelayResult> => {
    try {
      const { records, readInput } = await makeFaceIntentReader(ports).read();
      const decision = decideAdmission({ group: ports.group, raw, records, read: readInput });
      if (!decision.ok) return { status: "refused", refusal: decision.refusal };
      const priorReceipt = (doc: LarDoc | undefined) => {
        for (const rawReceipt of intentAdmissionRecordsOfGroup(doc, ports.group)) {
          const found = readIntentAdmission(rawReceipt, { group: ports.group });
          if (found.ok && found.admission.body.relay === relay.key.toLowerCase() && found.admission.body.entry === decision.cid) return found.admission;
        }
        return null;
      };
      const existing = decision.duplicate && priorReceipt(ports.plane.doc());
      if (existing) return { status: "duplicate", receipt: existing };
      const receipt = await signIntentAdmission({ group: ports.group, entry: decision.cid, delegation: decision.delegation, heads: localIntentHeads(records) }, relay);
      if (!readIntentAdmission(receipt, { group: ports.group }).ok) return { status: "refused", refusal: "fault" };
      const mergedReceipt = priorReceipt(ports.plane.doc());
      if (mergedReceipt) return { status: "duplicate", receipt: mergedReceipt };
      let result: IntentRelayResult = { status: "refused", refusal: "fault" };
      ports.plane.change(draft => {
        const current = decideAdmission({ group: ports.group, raw: decision.entry, records: intentEntryRecordsOfGroup(draft, ports.group), read: readInput });
        if (!current.ok) { result = { status: "refused", refusal: current.refusal }; return; }
        const previous = priorReceipt(draft);
        if (current.duplicate && previous) { result = { status: "duplicate", receipt: previous }; return; }
        if (!current.duplicate) writeIntentEntry(draft, current.entry);
        writeIntentAdmission(draft, receipt);
        result = { status: current.duplicate ? "duplicate" : "admitted", receipt };
      });
      return result;
    } catch { return { status: "refused", refusal: "fault" }; }
  });
  const tail = task.then(() => undefined); admissionQueues.set(ports.plane, tail);
  try { return await task; } finally { if (admissionQueues.get(ports.plane) === tail) admissionQueues.delete(ports.plane); }
}

export function makeFaceIntentDoor(ports: FaceIntentDoorPorts) {
  let running: Promise<void> | null = null, dirty = false;
  const read = async (): Promise<IntentView> => (await makeFaceIntentReader(ports).read()).view;
  const pass = async (): Promise<void> => {
    const view = await read();
    const raw = intentEntryRecordsOfGroup(ports.plane.doc(), ports.group) as SignedIntentEntry[];
    for (const state of view.intents) {
      if (!mayAct(view, state.id, ports.atom.key.toLowerCase()).act) continue;
      const effect = ports.effects?.get(state.verb) ?? (ports.runDeclaredEffect && state.class === "idempotent" ? (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string; agent: { key: string; delegation: string } | null }) => ports.runDeclaredEffect!(state.verb, args, ctx) : undefined);
      if (!effect || !ports.verbs.classOfVerb(state.verb)) continue;
      const invocation = raw.find((r) => r?.body?.entry === "intent" && r.body.issuer === state.issuer &&
        intentId(r.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }) === state.id);
      if (!invocation) continue;
      const pinnedAtom = state.audience.mode === "pinned" ? state.audience.atom : state.audience.mode === "asks" && state.answer && state.answer !== "contested"
        ? (state.answer.entry.body.executor as string | undefined) : undefined;
      if (state.class === "single-effect" && !pinnedAtom) continue;
      try {
        const result = await effect(invocation.body.args, { intentId: state.id, intent: invocation.body, pinnedAtom: pinnedAtom ?? ports.atom.key, agent: state.agent ? { key: state.issuer, delegation: state.agent.delegation } : null });
        const receipt = await buildOutcome({ group: ports.group, signer: ports.atom, cause: state.id, result: { status: "done", ...receiptFields(result) } });
        ports.plane.change((draft) => writeIntentEntry(draft, receipt));
      } catch (error) { ports.log(`face intent ${state.id} faulted: ${String(error)}`); }
    }
  };
  const heed = (): Promise<void> => {
    if (running) { dirty = true; return running; }
    running = (async () => { do { dirty = false; try { await pass(); } catch (error) { ports.log(`face intent read faulted: ${String(error)}`); } } while (dirty); running = null; })();
    return running;
  };
  const attach = (): (() => void) => {
    const changed = () => { void heed(); };
    ports.plane.on("change", changed);
    void heed();
    return () => ports.plane.off("change", changed);
  };
  const describe = async (): Promise<{ readonly view: IntentView; readonly pane: IntentPaneModel }> => { const view = await read(); return { view, pane: intentPaneModel(view) }; };
  return { heed, attach, describe };
}

/** The joinee issues one invocation through the shared plane, keyed by its atom. */
export async function requestFaceJoin(input: { readonly group: string; readonly plane: DocHandle<LarDoc>; readonly atom: IntentSigner;
  readonly hearthAtom?: string; readonly projection?: { readonly admissions: readonly { readonly deviceKey: string }[] };
  readonly summons: unknown; readonly verbs: IntentVerbRegistry }): Promise<string> {
  const hearth = input.hearthAtom ?? input.projection?.admissions[0]?.deviceKey;
  if (!hearth) throw new Error("face-join: no founding hearth admission");
  const entry = await buildIntent({ group: input.group, signer: input.atom, verb: "face-join", args: { summons: input.summons },
    nonce: input.atom.key.toLowerCase(), audience: { mode: "pinned", atom: hearth.toLowerCase() }, verbs: input.verbs });
  const id = intentId(entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  input.plane.change((draft) => writeIntentEntry(draft, entry));
  return id;
}
