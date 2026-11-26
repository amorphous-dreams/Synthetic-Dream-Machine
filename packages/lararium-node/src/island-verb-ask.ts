/**
 * island-verb-ask — the vessel's MAIN THREAD places one verb on its daemon island and awaits the answer.
 *
 * A person's command reaches an island verb through the verb socket, which commits a receipt and then awaits the
 * answer the island hands the vessel's answer ring (`control-home` `answerRingOf`). The main thread itself sometimes owes
 * the island a question that no person typed: the settle a fold sets off asks `seat-duties`, where a face's group keys
 * live. This module holds that one road: hand the invocation to the island over its direct channel, then read the
 * whole answer off the ring when it stands. The control document rests the verdict row alone, so an id whose answer
 * left the ring (a restart, the ring's bound) answers its verdict with an empty output, and a caller that needs the
 * body asks again under a fresh id.
 *
 * NO TIMER. The ask settles when the answer stands, or when its caller abandons it (the composition that asked
 * tears down). Nothing here measures a wait or decides by one.
 *
 * WHAT MAY RIDE THIS ROAD. A verb's arguments cross to the island and its answer waits in the vessel's memory; its
 * verdict row rests in the control document, clear at the floor and sealed under a lit face. Nothing a sealed row
 * holds rides here: a sealed row's act rides the custody door (`sealed-acts`).
 */
import { addCallTouches, currentCall, markCallUntracked, readCallTouches, type CallTouches } from "@lararium/mesh/call-touches";
import { islandAskRefusal, type EngineWatch } from "./engine-watch.js";
import { OUTCOME_URI_PREFIX, VERB_RESULT_KEY, newRequestId } from "@lararium/mesh/verb-tiddler";
import { signMemoryAsk, type MemoryAct } from "@lararium/mesh/memory-section";
import { signSeatDutiesAsk } from "@lararium/mesh/seat-duties";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import { answerRingOf } from "@lararium/mesh/control-home";

/** The island's direct channel, as the daemon VM hands it out. */
export type PlaceIslandVerb = (o: { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string }) => void;

/** An island verb that ended in an error, with the island's own words and, where it refused by name, that name. */
export class IslandVerbRefused extends Error {
  override readonly name = "IslandVerbRefused";
  constructor(readonly verb: string, message: string, readonly reason: string | null = null) { super(message); }
}

/** An ask whose caller left before the island answered. */
export class IslandAskAbandoned extends Error {
  override readonly name = "IslandAskAbandoned";
  constructor(readonly verb: string) { super(`the ask of "${verb}" ended with its composition, before the island answered`); }
}

export interface IslandAsk {
  /** The verb's own output, once its outcome lands as done. An error outcome rejects `IslandVerbRefused`. */
  readonly answer: Promise<Record<string, unknown>>;
  /** Stop waiting: `answer` rejects `IslandAskAbandoned`. The island may still finish the verb. */
  abandon(): void;
}

/**
 * The terminal outcome of one request, or null while none stands: the whole answer where the store's answer ring holds
 * it, else the row the control store rests. `placed` names an ask this call handed the island itself: the island lands
 * the verdict row a beat before the answer, so such an ask reads past a bare verdict and settles on the answer.
 */
async function outcomeOf(store: Pick<CompositeStore, "get">, requestId: string, placed: boolean): Promise<{ readonly status: "done" | "error"; readonly output: Record<string, unknown>; readonly errorMessage?: string; readonly refusal?: string; readonly touched: CallTouches | null } | null> {
  const held = answerRingOf(store).get(requestId);
  const record = held ?? await store.get(`${OUTCOME_URI_PREFIX}${requestId}`);
  if (!record || record.meta?.deleted) return null;
  const fields = record.tiddler as Record<string, unknown>;
  const status = fields["status"];
  if (status !== "done" && status !== "error") return null;
  if (held === null && placed && typeof fields["results"] !== "string") return null;
  let output: Record<string, unknown> = {};
  if (typeof fields["results"] === "string" && fields["results"].length > 0) {
    try {
      const summary = (JSON.parse(fields["results"]) as Record<string, { output?: unknown } | undefined>)?.[VERB_RESULT_KEY]?.output;
      if (summary && typeof summary === "object" && !Array.isArray(summary)) output = summary as Record<string, unknown>;
    } catch { /* an outcome whose results read as no JSON answers nothing */ }
  }
  return {
    status, output,
    ...(typeof fields["error-message"] === "string" ? { errorMessage: fields["error-message"] } : {}),
    ...(typeof fields["refusal"] === "string" ? { refusal: fields["refusal"] } : {}),
    touched: readCallTouches(fields["touched"]),
  };
}

