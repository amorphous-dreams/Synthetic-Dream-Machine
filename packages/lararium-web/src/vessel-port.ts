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
import type { CeremonyAskKind } from "./ceremony-protocol.js";
import type {
  JoinAnswerReply, JoinOfferReply, PageToVessel, VesselBoot, VesselError, VesselStatus, VesselToPage,
} from "./vessel-protocol.js";

/** An ask as the page hears it: public words alone. The page opens the ceremony document for it and takes no answer. */
export interface VesselAsk { readonly askId: string; readonly kind: CeremonyAskKind; readonly act: string; readonly words: string; readonly face: string | null }

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
  /** The vessel asks the person: the page opens the ceremony document, and the answer travels ceremony to vessel, never here. */
  onAsk?(ask: VesselAsk): void;
  /** The ask closed (answered, declined or refused): the page takes its notice down. */
  onAskSettled?(askId: string): void;
  onEnded?(why: string, stage: "custody" | "open", refusal?: string): void;
  /** The vessel opened this tab's session: its owner epoch and minted id (an earlier greeting it refused reads `refused`). */
  onGreeting?(greeting: VesselGreeting): void;
  /** The holder's SharedWorker, built on the page because a dedicated worker cannot build one. */
  spawnHolder?(url: string, name: string): { readonly port: MessagePort; onError(listener: () => void): void } | null;
}

/** The session the vessel opened for this tab. The page trusts no earlier greeting: a respawned vessel mints afresh. */
export interface VesselGreeting { readonly ownerEpoch: string; readonly sessionId: string; readonly lifetimeLock: string; readonly refused?: string }

/** The Web Locks the page holds its session's lifetime lock on (`navigator.locks`). */
export interface PageLocks { request(name: string, callback: () => Promise<unknown>): Promise<unknown> }
/**
 * THE TAB'S OWN FACE SELECTION: the PersonaGroup this tab's session wears, kept in the tab's own `sessionStorage`, so a reload
 * wears it again and another tab selects its own. A public name; the face's own unlock admits the session.
 */
const TAB_FACE_KEY = "lares:tab-face";
const tabFace = (): string | null => { try { return sessionStorage.getItem(TAB_FACE_KEY); } catch { return null; } };
const selectTabFace = (face: string): void => { try { sessionStorage.setItem(TAB_FACE_KEY, face); } catch { /* a tab that withholds storage names no face, and wears the store's one face */ } };

const ambientPageLocks = (): PageLocks | null => {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  return locks ? { request: (name, callback) => locks.request(name, callback) } : null;
};

export function standVesselPort(worker: VesselWorkerLike, handlers: VesselPortHandlers, opts: { readonly locks?: PageLocks | null } = {}) {
  const calls = new Map<string, { resolve(v: unknown): void; reject(e: unknown): void }>();
  let connection: BrowserConnectionSnapshot | null = null;
  let greeting: VesselGreeting | null = null;
  let endLife: (() => void) | null = null;
  const locks = opts.locks === undefined ? ambientPageLocks() : opts.locks;
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
      case "greeting": {
        greeting = { ownerEpoch: msg.ownerEpoch, sessionId: msg.sessionId, lifetimeLock: msg.lifetimeLock, ...(msg.refused ? { refused: msg.refused } : {}) };
        handlers.onGreeting?.(greeting);
        // THE TAB HOLDS ITS SESSION'S LIFETIME LOCK FOR ITS LIFE: once held, the vessel queues on it, and the platform hands it
        // over when this page's context goes, with or without a close.
        const sessionId = msg.sessionId;
        if (locks) void locks.request(msg.lifetimeLock, () => new Promise<void>((resolve) => { endLife = resolve; post({ t: "session:armed", sessionId }); })).catch(() => undefined);
        return;
      }
      case "ping": post({ t: "pong", n: msg.n }); return;
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
      case "ask": handlers.onAsk?.({ askId: msg.askId, kind: msg.kind, act: msg.act, words: msg.words, face: msg.face }); return;
      case "ask:settled": handlers.onAskSettled?.(msg.askId); return;
      case "status":
        if (msg.status.face) selectTabFace(msg.status.face);
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
      case "ended": handlers.onEnded?.(msg.why, msg.stage, msg.refusal); return;
    }
  });
  worker.addEventListener("error", (e: Event) => handlers.onEnded?.(`the vessel worker failed: ${(e as ErrorEvent).message ?? "error"}`, "open"));

  return {
    /** Open this tab's session; `resume` names an earlier greeting, which a respawned vessel refuses by name. */
    hello(boot: VesselBoot, resume?: { readonly ownerEpoch: string; readonly sessionId: string }): void {
      const face = tabFace();
      post({ t: "hello", tabSession: crypto.randomUUID(), boot, ...(face ? { face } : {}), ...(resume ? { resume } : {}) });
    },
    /** Select the face this tab's next session wears (a landed join's face, before the tab re-enters its boot). */
    selectFace: (face: string): void => selectTabFace(face),
    /** The session the vessel greeted this tab with, or null before its greeting. */
    greeting: (): VesselGreeting | null => greeting,
    pageLife(life: PageLife): void { post({ t: "page:life", life }); },
    /** One end of a ceremony's channel, transferred to the vessel unread; the page keeps neither end. */
    ceremonyPort(askId: string, port: MessagePort): void { post({ t: "ceremony:port", askId, port }, [port]); },
    /** The page could not open the ceremony for this ask: the vessel's ask rejects with the name. */
    ceremonyRefused(askId: string, refusal: string): void { post({ t: "ceremony:refused", askId, refusal }); },
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
    /** A harness-only door (the walk build): one ward act over `bytes`, its passphrase asked through the ceremony. */
    walkWardAct: (bytes: Uint8Array) => call<{ key: string; signature: string }>((callId) => ({ t: "walk:ward", callId, bytes })),
    /** The crossing as the vessel last reported it. */
    connectionState: {
      getSnapshot(): BrowserConnectionSnapshot { return connection ?? { status: "local" }; },
      subscribe(listener: BrowserConnectionListener): () => void { connectionListeners.add(listener); return () => { connectionListeners.delete(listener); }; },
    },
    terminate(): void { endLife?.(); endLife = null; worker.terminate(); },
  };
}

export type VesselPort = ReturnType<typeof standVesselPort>;
