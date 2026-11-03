/**
 * promote-act-gate — the RAISING device's own raise completes before its daemon island restarts; nothing else ever holds an arrival.
 *
 * The raise (`lares kapae raise`) runs as a face row on the daemon island and the board watcher sees its act land before the row's reply
 * leaves; a bare restart then rejects the row (`daemon-restarting`) though the act landed. The gate counts the promote acts a session has
 * begun. `after(kinds, run)` hands `run` to the completion of the acts of those kinds standing NOW and returns true; with none standing it
 * returns false and the caller restarts at once. It never awaits and never holds a promise: a hung act leaves a plain restart (the owner
 * door's `island.restart`) free to force the swap, and an act that begins later is never waited on.
 */
import { expect, test } from "vitest";
import { promoteActGate, isPromoteAct } from "../src/promote-act-gate.js";

test("the names the gate counts: promote and kapae rows, nothing else", () => {
  for (const act of ["promote-commit", "promote-drop", "promote-orphan", "promote-prepare", "kapae-raise", "kapae-lower", "kapae-flag"]) expect(isPromoteAct(act), act).toBe(true);
  for (const act of ["kahua-lift", "face.resolve", "island.restart", "promote", ""]) expect(isPromoteAct(act), act).toBe(false);
});

test("RED: a local raise in flight defers the restart to its own completion; CONTROL: with none standing the caller restarts at once", () => {
  const gate = promoteActGate();
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("idle")), "no raise stands: the caller restarts at once").toBe(false);
  expect(ran).toEqual([]);
  const raise = {};
  gate.begin(raise, "kapae-raise");
  expect(gate.after(["kapae-raise"], () => ran.push("after-raise"))).toBe(true);
  expect(ran, "the restart waits for the raise's reply").toEqual([]);
  gate.end(raise);
  expect(ran).toEqual(["after-raise"]);
});

test("RED (Luna final, MED): an unrelated promote act pending forever never holds an arrival; CONTROL: a commit's own reload does wait for the commit", () => {
  const gate = promoteActGate();
  const stuck = {};
  gate.begin(stuck, "promote-commit");           // never ends in this test
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("arrival")), "a remote raise restarts at once").toBe(false);
  expect(gate.after(["promote-commit", "promote-drop", "promote-orphan"], () => ran.push("reload"))).toBe(true);
  expect(ran).toEqual([]);
  gate.end(stuck);
  expect(ran).toEqual(["reload"]);
});

test("RED: a raise whose reply never writes holds only its own deferred run; the run fires once, never for an act that begins later, and a stray end is a no-op", () => {
  const gate = promoteActGate();
  const first = {}, later = {};
  gate.begin(first, "kapae-raise");
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("a"))).toBe(true);
  gate.begin(later, "kapae-raise");
  gate.end(first);
  expect(ran, "the deferred run follows the act standing at the request alone").toEqual(["a"]);
  gate.end(later);
  gate.end({});
  gate.end(first);
  expect(ran).toEqual(["a"]);
});

test("RED: a raise whose reply never writes leaves a plain holder restart (the owner door's island.restart) free to force the swap", async () => {
  const { holdDaemonVm } = await import("@lararium/tw5");
  const shut: string[] = [];
  const vm = (id: string) => ({ shutdown: async () => { shut.push(id); return { acked: true }; }, dispose: () => undefined }) as never;
  const held = holdDaemonVm({ vm: vm("old"), reopen: async () => vm("new") });
  const gate = promoteActGate();
  const hung = {};
  gate.begin(hung, "kapae-raise");                // its reply never writes: `end` never fires
  let deferred = false;
  expect(gate.after(["kapae-raise"], () => { deferred = true; })).toBe(true);
  const forced = await held.restart("island.restart");
  expect(forced.restarts).toBe(1);
  expect(shut).toEqual(["old"]);
  expect(deferred, "the hung raise's own deferred run never fired").toBe(false);
});

test("RED (Sol #6): an arrival defers only to a local raise for the SAME (wiki, digest) edge; a stuck raise for another edge never holds it. CONTROL: the same edge defers", async () => {
  const { promoteActEdge } = await import("../src/promote-act-gate.js");
  const A = "a".repeat(64), B = "b".repeat(64);
  expect(promoteActEdge({ digest: A })).toBe(promoteActEdge({ digest: A, wiki: "daemon" }));
  expect(promoteActEdge({ digest: A, wiki: "garden" })).not.toBe(promoteActEdge({ digest: A }));
  expect(promoteActEdge({ digest: "nope" })).toBeUndefined();
  const gate = promoteActGate();
  const stuck = {};
  gate.begin(stuck, "kapae-raise", promoteActEdge({ digest: A }));       // never ends: a raise for edge A
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("B"), [promoteActEdge({ digest: B })!]), "a remote raise over B restarts at once").toBe(false);
  expect(gate.after(["kapae-raise"], () => ran.push("A"), [promoteActEdge({ digest: A })!]), "the same edge defers to its own raise").toBe(true);
  expect(gate.after(["kapae-raise"], () => ran.push("legacy")), "no edges given keeps the kind-wide reading").toBe(true);
  gate.end(stuck);
  expect(ran).toEqual(["A", "legacy"]);
});