/**
 * Place `verb` on the daemon island and await its outcome on the control store. `requestId` names this one
 * attempt: a fresh id runs the verb, and an id whose outcome already stands answers that outcome.
 */
export function askIslandVerb(opts: {
  /** The control store (`DaemonVmCore.control`): the control document the island writes each outcome into. */
  readonly control:      Pick<CompositeStore, "get" | "subscribe">;
  readonly placeVerb:    PlaceIslandVerb;
  readonly verb:         string;
  readonly args:         Record<string, unknown>;
  readonly requestedBy:  string;
  readonly requestId:    string;
  /** The isolate's engine watch the gate reads (`engine-watch`); absent, the isolate's own. */
  readonly engine?:      EngineWatch;
}): IslandAsk {
  // THE SOCKET'S GATES STAND ON THIS ROAD TOO (`islandAskRefusal`): the vessel's own watches ask here, past the socket.
  const gated = islandAskRefusal(opts.verb, opts.args, opts.engine);
  if (gated !== null) return { answer: Promise.reject(new IslandVerbRefused(opts.verb, gated.message, gated.refusal)), abandon: () => {} };
  let abandon: () => void = () => {};
  // THE SEAT'S CALL THIS ASK RIDES INSIDE (`call-touches`): the island's report folds into it; an outcome with none marks
  // the call untracked, so its door answers owed by name, never a bare ok.
  const call = currentCall();
  const fold = (touched: CallTouches | null): void => {
    if (call === undefined) return;
    if (touched === null) markCallUntracked(call, opts.verb);
    else addCallTouches(call, touched);
  };
  const answer = new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      unsubscribe();
      unsubscribeRing();
      fn();
    };
    let placed = false;
    const check = async (): Promise<void> => {
      const outcome = await outcomeOf(opts.control, opts.requestId, placed);
      if (!outcome) return;
      fold(outcome.touched);
      if (outcome.status === "done") settle(() => resolve(outcome.output));
      else settle(() => reject(new IslandVerbRefused(opts.verb, outcome.errorMessage ?? `${opts.verb} ended in an error`, outcome.refusal ?? null)));
    };
    const fault = (err: unknown): void => settle(() => reject(err instanceof Error ? err : new Error(String(err))));
    const title = `${OUTCOME_URI_PREFIX}${opts.requestId}`;
    const unsubscribe = opts.control.subscribe((change) => { if (change.title === title) void check().catch(fault); });
    // THE ANSWER STANDS IN THE RING: the ask hears it there, whether or not a verdict row lands beside it (a read lands none).
    const unsubscribeRing = answerRingOf(opts.control).subscribe((answered) => { if (answered === opts.requestId) void check().catch(fault); });
    abandon = () => settle(() => reject(new IslandAskAbandoned(opts.verb)));
    // An outcome that already stands answers with no placement; otherwise the verb goes to the island once.
    void check().then(() => {
      if (settled) return;
      placed = true;
      opts.placeVerb({ verb: opts.verb, args: opts.args, requestedBy: opts.requestedBy, requestId: opts.requestId });
    }, fault);
  });
  return { answer, abandon: () => abandon() };
}

