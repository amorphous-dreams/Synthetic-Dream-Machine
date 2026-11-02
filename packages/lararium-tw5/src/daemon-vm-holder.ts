import type { DaemonVmCore } from "./daemon-vm-core.js";

export interface DaemonVmHolder {
  readonly vm: DaemonVmCore;
  restart(reason: string): Promise<{ restarts: number }>;
  readonly restarts: number;
}

export class DaemonRestarting extends Error {
  constructor(readonly code: "daemon-restarting" | "daemon-down") {
    super(code);
    this.name = "DaemonRestarting";
  }
}

export function holdDaemonVm(o: { vm: DaemonVmCore; reopen: (reason: string) => Promise<DaemonVmCore> }): DaemonVmHolder {
  let inner = o.vm;
  let state: "ready" | "restarting" | "down" = "ready";
  let count = 0;
  let drain: (() => void) | undefined;
  let restarts = 0;
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
        try { shutdown = Promise.resolve(inner.shutdown(budgetMs)); }
        catch (err) { shutdown = Promise.reject(err); }
        return shutdown;
      };
      if (key === "dispose") return () => {
        if (state !== "ready") return;
        state = "down";
        inner.dispose();
      };
      const value = Reflect.get(inner, key);
      if (typeof key !== "string" || typeof value !== "function") return value;
      if (asyncMethods.has(key)) return async (...args: unknown[]) => {
        check();
        count += 1;
        try {
          const result = await invoke(key, args);
          if (key === "lightFace") {
            const entry = args[0] as Parameters<DaemonVmCore["lightFace"]>[0];
            record(`face:${entry.atom.key}`, vm => vm.lightFace(entry));
          } else if (key === "dropFace") registrations.delete(`face:${args[0] as string}`);
          return result;
        } finally {
          count -= 1;
          if (count === 0) { drain?.(); drain = undefined; }
        }
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
    restart(reason) {
      if (restarting) return restarting;
      const wasReady = state === "ready";
      state = "restarting";
      restarting = (async () => {
        try {
          await Promise.resolve();
          if (count) await new Promise<void>(resolve => { drain = resolve; });
          if (wasReady) await inner.shutdown();
          const next = await o.reopen(reason);
          inner = next;
          shutdown = undefined;
          for (const replay of registrations.values()) await replay(next);
          restarts += 1;
          state = "ready";
          return { restarts };
        } catch (err) {
          state = "down";
          throw err;
        } finally {
          restarting = undefined;
        }
      })();
      return restarting;
    },
  };
}
