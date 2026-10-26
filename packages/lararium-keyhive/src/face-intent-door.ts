/** One face's causal effect door over its shared intent plane. */
import type { DocHandle, LarDoc, PersonaKelEvent, FaceAnchor, IntentVerbRegistry, IntentView, IntentEntryBody, SignedIntentEntry, IntentPaneModel } from "@lararium/mesh";
import { buildIntent, buildOutcome, faceRosterForIntents, intentEntryRecordsOfGroup, intentId, intentPaneModel, mayAct, readFace, readIntentPlane, writeIntentEntry } from "@lararium/mesh";
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
  readonly effects?: ReadonlyMap<string, (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string }) => Promise<unknown>>;
  readonly runDeclaredEffect?: (verb: string, args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string }) => Promise<unknown>;
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

export function makeFaceIntentDoor(ports: FaceIntentDoorPorts) {
  let running: Promise<void> | null = null, dirty = false;
  const read = async (): Promise<IntentView> => {
    const face = readFace(ports.kelChain, ports.anchor);
    if (!face) throw new Error("face-intent-door: no verified face lineage");
    const projection = face.project(ports.personaRecords(), ports.group);
    const standings = new Map<string, "stands" | "aside" | "unknown">();
    for (const atom of new Set([...projection.devices.map((d) => d.toLowerCase()), ...intentEntryRecordsOfGroup(ports.plane.doc(), ports.group).map((r) => String((r as { signer?: unknown })?.signer ?? "").toLowerCase())])) {
      if (atom) standings.set(atom, await ports.standing(atom));
    }
    return readIntentPlane({ group: ports.group, records: intentEntryRecordsOfGroup(ports.plane.doc(), ports.group),
      face: faceRosterForIntents(projection, face.lineage), standing: (atom) => standings.get(atom.toLowerCase()) ?? "unknown",
      ...(ports.holdsCapability ? { holdsCapability: ports.holdsCapability } : {}), verbs: ports.verbs });
  };
  const pass = async (): Promise<void> => {
    const view = await read();
    const raw = intentEntryRecordsOfGroup(ports.plane.doc(), ports.group) as SignedIntentEntry[];
    for (const state of view.intents) {
      if (!mayAct(view, state.id, ports.atom.key.toLowerCase()).act) continue;
      const effect = ports.effects?.get(state.verb) ?? (ports.runDeclaredEffect && state.class === "idempotent" ? (args: unknown, ctx: { intentId: string; intent: IntentEntryBody; pinnedAtom: string }) => ports.runDeclaredEffect!(state.verb, args, ctx) : undefined);
      if (!effect || !ports.verbs.classOfVerb(state.verb)) continue;
      const invocation = raw.find((r) => r?.body?.entry === "intent" && r.body.issuer === state.issuer &&
        intentId(r.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string }) === state.id);
      if (!invocation) continue;
      const pinnedAtom = state.audience.mode === "pinned" ? state.audience.atom : state.audience.mode === "asks" && state.answer && state.answer !== "contested"
        ? (state.answer.entry.body.executor as string | undefined) : undefined;
      if (state.class === "single-effect" && !pinnedAtom) continue;
      try {
        const result = await effect(invocation.body.args, { intentId: state.id, intent: invocation.body, pinnedAtom: pinnedAtom ?? ports.atom.key });
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
