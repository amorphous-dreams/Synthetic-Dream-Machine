import type { GlassTransport } from "@lararium/tw5/glass";
import type { ReturnTypeOfPagePort } from "./transport-type.js";
import { bootGlass } from "./boot.js";
import type { readGlassBootInputs } from "./cas.js";

type Inputs = { coreCid: string; pluginCids: readonly string[] };
type Seams = { readInputs?: typeof readGlassBootInputs; attachShadow?: (host: HTMLElement) => ShadowRoot;
  bootEngine?: () => void | Promise<void>; paint?: () => void;
  /** Runs on each record the mirror lands, so a test can plant a capacity error in the landing path. */
  landed?: (change: { title: string }) => void };
/** What a standing mirror tells its caller after the first paint. */
export type MirrorEvent =
  | { type: "stepped"; width: "skinny"; why: string }
  | { type: "gone"; why: string }
  | { type: "floor"; why: string };
const floor = (why: string) => ({ kind: "floor" as const, width: "none" as const, why });
const capacity = (error: unknown): boolean => error instanceof Error && (error.name === "RangeError" || error.name === "QuotaExceededError");
const reasonOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

/**
 * Light the mirror cap, one real step at a time. Each step completes or names its floor, and no step reads a clock:
 * L1 shadow root, L2 CAS read, L3 engine boot, L4 the port's first snapshot (the greeting decides), L5 paint.
 * The mirror opens full. After it stands, a caught capacity error steps it down to skinny once on the same
 * engine, a second one unmounts it, and `port:gone` closes it; nothing steps back up within the boot.
 */
export async function standMirror(options: {
  host: HTMLElement; port: ReturnTypeOfPagePort; inputs: Inputs; wikiUri: string; actor: string;
}, seams: Seams = {}) {
  let shadowRoot: ShadowRoot;
  try { shadowRoot = options.host.shadowRoot ?? (seams.attachShadow?.(options.host) ?? options.host.attachShadow({ mode: "open" })); }
  catch { return floor("mirror-no-shadow-root"); }
  let inputs: Awaited<ReturnType<typeof readGlassBootInputs>>;
  try { inputs = await (seams.readInputs ?? (await import("./cas.js")).readGlassBootInputs)(options.inputs); }
  catch (error) { return floor(reasonOf(error)); }

  let generation = 0;
  let width: "full" | "skinny" = "full";
  let ended = false;
  let stepped = false;
  let greeted = false;
  let gone = false;                    // a port:gone ends its generation: later messages do not step it
  const chunks = new Map<string, number>();
  let greeting!: (reason: string | null | "stepped") => void;
  const nextGreeting = () => new Promise<string | null | "stepped">(resolve => { greeting = resolve; });
  let waiting = nextGreeting();
  const listeners = new Set<(event: MirrorEvent) => void>();
  const emit = (event: MirrorEvent) => { for (const listener of listeners) listener(event); };
  let early: string | null = null;     // a capacity error that landed before the door returned
  let mirror: Awaited<ReturnType<typeof bootGlass>> | null = null;

  const end = (event: MirrorEvent) => { if (ended) return; ended = true; mirror?.unmount(); emit(event); };
  const stepDown = (why: string) => {
    if (ended || gone) return;
    if (!mirror) { early = why; return; }
    if (stepped) { greeting(why); end({ type: "floor", why }); return; }
    stepped = true; width = "skinny"; generation += 1;
    greeted = false; chunks.clear();
    const previous = greeting;
    waiting = nextGreeting();
    mirror.reopen({ transport: transportFor(generation), portId: crypto.randomUUID(), width: "skinny" });
    previous("stepped");
    emit({ type: "stepped", width: "skinny", why });
  };
  const transportFor = (mine: number): GlassTransport => ({
    send(message) {
      // A closed generation still closes its own port; every other message from it dies.
      if (mine !== generation && message.type !== "port:close") return { ok: false, reason: "transport-closed" };
      const result = options.port.send(message) as { ok: boolean; reason?: string };
      if (message.type === "port:open" && !result.ok) greeting(result.reason ?? "port-refused");
      return result;
    },
    onMessage(listener) {
      return options.port.onMessage(message => {
        if (mine !== generation || ended || !message.type.startsWith("port:")) return;
        if (gone) return;
        if (message.type === "port:gone") {
          gone = true;
          const why = String((message as { reason?: unknown }).reason ?? "port-gone");
          if (greeted) { end({ type: "gone", why }); return; }
          greeting(why); return;
        }
        try { listener(message as unknown as Parameters<typeof listener>[0]); }
        catch (error) { if (capacity(error)) { stepDown(`mirror-snapshot-refused:${(error as Error).name}`); return; } throw error; }
        // The greeting completes when the whole snapshot has landed, not its first chunk.
        if (message.type === "port:snapshot") {
          const { snapshotId, n } = message as unknown as { snapshotId: string; n: number };
          const seen = (chunks.get(snapshotId) ?? 0) + 1;
          chunks.set(snapshotId, seen);
          if (seen >= n) { chunks.delete(snapshotId); greeted = true; greeting(null); }
        }
      });
    },
  });

  try {
    mirror = await bootGlass({ ...options, shadowRoot, inputs, width: "full", transport: transportFor(0), seams, deferPaint: true });
    if (early !== null) stepDown(early);
    let reason = await waiting;
    while (reason === "stepped") reason = await waiting;
    if (reason !== null) { mirror.unmount(); return floor(reason); }
    mirror.paint();
  } catch (error) { mirror?.unmount(); return floor(reasonOf(error)); }
  return {
    kind: "mirror" as const,
    get width() { return width; },
    unmount() { if (!ended) { ended = true; mirror!.unmount(); } },
    onEvent(listener: (event: MirrorEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
