/**
 * node-call-scope — node's async-context runner for `call-touches`: a call's id rides `AsyncLocalStorage` across every
 * await of the call, so a change its handler makes after any await still tags it (sealed-store#/owed). Seated once per
 * isolate: the vessel's main thread and each island worker seat their own.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { seatCallScope, type CallScopeRunner } from "@lararium/mesh/call-touches";

let seated = false;

/** Seat the runner in this isolate (idempotent). */
export function seatNodeCallScope(): void {
  if (seated) return;
  seated = true;
  const store = new AsyncLocalStorage<string>();
  const runner: CallScopeRunner = { run: (id, fn) => store.run(id, fn), current: () => store.getStore(), exit: (fn) => store.exit(fn) };
  seatCallScope(runner);
}
