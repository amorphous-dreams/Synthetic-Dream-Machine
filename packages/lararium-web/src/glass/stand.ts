import { glassPortOpen, makeBootHandoff } from "@lararium/tw5/glass";
import type { GlassBootInputs, GlassBootNames, GlassDoor, GlassTransport } from "@lararium/tw5/glass";
import { sha256HexBytesSync } from "@lararium/mesh/crypto";
import type { ReturnTypeOfPagePort } from "./transport-type.js";
import { bootGlass } from "./boot.js";

type Seams = {
  /** A test's boot set in place of the port's handoff: the open then asks the island for no boot member. */
  readInputs?: (names: GlassBootNames) => Promise<GlassBootInputs>;
  attachShadow?: (host: HTMLElement) => ShadowRoot;
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record the mirror lands after its boot, with the width that landing serves, so a test can plant a capacity error in it. */
  landed?: (change: { title: string }, width: "skinny" | "full") => void };
type Evidence = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** What a standing mirror tells its caller after the first paint. */
export type MirrorEvent =
  | { type: "stepped"; width: "skinny"; why: string }
  | { type: "gone"; why: string }
  | { type: "floor"; why: string };
/** A state a caller can show while the mirror lights; no timer ends or raises one. */
export type MirrorState = { kind: "waiting"; for: "handoff" } | { kind: "evidence-unavailable"; why: string }
  | { kind: "write-refused"; title: string; reason: string };
/** How the boot ended: full stands, skinny held or stepped to, or the none floor. */
export type MirrorSettled = { width: "full" | "skinny" | "none"; why?: string };
/** The per-tab record, one per wiki: a full boot began and its first full paint has not happened. It records an event and never a width. */
export const MIRROR_EVIDENCE_KEY = "mirror:began";
export const mirrorEvidenceKey = (wikiUri: string): string => `${MIRROR_EVIDENCE_KEY}:${wikiUri}`;
/** The second per-tab record: a full page stands (written at full's first paint, cleared on `pagehide`). A boot that finds it knows the last full page ended without a leave: the jetsam shape. */
export const MIRROR_STANDING_KEY = "mirror:full-standing";
export const mirrorStandingKey = (wikiUri: string): string => `${MIRROR_STANDING_KEY}:${wikiUri}`;
const floor = (why: string) => ({ kind: "floor" as const, width: "none" as const, why });
const CAPACITY = ["RangeError", "QuotaExceededError"];
const capacity = (error: unknown): boolean => error instanceof Error &&
  (CAPACITY.includes(error.name) || CAPACITY.some(name => error.message.endsWith(`:${name}`)));
const reasonOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const tabStorage = (): Evidence | null => { try { return window.sessionStorage; } catch { return null; } };
type Fault = { why: string; capacity: boolean };

/**
 * Light the mirror, one real step at a time. Each step completes or names its floor, and no step reads a clock:
 *   L1 the shadow root;
 *   L2 the WHOLE HANDOFF: one `port:open` asks the vessel's island for its boot set and its records, and the page waits for the
 *      engine blob, every plugin blob and the first whole snapshot, each boot member verified against the name the vessel gave;
 *   L3 the engine boots from that store alone (the kernel, then `$tw.preloadTiddlers` carrying the boot set and the wiki's records);
 *   L4 the wiki's default story; L5 the paint.
 * The page reads no store of its own. The mirror opens FULL, the width a full-capability browser carries. A tab whose earlier full
 * boot left an evidence record opens skinny and says why. A caught capacity error takes the ONE step down to skinny (before the
 * engine stands: a fresh handoff at skinny; after: a fresh open on the same engine); a second one tears the mirror down to the
 * floor, and `port:gone` closes it. Nothing steps back up within the boot.
 */
