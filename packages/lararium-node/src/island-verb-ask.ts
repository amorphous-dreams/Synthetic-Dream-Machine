/**
 * island-verb-ask — the vessel's MAIN THREAD places one verb on its daemon island and awaits the answer.
 *
 * A person's command reaches an island verb through the verb socket, which commits a receipt and then awaits the
 * outcome the island writes into the daemon's document. The main thread itself sometimes owes the island a
 * question that no person typed: the settle a fold sets off asks `seat-duties`, where a face's group keys live.
 * This module holds that one road: hand the invocation to the island over its direct channel, then read the
 * outcome off the daemon's document when it lands.
 *
 * NO TIMER. The ask settles when the outcome lands, or when its caller abandons it (the composition that asked
 * tears down). Nothing here measures a wait or decides by one.
 *
 * WHAT MAY RIDE THIS ROAD. A verb's arguments cross to the island and its outcome rests in the daemon's document
 * in the clear, so nothing a sealed row holds rides here: a sealed row's act rides the custody door
 * (`sealed-acts`).
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { AutomergeDocStore, DAEMON_BAG_ID, OUTCOME_URI_PREFIX, VERB_RESULT_KEY, newRequestId, signSeatDutiesAsk, type LarDoc } from "@lararium/mesh";

/** The island's direct channel, as the daemon VM hands it out. */
export type PlaceIslandVerb = (o: { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string }) => void;

/** An island verb that ended in an error, with the island's own words. */
export class IslandVerbRefused extends Error {
  override readonly name = "IslandVerbRefused";
  constructor(readonly verb: string, message: string) { super(message); }
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

/** The terminal outcome of one request, read through the daemon document's own store door, or null while none stands. */
async function outcomeOf(store: AutomergeDocStore, requestId: string): Promise<{ readonly status: "done" | "error"; readonly output: Record<string, unknown>; readonly errorMessage?: string } | null> {
  const record = await store.get(`${OUTCOME_URI_PREFIX}${requestId}`);
  if (!record || record.meta?.deleted) return null;
  const fields = record.tiddler as Record<string, unknown>;
  const status = fields["status"];
  if (status !== "done" && status !== "error") return null;
  let output: Record<string, unknown> = {};
  if (typeof fields["results"] === "string" && fields["results"].length > 0) {
    try {
      const summary = (JSON.parse(fields["results"]) as Record<string, { output?: unknown } | undefined>)?.[VERB_RESULT_KEY]?.output;
      if (summary && typeof summary === "object" && !Array.isArray(summary)) output = summary as Record<string, unknown>;
    } catch { /* an outcome whose results read as no JSON answers nothing */ }
  }
  return { status, output, ...(typeof fields["error-message"] === "string" ? { errorMessage: fields["error-message"] } : {}) };
}

/** One store door per daemon document for this process's life: a door follows its document, so asks share it. */
const DOORS = new WeakMap<DocHandle<LarDoc>, AutomergeDocStore>();
function storeOver(handle: DocHandle<LarDoc>): AutomergeDocStore {
  let door = DOORS.get(handle);
  if (!door) { door = new AutomergeDocStore(handle as never, DAEMON_BAG_ID); DOORS.set(handle, door); }
  return door;
}

/**
 * Place `verb` on the daemon island and await its outcome on the daemon's document. `requestId` names this one
 * attempt: a fresh id runs the verb, and an id whose outcome already stands answers that outcome.
 */
export function askIslandVerb(opts: {
  readonly daemonHandle: DocHandle<LarDoc>;
  readonly placeVerb:    PlaceIslandVerb;
  readonly verb:         string;
  readonly args:         Record<string, unknown>;
  readonly requestedBy:  string;
  readonly requestId:    string;
}): IslandAsk {
  let abandon: () => void = () => {};
  const store = storeOver(opts.daemonHandle);
  const answer = new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      opts.daemonHandle.off("change", onChange);
      fn();
    };
    const check = async (): Promise<void> => {
      const outcome = await outcomeOf(store, opts.requestId);
      if (!outcome) return;
      if (outcome.status === "done") settle(() => resolve(outcome.output));
      else settle(() => reject(new IslandVerbRefused(opts.verb, outcome.errorMessage ?? `${opts.verb} ended in an error`)));
    };
    const fault = (err: unknown): void => settle(() => reject(err instanceof Error ? err : new Error(String(err))));
    function onChange(): void { void check().catch(fault); }
    abandon = () => settle(() => reject(new IslandAskAbandoned(opts.verb)));
    opts.daemonHandle.on("change", onChange);
    // An outcome that already stands answers with no placement; otherwise the verb goes to the island once.
    void check().then(() => {
      if (!settled) opts.placeVerb({ verb: opts.verb, args: opts.args, requestedBy: opts.requestedBy, requestId: opts.requestId });
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
  readonly daemonHandle: DocHandle<LarDoc>;
  readonly placeVerb:    PlaceIslandVerb;
  readonly facts:        { readonly fleetRoot: string; readonly acts: readonly unknown[]; readonly rolled: readonly string[] };
  /** The vessel's own key and its signer: the proof the island reads, and the requester it names. */
  readonly vesselKey:    string;
  readonly sign:         (bytes: Uint8Array) => Promise<string>;
}): IslandAsk {
  const requestId = newRequestId();
  const facts = { fleetRoot: opts.facts.fleetRoot, acts: opts.facts.acts, rolled: opts.facts.rolled };
  let inner: IslandAsk | null = null;
  let abandoned = false;
  const answer = signSeatDutiesAsk({ requestId, facts, sign: opts.sign }).then((ask) => {
    if (abandoned) throw new IslandAskAbandoned("seat-duties");
    inner = askIslandVerb({
      daemonHandle: opts.daemonHandle, placeVerb: opts.placeVerb,
      verb: "seat-duties", args: { facts, ask }, requestedBy: `0x${opts.vesselKey}`, requestId,
    });
    return inner.answer;
  });
  return { answer, abandon: () => { abandoned = true; inner?.abandon(); } };
}
