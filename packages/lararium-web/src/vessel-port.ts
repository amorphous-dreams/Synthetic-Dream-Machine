/**
 * vessel-port — the page's one road to the vessel worker (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-shape).
 *
 * The page builds the vessel worker and talks to it here alone: it hands the boot's public inputs over, feeds its life
 * signals and the person's events in, and takes phases, frames, port traffic, asks and public status readings back. The
 * messages read in `vessel-protocol.ts`. Nothing here holds a key, a store or a ceremony.
 */
import type { BrowserConnectionListener, BrowserConnectionSnapshot, HearthFloorRead, PageLife, ProjectionSurfaceFrame } from "@lararium/browser/page";
import type { LarMsg_ControlEvent, LarMsg_ControlResult } from "@lararium/mesh";
import type { PortTransportDoors } from "./port-transport.js";
import type {
  JoinAnswerReply, JoinOfferReply, PageToVessel, VesselAskQuestion, VesselBoot, VesselError, VesselStatus, VesselToPage,
} from "./vessel-protocol.js";

/** The worker's side the page reads: a message road, and the platform's own termination. */
export interface VesselWorkerLike {
  postMessage(msg: PageToVessel, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
  addEventListener(type: "error", listener: (e: Event) => void): void;
  terminate(): void;
}

/** A refusal the vessel named, carried back across the port. */
export class VesselRefused extends Error {
  readonly refusal: string | undefined;
  constructor(error: VesselError) {
    super(error.message);
    this.name = error.name;
    this.refusal = error.refusal;
  }
}

export interface VesselPortHandlers {
  onPhase?(phase: string): void;
  onFrame?(frame: ProjectionSurfaceFrame): void;
  onControlResult?(surface: string, result: LarMsg_ControlResult): void;
  onPortMessage?(binding: string, islandKey: string, msg: unknown): void;
  onStatus?(status: VesselStatus): void;
  /** The vessel asks the person: the answer travels back on this port (interim; slice 1b moves it to the ceremony document). */
  onAsk?(question: VesselAskQuestion, act: string): Promise<unknown>;
  onEnded?(why: string, stage: "custody" | "open"): void;
  /** The holder's SharedWorker, built on the page because a dedicated worker cannot build one. */
  spawnHolder?(url: string, name: string): { readonly port: MessagePort; onError(listener: () => void): void } | null;
}

export function standVesselPort(worker: VesselWorkerLike, handlers: VesselPortHandlers) {
  const calls = new Map<string, { resolve(v: unknown): void; reject(e: unknown): void }>();
  let connection: BrowserConnectionSnapshot | null = null;
  const connectionListeners = new Set<BrowserConnectionListener>();
  const post = (msg: PageToVessel, transfer: Transferable[] = []): void => worker.postMessage(msg, transfer);
  const call = <T>(make: (callId: string) => PageToVessel): Promise<T> => new Promise<T>((resolve, reject) => {
    const callId = crypto.randomUUID();
    calls.set(callId, { resolve: resolve as (v: unknown) => void, reject });
    post(make(callId));
  });

  worker.addEventListener("message", (e: MessageEvent) => {
    const msg = e.data as VesselToPage;
    switch (msg.t) {
      case "phase": handlers.onPhase?.(msg.phase); return;
      case "frame": handlers.onFrame?.(msg.frame); return;
      case "control-result": handlers.onControlResult?.(msg.surface, msg.result); return;
      case "coherence": return;
      case "port-msg": handlers.onPortMessage?.(msg.binding, msg.islandKey, msg.msg); return;
      case "port:refused":
        // A placement the vessel refused reads as the transport's own refusal would have, and a refused open as its port gone.
        handlers.onPortMessage?.(msg.binding, "", { type: "transport:refused", reason: msg.reason, binding: msg.binding });
        if (msg.opening && msg.portId) handlers.onPortMessage?.(msg.binding, "", { type: "port:gone", portId: msg.portId, reason: msg.reason, binding: msg.binding });
        return;
      case "ask":
        void (handlers.onAsk?.(msg.question, msg.act) ?? Promise.resolve(null)).then((answer) => post({ t: "answer", askId: msg.askId, answer: answer as never }));
        return;
      case "status":
        if (msg.status.connection) { connection = msg.status.connection; for (const l of connectionListeners) l(connection); }
        handlers.onStatus?.(msg.status);
        return;
      case "reply": {
        const pending = calls.get(msg.callId);
        calls.delete(msg.callId);
        if (!pending) return;
        if (msg.ok) pending.resolve(msg.value); else pending.reject(new VesselRefused(msg.error));
        return;
      }
      case "spawn": {
        const built = handlers.spawnHolder?.(msg.url, msg.name) ?? null;
        if (!built) { post({ t: "spawned", spawnId: msg.spawnId, refused: "this page builds no SharedWorker" }); return; }
        built.onError(() => post({ t: "spawned", spawnId: msg.spawnId, refused: "the shared holder worker raised an error" }));
        post({ t: "spawned", spawnId: msg.spawnId, port: built.port }, [built.port]);
        return;
      }
      case "ended": handlers.onEnded?.(msg.why, msg.stage); return;
    }
  });
  worker.addEventListener("error", (e: Event) => handlers.onEnded?.(`the vessel worker failed: ${(e as ErrorEvent).message ?? "error"}`, "open"));

  return {
    hello(boot: VesselBoot): void { post({ t: "hello", tabSession: crypto.randomUUID(), boot }); },
    pageLife(life: PageLife): void { post({ t: "page:life", life }); },
    sendControlEvent(surface: string, ev: LarMsg_ControlEvent): void { post({ t: "control-event", surface, ev }); },
    setActiveSurface(surface: string): void { post({ t: "set-surface", surface }); },
    /** The mirror's port road: a placement crosses at once, and a refusal returns as the binding's own message. */
    ports: {
      place(surface: string, binding: string, msg: unknown) { post({ t: "port:place", surface, binding, msg }); return { ok: true as const }; },
      close(binding: string) { post({ t: "port:close", binding }); },
    } satisfies PortTransportDoors,
    mirrorInputs: (surface: string) => call<{ coreCid: string; pluginCids: readonly string[] } | null>((callId) => ({ t: "read:mirror-inputs", callId, surface })),
    readFloor: (baseUrl: string) => call<HearthFloorRead>((callId) => ({ t: "read:floor", callId, baseUrl })),
    joinOffer: (text: string, abandonPending: boolean) => call<JoinOfferReply>((callId) => ({ t: "join:offer", callId, text, abandonPending })),
    joinAnswer: (text: string) => call<JoinAnswerReply>((callId) => ({ t: "join:answer", callId, text })),
    restartDaemonIsland: (reason: string) => call<{ restarts: number; leg: string }>((callId) => ({ t: "walk:restart", callId, reason })),
    /** The crossing as the vessel last reported it. */
    connectionState: {
      getSnapshot(): BrowserConnectionSnapshot { return connection ?? { status: "local" }; },
      subscribe(listener: BrowserConnectionListener): () => void { connectionListeners.add(listener); return () => { connectionListeners.delete(listener); }; },
    },
    terminate(): void { worker.terminate(); },
  };
}

export type VesselPort = ReturnType<typeof standVesselPort>;