/**
 * ASK THE ISLAND'S `seat-duties` VERB AS THE VESSEL. The verb answers its own vessel's main thread alone
 * (kapae#/what-the-code-holds): each ask carries the vessel key's signature over its own request id and the facts
 * it hands in, and this function holds the one place that signature gets made. Its two callers stand on the main
 * thread: the settle a fold sets off, and the store door's row for `lares edge settle`.
 */
export function askSeatDuties(opts: {
  readonly control:      Pick<CompositeStore, "get" | "subscribe">;
  readonly placeVerb:    PlaceIslandVerb;
  readonly facts:        { readonly fleetRoot: string; readonly acts: readonly unknown[]; readonly rolled: readonly string[] };
  /** The vessel's own key and its signer: the proof the island reads, and the requester it names. */
  readonly vesselKey:    string;
  readonly sign:         (bytes: Uint8Array) => Promise<string>;
  /**
   * Book this ask under the session seated now (`SessionSignBook.hold`), released once the ask settles. A roll the verb
   * leaves owed settles under that session's signer inside the same act, as a session's own seal would settle it; with
   * no session seated it books nothing and the roll stays owed for the next session act.
   */
  readonly hold?:        (requestId: string, verb: string) => () => void;
}): IslandAsk {
  const requestId = newRequestId();
  const release = opts.hold?.(requestId, "seat-duties") ?? (() => {});
  const facts = { fleetRoot: opts.facts.fleetRoot, acts: opts.facts.acts, rolled: opts.facts.rolled };
  let inner: IslandAsk | null = null;
  let abandoned = false;
  const answer = signSeatDutiesAsk({ requestId, facts, sign: opts.sign }).then((ask) => {
    if (abandoned) throw new IslandAskAbandoned("seat-duties");
    inner = askIslandVerb({
      control: opts.control, placeVerb: opts.placeVerb,
      verb: "seat-duties", args: { facts, ask }, requestedBy: `0x${opts.vesselKey}`, requestId,
    });
    return inner.answer;
  });
  void answer.then(release, release);
  return { answer, abandon: () => { abandoned = true; inner?.abandon(); release(); } };
}

/** The island verb each memory act names. */
const MEMORY_VERBS: Readonly<Record<MemoryAct, string>> = { cut: "sealed-memory-cut", door: "sealed-memory-door", import: "sealed-memory-import" };

/**
 * ASK ONE OF THE ISLAND'S THREE MEMORY VERBS AS THE VESSEL (custody#/the-bundle). Each answers its own vessel's
 * main thread alone: the ask carries the vessel key's signature over its own request id and the facts it hands in
 * (`signMemoryAsk`), and this function holds the one place that signature gets made. A cut hands in a public key
 * and draws ciphertext; a door draws a public key; an import hands in a section and its pair's secret half sealed
 * to that door. No bare content key rides this road in either direction, so an outcome that rests in the control
 * document names bags, versions and ciphertext alone.
 */
export function askIslandMemory(opts: {
  readonly control:      Pick<CompositeStore, "get" | "subscribe">;
  readonly placeVerb:    PlaceIslandVerb;
  readonly act:          MemoryAct;
  /** What the act hands in: `{ to }` for a cut, `{}` for a door, `{ section, secret }` for an import. */
  readonly facts:        Readonly<Record<string, unknown>>;
  readonly vesselKey:    string;
  readonly sign:         (bytes: Uint8Array) => Promise<string>;
}): IslandAsk {
  const requestId = newRequestId();
  const verb = MEMORY_VERBS[opts.act];
  let inner: IslandAsk | null = null;
  let abandoned = false;
  const answer = signMemoryAsk({ requestId, act: opts.act, facts: opts.facts, sign: opts.sign }).then((ask) => {
    if (abandoned) throw new IslandAskAbandoned(verb);
    inner = askIslandVerb({
      control: opts.control, placeVerb: opts.placeVerb,
      verb, args: { ...opts.facts, ask }, requestedBy: `0x${opts.vesselKey}`, requestId,
    });
    return inner.answer;
  });
  return { answer, abandon: () => { abandoned = true; inner?.abandon(); } };
}
