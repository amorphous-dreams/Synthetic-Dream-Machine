import type { GlassTransport } from "@lararium/tw5/glass";
import type { ReturnTypeOfPagePort } from "./transport-type.js";
import { bootGlass } from "./boot.js";
import type { readGlassBootInputs } from "./cas.js";

type Inputs = { coreCid: string; pluginCids: readonly string[] };
type Seams = { readInputs?: typeof readGlassBootInputs; attachShadow?: (host: HTMLElement) => ShadowRoot;
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record the mirror lands, with the width that landing serves, so a test can plant a capacity error in it. */
  landed?: (change: { title: string }, width: "skinny" | "full") => void };
type Evidence = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** What a standing mirror tells its caller after the first paint. */
export type MirrorEvent =
  | { type: "promoted"; width: "full" }
  | { type: "stepped"; width: "skinny"; why: string }
  | { type: "gone"; why: string }
  | { type: "floor"; why: string };
/** A state a caller can show while the mirror lights; no timer ends or raises one. */
export type MirrorState = { kind: "waiting"; for: "greeting" } | { kind: "evidence-unavailable"; why: string };
/** How the boot's promotion ended: full landed, skinny held or stepped to, or the none floor. */
export type MirrorSettled = { width: "full" | "skinny" | "none"; why?: string };
/** The per-tab record, one per wiki: a promotion to full began and its first full paint has not happened. It records an event and never a width. */
export const MIRROR_EVIDENCE_KEY = "mirror:began";
export const mirrorEvidenceKey = (wikiUri: string): string => `${MIRROR_EVIDENCE_KEY}:${wikiUri}`;
const floor = (why: string) => ({ kind: "floor" as const, width: "none" as const, why });
const capacity = (error: unknown): boolean => error instanceof Error && (error.name === "RangeError" || error.name === "QuotaExceededError");
const reasonOf = (error: unknown): string => error instanceof Error ? error.message : String(error);
const tabStorage = (): Evidence | null => { try { return window.sessionStorage; } catch { return null; } };

/**
 * Light the mirror cap, one real step at a time. Each step completes or names its floor, and no step reads a clock:
 * L1 shadow root, L2 CAS read, L3 engine boot, L4 the port's first snapshot (the greeting decides), L5 paint.
 * The mirror opens skinny and paints; it then promotes to full by one widen row on the same port. A tab whose
 * earlier full boot left its evidence record stays at skinny. After it stands, a caught capacity error steps it
 * down to skinny once on the same engine, a second one unmounts it, and `port:gone` closes it; nothing steps
 * back up within the boot but the one promotion.
 */
