import type { DaemonVmCore } from "./daemon-vm-core.js";

export interface DaemonVmHolder {
  readonly vm: DaemonVmCore;
  restart(reason: string): Promise<{ restarts: number }>;
  guardAsk<T>(ask: { answer: Promise<T>; abandon: () => void }): { answer: Promise<T>; abandon: () => void };
  onRestarted(fn: (info: { reason: string; restarts: number }) => void | Promise<void>): () => void;
  readonly restarts: number;
}

/**
 * THE ONE REASON THAT ARMS THE BRAKE. A restart called with exactly this string is the kapae emergency: a refused prepare still closes the standing
 * island (fail CLOSED) instead of leaving shadowed code running. Callers pass this constant; no prose, prefix or near miss matches.
 */
export const KAPAE_EMERGENCY_REASON = "promote: kapae raised over a loaded rite";

/** The reason an ordinary promote verb (commit, drop, orphan decision) restarts the daemon island with: no brake, so a refused prepare leaves the standing island running. */
export const PROMOTE_RESTART_REASON = "promote: a hand's verb reloads the daemon island";

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
  /** A restart whose reason this names fails CLOSED: a refused prepare still shuts the standing island down and stands `daemon-down` (the brake beats availability). */
  emergency?: (reason: string) => boolean;
  /** A reason whose request reads state that moved after a standing restart passed prepare (a hand's promote verb): it follows that restart with one more reload, without failing closed. */
  follows?: (reason: string) => boolean;
  /** How an emergency refusal closes the standing island; absent, it shuts it down. A host that shares its island with others (a browser tab on the shared holder) detaches itself here. */
  failClosed?: ((vm: DaemonVmCore) => void | Promise<void>) | undefined;
  /** `manifest`: the re-opened island's manifest carries the lit faces, so the holder records and replays none (the node reads each face's current standing at every open). */
  faces?: "replay" | "manifest";
}): DaemonVmHolder {
  let inner = o.vm;
  let state: "ready" | "restarting" | "down" = "ready";
  const pending = new Set<(err: Error) => void>();   // the settle doors of calls standing on the current VM
  const pendingAsks = new Set<() => void>();
  const listeners = new Set<(info: { reason: string; restarts: number }) => void | Promise<void>>();
  let restarts = 0;
  let upgraded = false;      // an emergency joined the restart standing in prepare: it fails closed whatever reason started it
  let stopping: Promise<void> | undefined;   // an emergency's stop of the standing island, started the moment the emergency arrived
  let upgradeReason = "";   // the emergency reason that upgraded it
  let preparePassed = false; // the standing restart is past its first prepare: its inputs are fixed, so a follows-reason request reloads once more
  let reopenStarted = false; // the standing restart began its reopen: a boot underway cannot be stopped
  let followUpReason: string | undefined;   // the reason the queued follow-up restart runs under (an emergency outranks an ordinary one)
  let followUp: Promise<{ restarts: number }> | undefined;
  let disposed = false;     // a disposed facade restarts no more, and a restart that sees it never re-opens
  let innerClosed = false;  // the current inner island already got its shutdown
  let replaying = false;   // true while a re-opened island takes its registrations
  let restarting: Promise<{ restarts: number }> | undefined;
  let shutdown: Promise<{ acked: boolean }> | undefined;
  /** A direct shutdown began: the island still stands until it acks, and its leg answers its own settlement round. */
  let shuttingDown = false;
  const registrations = new Map<string, (vm: DaemonVmCore) => void | Promise<void>>();
  const asyncMethods = new Set(["mountHostWorkingLayer", "syncLegReady", "runAsFace", "lightFace", "dropFace", "registerFaceBags", "worldlineCompare", "worldlineTrajectory", "resolveBinding"]);
  const registrationMethods = new Set(["mountMainVerbs", "onEvictRequest", "onResidencyOp", "onWikiAlert", "onFrame", "onControlResult", "onVerbEvent"]);

  // A restart's resolution and its queued follow-up never wait on listeners: the replacement is ready, the follow-up starts, and the listeners are
  // told after, in restart order, on their own chain. A listener that never settles, or one that awaits a restart, stalls only later notices.
  let notifying: Promise<void> | undefined;
  const notifyRestarted = (info: { reason: string; restarts: number }) => {
    const run = async () => {
      for (const listener of [...listeners]) {
        try { await listener(info); }
        catch (err) { console.error("[daemon] restart listener failed", err); }
      }
    };
    const chain: Promise<void> = notifying ? notifying.then(run) : run();
    notifying = chain;
    void chain.finally(() => { if (notifying === chain) notifying = undefined; });
  };

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
        shuttingDown = true;
        try { shutdown = Promise.resolve(inner.shutdown(budgetMs)); }
        catch (err) { shutdown = Promise.reject(err); }
        // The island acked (or its budget cut it) and left: its leg reads daemon-down from here.
        void shutdown.finally(() => { shuttingDown = false; }).catch(() => undefined);
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
        // The vessel's receipt answer asks the island's leg while the island mounts its replayed layers: that readiness read answers from the new VM.
        if (key === "syncLegReady" && replaying) return Promise.resolve(invoke(key, args));
        // The SHUTTING island still asks its receipts (its settlement round, L29) and its leg stands until it acks: the
        // vessel's receipt answer reads that leg through here, so a shutdown in flight lets the read through. A disposed
        // island has no leg, and every other door still refuses daemon-down.
        if (key === "syncLegReady" && shuttingDown && !disposed) return Promise.resolve(invoke(key, args));
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

  const settleAll = (): void => {
    // No wait: a call still pending settles by name, so one that never settles cannot stall the restart.
    for (const settle of [...pending]) settle(new DaemonRestarting("daemon-restarting"));
    pending.clear();
    for (const settle of [...pendingAsks]) {
      try { settle(); } catch (err) { console.error("[daemon] ask abandon failed", err); }
    }
  };
  /** An EMERGENCY stops first: pending calls and asks settle by name and the standing island closes at once, before any prepare, so nothing shadowed serves while inputs prepare. */
  const stopNow = (): Promise<void> => {
    if (stopping) return stopping;
    if (state !== "ready") return Promise.resolve();
    state = "restarting";
    settleAll();
    innerClosed = true;
    const closing = (async () => { await (o.failClosed ? o.failClosed(inner) : inner.shutdown()); })();
    stopping = closing;
    closing.catch(() => undefined);
    return closing;
  };

  const holder: DaemonVmHolder = {
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
    restart(reason): Promise<{ restarts: number }> {
      if (disposed) return Promise.reject(new DaemonRestarting("daemon-down"));
      if (restarting) {
        const emergency = o.emergency?.(reason) === true;
        // A restart still in prepare reads its inputs afterward, so an ordinary request joins it. Past prepare, its inputs are fixed: ANY request
        // follows it (an ordinary one reloads once more, without failing closed), so a reload never reads as served by a restart that opened earlier state.
        if (!emergency && (!preparePassed || o.follows?.(reason) !== true)) return restarting;
        // An emergency is never downgraded to the ordinary restart it overlaps: until the reopen begins it upgrades it (stopping the standing island at
        // once, so the restart re-prepares under it), and once the boot is underway it follows it.
        if (emergency && !reopenStarted) { upgraded = true; upgradeReason = reason; void stopNow(); return restarting; }
        if (emergency || followUpReason === undefined) followUpReason = emergency ? reason : (followUpReason ?? reason);
        followUp ??= restarting.then(() => undefined, () => undefined).then(() => { const next = followUpReason!; followUp = undefined; followUpReason = undefined; return holder.restart(next); });
        return followUp;
      }
      upgraded = false;
      preparePassed = false;
      reopenStarted = false;
      stopping = undefined;
      if (o.emergency?.(reason)) void stopNow();
      const run = async () => {
        let prepared: P = undefined as P;
        let current = reason;
        // Prepare under `current`; an emergency that landed while it ran may postdate its inputs, so prepare runs again under that emergency until none lands.
        const prepareUnder = async (): Promise<void> => {
          for (;;) {
            try { prepared = await o.prepare!(current); }
            catch (err) {
              // An EMERGENCY restart fails closed: the island is already stopped, and a refused prepare leaves it down.
              if (!disposed && (upgraded || o.emergency?.(current))) {
                try { await stopNow(); } finally { state = "down"; }
              }
              throw err;
            }
            if (!upgraded) break;
            upgraded = false;
            current = upgradeReason;
          }
        };
        if (o.prepare) await prepareUnder();
        preparePassed = true;
        if (stopping) {                  // an emergency's stop finishes before anything reopens
          try { await stopping; } catch (err) { state = "down"; throw err; }
        }
        // A disposal or direct shutdown that started while prepare awaited ends the restart: no replacement opens beside a closing island.
        if (disposed || (state === "down" && shutdown)) throw new DaemonRestarting("daemon-down");
        const wasReady = state === "ready";
        state = "restarting";
        let next: DaemonVmCore | undefined;
        try {
          settleAll();
          if (wasReady) { innerClosed = true; await inner.shutdown(); }
          // An emergency that landed after prepare passed, while the standing island shut down, re-prepares before the replacement boots: stale inputs never boot.
          // The LAST check (`upgraded`, `disposed`), `reopenStarted` and the reopen call share ONE continuation: the loop re-checks after every await and nothing is awaited between the final check and the call.
          for (;;) {
            if (disposed) throw new DaemonRestarting("daemon-down");
            if (!(o.prepare && upgraded)) break;
            upgraded = false;
            current = upgradeReason;
            try { prepared = await o.prepare(current); }
            catch (err) {
              if (!disposed) { try { await stopNow(); } finally { state = "down"; } }
              throw err;
            }
          }
          reopenStarted = true;
          next = await o.reopen(current, prepared);
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
          notifyRestarted({ reason, restarts });
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
  return holder;
}
