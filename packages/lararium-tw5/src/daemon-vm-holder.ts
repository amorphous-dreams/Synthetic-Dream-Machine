import type { DaemonVmCore } from "./daemon-vm-core.js";

export interface DaemonVmHolder {
  readonly vm: DaemonVmCore;
  restart(reason: string): Promise<{ restarts: number }>;
  guardAsk<T>(ask: { answer: Promise<T>; abandon: () => void }): { answer: Promise<T>; abandon: () => void };
  onRestarted(fn: (info: { reason: string; restarts: number }) => void | Promise<void>): () => void;
  readonly restarts: number;
}

export class DaemonRestarting extends Error {
  constructor(readonly code: "daemon-restarting" | "daemon-down") {
    super(code);
    this.name = "DaemonRestarting";
  }
}

/** Hold a stable facade; prepare boot inputs before disrupting the current VM. A refused
 * preparation leaves its state and pending calls untouched. */
export function holdDaemonVm<P = void>(o: {
  vm: DaemonVmCore;
  prepare?: (reason: string) => Promise<P>;
  reopen: (reason: string, prepared: P) => Promise<DaemonVmCore>;
  /** A restart whose reason this names fails CLOSED: a refused prepare still shuts the old island down and stands `daemon-down` (the brake beats availability). */
  emergency?: (reason: string) => boolean;
  /** `manifest`: the re-opened island's manifest carries the lit faces, so the holder records and replays none (the node reads each face's current standing at every open). */
  faces?: "replay" | "manifest";
}): DaemonVmHolder {
  let inner = o.vm;
  let state: "ready" | "restarting" | "down" = "ready";
  const pending = new Set<(err: Error) => void>();   // the settle doors of calls standing on the current VM
  const pendingAsks = new Set<() => void>();
  const listeners = new Set<(info: { reason: string; restarts: number }) => void | Promise<void>>();
  let restarts = 0;
  let disposed = false;     // a disposed facade restarts no more, and a restart that sees it never re-opens
  let innerClosed = false;  // the current inner island already got its shutdown
  let replaying = false;   // true while a re-opened island takes its registrations
  let restarting: Promise<{ restarts: number }> | undefined;
  let shutdown: Promise<{ acked: boolean }> | undefined;
  const registrations = new Map<string, (vm: DaemonVmCore) => void | Promise<void>>();
  const asyncMethods = new Set(["mountHostWorkingLayer", "syncLegReady", "runAsFace", "lightFace", "dropFace", "worldlineCompare", "worldlineTrajectory", "resolveBinding"]);
  const registrationMethods = new Set(["mountMainVerbs", "onEvictRequest", "onResidencyOp", "onWikiAlert", "onFrame", "onControlResult", "onVerbEvent"]);

  const check = () => {
    if (state !== "ready") throw new DaemonRestarting(state === "down" ? "daemon-down" : "daemon-restarting");
  };
  const record = (key: string, replay: (vm: DaemonVmCore) => void | Promise<void>) => {
    registrations.delete(key);
    registrations.set(key, replay);
  };
  const invoke = (name: string, args: unknown[]) => {
    const method = (inner as unknown as Record<string, (...args: unknown[]) => unknown>)[name]!;
    return method.apply(inner, args);
  };
  const facade = new Proxy({} as DaemonVmCore, {
    get(_target, key) {
      if (key === "shutdown") return (budgetMs?: number) => {
        if (shutdown) return shutdown;
        if (state !== "ready") return Promise.reject(new DaemonRestarting(state === "down" ? "daemon-down" : "daemon-restarting"));
        state = "down";
        innerClosed = true;
        try { shutdown = Promise.resolve(inner.shutdown(budgetMs)); }
        catch (err) { shutdown = Promise.reject(err); }
        return shutdown;
      };
      if (key === "dispose") return () => {
        // Disposal always wins: it ends a restart in flight (the restart reads `disposed` at each step and opens nothing more).
        if (disposed) return;
        disposed = true;
        state = "down";
        for (const settle of [...pending]) settle(new DaemonRestarting("daemon-down"));
        pending.clear();
        for (const settle of [...pendingAsks]) {
          try { settle(); } catch (err) { console.error("[daemon] ask abandon failed", err); }
        }
        if (!innerClosed) { innerClosed = true; inner.dispose(); }
      };
      const value = Reflect.get(inner, key);
      if (typeof key !== "string" || typeof value !== "function") return value;
      if (asyncMethods.has(key)) return (...args: unknown[]) => {
        // The vessel's rest door asks the island's leg while the island mounts its replayed layers: that readiness read answers from the new VM.
        if (key === "syncLegReady" && replaying) return Promise.resolve(invoke(key, args));
        try { check(); } catch (err) { return Promise.reject(err); }   // an async door refuses by rejecting
        const generation = restarts;
        return new Promise((resolve, reject) => {
          pending.add(reject);
          Promise.resolve(invoke(key, args)).then((result) => {
            if (!pending.delete(reject)) return;        // a restart already settled this call by name
            if (generation === restarts && state === "ready") {
              if (o.faces === "manifest" && (key === "lightFace" || key === "dropFace")) {
                // The manifest carries the lit faces at every open; nothing replays.
              } else if (key === "mountHostWorkingLayer") {
                // The working layer mounts once per island: the vessel mounts it after boot, so a re-opened island needs it too.
                record("mountHostWorkingLayer", vm => vm.mountHostWorkingLayer());
              } else if (key === "lightFace") {
                const entry = args[0] as Parameters<DaemonVmCore["lightFace"]>[0];
                record(`face:${entry.atom.key}`, vm => vm.lightFace(entry));
              } else if (key === "dropFace") registrations.delete(`face:${args[0] as string}`);
            }
            resolve(result);
          }, (err) => {
            if (pending.delete(reject)) reject(err);
          });
        });
      };
      return (...args: unknown[]) => {
        check();
        const result = invoke(key, args);
        if (registrationMethods.has(key)) record(key, vm => {
          const method = (vm as unknown as Record<string, (...args: unknown[]) => unknown>)[key]!;
          method.apply(vm, args);
        });
        return result;
      };
    },
  });

  return {
    vm: facade,
    get restarts() { return restarts; },
    guardAsk<T>(ask: { answer: Promise<T>; abandon: () => void }) {
      if (state !== "ready") {
        ask.abandon();
        throw new DaemonRestarting(state === "down" ? "daemon-down" : "daemon-restarting");
      }
      let abandoned = false;
      const abandon = () => {
        pendingAsks.delete(restartAsk);
        if (!abandoned) { abandoned = true; ask.abandon(); }
      };
      let rejectAnswer!: (err: Error) => void;
      const restartAsk = () => {
        try { abandon(); } finally { rejectAnswer(new DaemonRestarting("daemon-restarting")); }
      };
      const answer = new Promise<T>((resolve, reject) => {
        rejectAnswer = reject;
        ask.answer.then(value => { pendingAsks.delete(restartAsk); resolve(value); }, err => { pendingAsks.delete(restartAsk); reject(err); });
      });
      // The caller may deliberately discard an ask; its guarded rejection still remains observable.
      void answer.catch(() => undefined);
      pendingAsks.add(restartAsk);
      return { answer, abandon };
    },
    onRestarted(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    restart(reason) {
      if (disposed) return Promise.reject(new DaemonRestarting("daemon-down"));
      if (restarting) return restarting;
      const settleAll = (): void => {
        // No wait: a call still pending settles by name, so one that never settles cannot stall the restart.
        for (const settle of [...pending]) settle(new DaemonRestarting("daemon-restarting"));
        pending.clear();
        for (const settle of [...pendingAsks]) {
          try { settle(); } catch (err) { console.error("[daemon] ask abandon failed", err); }
        }
      };
      const run = async () => {
        let prepared: P = undefined as P;
        if (o.prepare) {
          try { prepared = await o.prepare(reason); }
          catch (err) {
            // An EMERGENCY restart fails closed: the shadowed island stops accepting work even when its replacement cannot be prepared.
            if (!disposed && state === "ready" && o.emergency?.(reason)) {
              state = "restarting";
              settleAll();
              innerClosed = true;
              try { await inner.shutdown(); } finally { state = "down"; }
            }
            throw err;
          }
        }
        // A disposal or direct shutdown that started while prepare awaited ends the restart: no replacement opens beside a closing island.
        if (disposed || (state === "down" && shutdown)) throw new DaemonRestarting("daemon-down");
        const wasReady = state === "ready";
        state = "restarting";
        let next: DaemonVmCore | undefined;
        try {
          settleAll();
          if (wasReady) { innerClosed = true; await inner.shutdown(); }
          next = await o.reopen(reason, prepared);
          if (disposed) throw new DaemonRestarting("daemon-down");   // the catch closes the replacement
          inner = next;
          innerClosed = false;
          shutdown = undefined;
          replaying = true;
          try {
            for (const replay of registrations.values()) { if (disposed) throw new DaemonRestarting("daemon-down"); await replay(next); }
          } finally { replaying = false; }
          if (disposed) throw new DaemonRestarting("daemon-down");
          restarts += 1;
          state = "ready";
          for (const listener of listeners) {
            try { await listener({ reason, restarts }); }
            catch (err) { console.error("[daemon] restart listener failed", err); }
          }
          return { restarts };
        } catch (err) {
          // A replacement already open when replay or a later step fails closes here, so a recovering restart leaks no island.
          if (next) { innerClosed = true; try { await next.shutdown(); } catch (down) { console.error("[daemon] replacement shutdown failed", down); } }
          state = "down";
          throw err;
        }
      };
      // Install the coalescing promise before prepare can run, including synchronous refusals.
      if (!o.prepare) {
        // The no-prepare path keeps its existing immediate refusal behavior.
        restarting = run().finally(() => { restarting = undefined; });
      } else {
        restarting = Promise.resolve().then(run).finally(() => { restarting = undefined; });
      }
      return restarting;
    },
  };
}