export async function standMirror(options: {
  host: HTMLElement; port: ReturnTypeOfPagePort; inputs: GlassBootNames; wikiUri: string; actor: string;
  onState?: (state: MirrorState) => void; evidence?: Evidence;
  /** The surface's host doors (`doors.ts`); absent, every door ask refuses by name on the alert rail. */
  door?: GlassDoor;
}, seams: Seams = {}) {
  let shadowRoot: ShadowRoot;
  try { shadowRoot = options.host.shadowRoot ?? (seams.attachShadow?.(options.host) ?? options.host.attachShadow({ mode: "open" })); }
  catch { return floor("mirror-no-shadow-root"); }

  const evidence = options.evidence ?? tabStorage();
  const evidenceKey = mirrorEvidenceKey(options.wikiUri);
  let named = false;
  // A store that throws (blocked, full, denied) cannot hold the record, so the tab says so once and goes on; it never swallows the loss.
  const remember = (act: (store: Evidence) => void): void => {
    try { if (evidence) act(evidence); else throw Object.assign(new Error("no-session-storage"), { name: "NoSessionStorage" }); }
    catch (error) { if (!named) { named = true; options.onState?.({ kind: "evidence-unavailable", why: error instanceof Error ? error.name : "unavailable" }); } }
  };
  const standingKey = mirrorStandingKey(options.wikiUri);
  let held = false;
  let heldWhy = "full-boot-unfinished";
  remember(store => {
    if (store.getItem(evidenceKey) !== null) held = true;
    else if (store.getItem(standingKey) !== null) { held = true; heldWhy = "full-ended-without-pagehide"; }
  });

  let generation = 0;
  let width: "full" | "skinny" = held ? "skinny" : "full";
  let ended = false;
  let stood = false;
  let stepped = false;
  let stepReason = "";
  let gone = false;                    // a port:gone ends its generation: later messages do not step it
  let bootFault: Fault | null = null;  // a fault that landed while the boot ran: the boot reads it at its next step
  let bootWake: (() => void) | null = null;
  let settledAlready = false;
  let settle!: (outcome: MirrorSettled) => void;
  const settled = new Promise<MirrorSettled>(resolve => { settle = outcome => { if (settledAlready) return; settledAlready = true; resolve(outcome); }; });
  const listeners = new Set<(event: MirrorEvent) => void>();
  const emit = (event: MirrorEvent) => { for (const listener of listeners) listener(event); };
  let endedWhy = "";
  let mirror: Awaited<ReturnType<typeof bootGlass>> | null = null;
  let handed = { members: 0, records: 0 };

  // The standing record follows the page's own leave: `pagehide` clears it, a back-forward restore (`pageshow` persisted) writes it again.
  let standingOn = false;
  const onHide = (): void => { remember(store => store.removeItem(standingKey)); };
  const onShow = (event: Event): void => { if ((event as PageTransitionEvent).persisted && standingOn && !ended) remember(store => store.setItem(standingKey, crypto.randomUUID())); };
  const standing = (on: boolean): void => {
    if (on === standingOn) return;
    standingOn = on;
    if (on) { remember(store => store.setItem(standingKey, crypto.randomUUID())); window.addEventListener("pagehide", onHide); window.addEventListener("pageshow", onShow); }
    else { remember(store => store.removeItem(standingKey)); window.removeEventListener("pagehide", onHide); window.removeEventListener("pageshow", onShow); }
  };
  const end = (event: MirrorEvent & { why: string }) => { if (ended) return; ended = true; standing(false); endedWhy = event.why; mirror?.unmount(); settle({ width: "none", why: event.why }); emit(event); };
  /** The one step down of a standing mirror: a fresh skinny open on the same engine. A failure at skinny, or a second one, reads the none floor. */
  const stepDown = (why: string) => {
    if (ended || gone) return;
    if (stepped || width === "skinny") { end({ type: "floor", why }); return; }
    stepped = true; stepReason = why; width = "skinny"; generation += 1; standing(false);
    mirror!.reopen({ transport: transportFor(generation), portId: crypto.randomUUID(), width: "skinny" });
    emit({ type: "stepped", width: "skinny", why });
  };
  const fault = (why: string, kind: "capacity" | "gone"): void => {
    if (!stood) { bootFault ??= { why, capacity: kind === "capacity" }; bootWake?.(); return; }
    if (kind === "gone") end({ type: "gone", why }); else stepDown(why);
  };
  const transportFor = (mine: number): GlassTransport => {
    let own: string | null = null;     // the port this generation opened: another port's messages are not its own
    return {
    send(message) {
      if (message.type === "port:open") own = String(message.portId);
      // A closed generation still closes its own port; every other message from it dies.
      if (mine !== generation && message.type !== "port:close") return { ok: false, reason: "transport-closed" };
      return options.port.send(message);
    },
    onMessage(listener) {
      return options.port.onMessage(message => {
        if (mine !== generation || ended || !message.type.startsWith("port:")) return;
        if (gone || (own !== null && (message as { portId?: unknown }).portId !== own)) return;
        if (message.type === "port:gone") {
          gone = true;
          fault(String((message as { reason?: unknown }).reason ?? "port-gone"), "gone");
          return;
        }
        try { listener(message as unknown as Parameters<typeof listener>[0]); }
        catch (error) { if (capacity(error)) { fault(`mirror-snapshot-refused:${(error as Error).name}`, "capacity"); return; } throw error; }
      });
    },
    };
  };
  const { landed: probe, readInputs, ...mirrorSeams } = seams;   // the probe takes the width too; the door's seam takes the change alone
  const refused = (result: { title: string; reason: string }): void => options.onState?.({ kind: "write-refused", title: result.title, reason: result.reason });
  const landed = probe ? (change: { title: string }) => probe(change, width) : undefined;

  /** One whole boot at one width: the handoff off the port, then the engine from that store. Null when the mirror stands unpainted. */
  const bootOnce = async (at: "full" | "skinny"): Promise<Fault | null> => {
    const mine = ++generation;
    bootFault = null;
    const portId = crypto.randomUUID();
    const transport = transportFor(mine);
    const hand = makeBootHandoff(readInputs ? null : options.inputs, portId, sha256HexBytesSync);
    let forward: Parameters<GlassTransport["onMessage"]>[0] | null = null;
    let whole = false;
    const arrived = new Promise<void>(resolve => { bootWake = resolve; });
    const off = transport.onMessage(message => {
      if (forward) { forward(message); return; }
      if (hand.take(message) && !whole) { whole = true; bootWake?.(); }
    });
    const quit = (failure: Fault): Fault => { off(); if (mine === generation) transport.send({ type: "port:close", portId }); return failure; };
    const sent = transport.send(glassPortOpen({ portId, wikiUri: options.wikiUri, actor: options.actor, width: at }, !readInputs)) as { ok: boolean; reason?: string };
    if (!sent.ok) return quit({ why: sent.reason ?? "port-refused", capacity: false });
    options.onState?.({ kind: "waiting", for: "handoff" });
    await arrived;
    if (bootFault) return quit(bootFault);
    let inputs: GlassBootInputs;
    try { inputs = readInputs ? await readInputs(options.inputs) : hand.inputs(); }
    catch (error) { return quit({ why: reasonOf(error), capacity: capacity(error) }); }
    if (bootFault) return quit(bootFault);
    const facade: GlassTransport = {
      send: message => transport.send(message),
      // The adaptor takes the road once the engine stands: what arrived while it booted reaches it first, in order.
      onMessage(listener) { forward = listener; for (const message of hand.later()) listener(message); return () => { forward = null; off(); }; },
    };
    try {
      mirror = await bootGlass({ shadowRoot, inputs, port: options.port, wikiUri: options.wikiUri, actor: options.actor, width: at, transport: facade,
        portId, opened: { records: hand.records() }, ...(options.door ? { door: options.door } : {}), seams: { ...mirrorSeams, ...(landed ? { landed } : {}), refused }, deferPaint: true });
    } catch (error) { return quit({ why: reasonOf(error), capacity: capacity(error) }); }
    if (bootFault || ended) { const failure = bootFault ?? { why: endedWhy, capacity: false }; mirror.unmount(); mirror = null; return failure; }
    handed = { members: hand.members(), records: hand.records().length };
    return null;
  };

  // The record stands from the moment a full boot begins until full has painted: a boot that dies between leaves it behind.
  if (!held) remember(store => store.setItem(evidenceKey, crypto.randomUUID()));
  let failure = await bootOnce(width);
  if (failure?.capacity && width === "full" && !gone) {
    // THE ONE STEP, before any engine stood: a fresh handoff at skinny.
    stepped = true; stepReason = failure.why; width = "skinny";
    emit({ type: "stepped", width: "skinny", why: failure.why });
    failure = await bootOnce("skinny");
  }
  if (failure) return floor(failure.why);
  try {
    // The handoff landed whole: the wiki's own landing stands in the engine, so the story opens now and the first paint reads it.
    mirror!.openStory();
    mirror!.paint();
  } catch (error) { mirror!.unmount(); return floor(reasonOf(error)); }
  stood = true;
  if (width === "full") {
    settle({ width: "full" });
    // The record clears after a page frame has run over the painted full tree, not when the paint returns: a death between the two leaves it.
    const paintedIn = generation;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ended || paintedIn !== generation || width !== "full") return;
      remember(store => store.removeItem(evidenceKey));
      standing(true);
    }));
  } else settle({ width: "skinny", why: stepped ? stepReason : heldWhy });
  return {
    kind: "mirror" as const,
    get width() { return width; },
    settled,
    /** What the port handed before the engine stood: the boot members it carried whole, and the records in the store at boot. */
    get handed() { return handed; },
    /** The mirror's engine, for the page's own reads (its goldens, its tooling); the person's edits cross the port, never this handle. */
    get tw() { return mirror!.tw; },
    /** How many writes the mirror sent and holds no answer for: the page holds its leave while this reads above zero. */
    pending: () => (ended ? 0 : mirror!.adaptor.pendingWrites().length),
    /** True while no write stands unanswered and no edit waits behind one: a test reads it to know the port has gone still. */
    writesSent: () => (ended ? 0 : mirror!.adaptor.writesSent()),
    quiescent: () => (ended ? true : mirror!.adaptor.quiescent()),
    /** Send every unanswered write again under its own txId: the road to a new leader re-opened. An island that saw the txId applies it once; a vessel the hand-off re-opened holds a fresh ledger (named in the kit, owed to D4). */
    resendPending() { if (!ended) mirror!.adaptor.resendPending(); },
    unmount() { if (!ended) { ended = true; standing(false); mirror!.unmount(); settle({ width: "none", why: "unmounted" }); } },
    onEvent(listener: (event: MirrorEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