export async function standMirror(options: {
  host: HTMLElement; port: ReturnTypeOfPagePort; inputs: Inputs; wikiUri: string; actor: string;
  onState?: (state: MirrorState) => void; evidence?: Evidence;
}, seams: Seams = {}) {
  let shadowRoot: ShadowRoot;
  try { shadowRoot = options.host.shadowRoot ?? (seams.attachShadow?.(options.host) ?? options.host.attachShadow({ mode: "open" })); }
  catch { return floor("mirror-no-shadow-root"); }
  let inputs: Awaited<ReturnType<typeof readGlassBootInputs>>;
  try { inputs = await (seams.readInputs ?? (await import("./cas.js")).readGlassBootInputs)(options.inputs); }
  catch (error) { return floor(reasonOf(error)); }

  const evidence = options.evidence ?? tabStorage();
  const evidenceKey = mirrorEvidenceKey(options.wikiUri);
  let named = false;
  // A store that throws (blocked, full, denied) cannot hold the record, so the tab says so once and goes on; it never swallows the loss.
  const remember = (act: (store: Evidence) => void): void => {
    try { if (evidence) act(evidence); else throw Object.assign(new Error("no-session-storage"), { name: "NoSessionStorage" }); }
    catch (error) { if (!named) { named = true; options.onState?.({ kind: "evidence-unavailable", why: error instanceof Error ? error.name : "unavailable" }); } }
  };
  let held = false;
  remember(store => { held = store.getItem(evidenceKey) !== null; });

  let generation = 0;
  let width: "full" | "skinny" = "skinny";
  let promoting = false;
  let ended = false;
  let stepped = false;
  let stepReason = "";
  let greeted = false;
  let gone = false;                    // a port:gone ends its generation: later messages do not step it
  let settledAlready = false;
  let settle!: (outcome: MirrorSettled) => void;
  const settled = new Promise<MirrorSettled>(resolve => { settle = outcome => { if (settledAlready) return; settledAlready = true; resolve(outcome); }; });
  const chunks = new Map<string, number>();
  let greeting!: (reason: string | null) => void;
  const waiting = new Promise<string | null>(resolve => { greeting = resolve; });
  const listeners = new Set<(event: MirrorEvent) => void>();
  const emit = (event: MirrorEvent) => { for (const listener of listeners) listener(event); };
  let endedWhy = "";
  let early: string | null = null;     // a capacity error that landed before the door returned
  let mirror: Awaited<ReturnType<typeof bootGlass>> | null = null;

  const end = (event: MirrorEvent & { why: string }) => { if (ended) return; ended = true; endedWhy = event.why; mirror?.unmount(); settle({ width: "none", why: event.why }); emit(event); };
  const stepDown = (why: string) => {
    if (ended || gone) return;
    if (!mirror) { early = why; return; }
    // Skinny is the lowest width the mirror holds: a failure there, or after the one step, reads the none floor.
    if (stepped || (!promoting && width === "skinny")) { greeting(why); end({ type: "floor", why }); return; }
    stepped = true; stepReason = why; width = "skinny"; promoting = false; generation += 1;
    chunks.clear();
    mirror.reopen({ transport: transportFor(generation), portId: crypto.randomUUID(), width: "skinny" });
    emit({ type: "stepped", width: "skinny", why });
  };
  const transportFor = (mine: number): GlassTransport => {
    let own: string | null = null;     // the port this generation opened: another port's messages are not its own
    return {
    send(message) {
      if (message.type === "port:open") own = String(message.portId);
      // A closed generation still closes its own port; every other message from it dies.
      if (mine !== generation && message.type !== "port:close") return { ok: false, reason: "transport-closed" };
      const result = options.port.send(message) as { ok: boolean; reason?: string };
      if (message.type === "port:open") {
        if (result.ok) options.onState?.({ kind: "waiting", for: "greeting" });
        else greeting(result.reason ?? "port-refused");
      }
      return result;
    },
    onMessage(listener) {
      return options.port.onMessage(message => {
        if (mine !== generation || ended || !message.type.startsWith("port:")) return;
        if (gone || (own !== null && (message as { portId?: unknown }).portId !== own)) return;
        if (message.type === "port:gone") {
          gone = true;
          const why = String((message as { reason?: unknown }).reason ?? "port-gone");
          if (greeted) { end({ type: "gone", why }); return; }
          greeting(why); return;
        }
        try { listener(message as unknown as Parameters<typeof listener>[0]); }
        catch (error) { if (capacity(error)) { stepDown(`mirror-snapshot-refused:${(error as Error).name}`); return; } throw error; }
        // A snapshot completes when its last chunk lands, not its first.
        if (message.type === "port:snapshot") {
          const { snapshotId, n } = message as unknown as { snapshotId: string; n: number };
          const seen = (chunks.get(snapshotId) ?? 0) + 1;
          chunks.set(snapshotId, seen);
          if (seen < n) return;
          chunks.delete(snapshotId);
          if (!greeted) { greeted = true; greeting(null); }
          else if (promoting) {
            promoting = false; width = "full";
            settle({ width: "full" }); emit({ type: "promoted", width: "full" });
            // The record clears after a page frame has run over the landed full tree, not when its snapshot lands: a death between the two leaves it.
            // The frame acknowledges a refreshed tree; whether the host shows is the page's affair.
            const landedIn = mine;
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (!ended && landedIn === generation && width === "full") remember(store => store.removeItem(evidenceKey));
            }));
          } else if (stepped) settle({ width: "skinny", why: stepReason });
        }
      });
    },
    };
  };
  const { landed: probe, ...mirrorSeams } = seams;   // the probe takes the width too; the door's seam takes the change alone
  const landed = probe ? (change: { title: string }) => probe(change, promoting || width === "full" ? "full" : "skinny") : undefined;

  try {
    mirror = await bootGlass({ ...options, shadowRoot, inputs, width: "skinny", transport: transportFor(0),
      seams: { ...mirrorSeams, ...(landed ? { landed } : {}) }, deferPaint: true });
    if (ended) { mirror.unmount(); return floor(endedWhy); }   // a port:gone landed before the door returned
    if (early !== null) stepDown(early);
    const reason = await waiting;
    if (reason !== null) { mirror.unmount(); return floor(reason); }
    mirror.paint();
  } catch (error) { mirror?.unmount(); return floor(reasonOf(error)); }

  if (held) settle({ width: "skinny", why: "full-promotion-unfinished" });
  else {
    // The record stands from the moment full begins until full has landed: a boot that dies between leaves it behind.
    remember(store => store.setItem(evidenceKey, crypto.randomUUID()));
    promoting = true;
    const sent = mirror.adaptor.widen("full") as { ok?: boolean; reason?: string } | undefined;
    if (sent && sent.ok === false) {
      // The widen never reached the island: the tab stays at skinny and says why; nothing began, so no record stands.
      promoting = false; remember(store => store.removeItem(evidenceKey));
      settle({ width: "skinny", why: sent.reason ?? "widen-refused" });
    }
  }
  return {
    kind: "mirror" as const,
    get width() { return width; },
    settled,
    unmount() { if (!ended) { ended = true; mirror!.unmount(); settle({ width: "none", why: "unmounted" }); } },
    onEvent(listener: (event: MirrorEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
