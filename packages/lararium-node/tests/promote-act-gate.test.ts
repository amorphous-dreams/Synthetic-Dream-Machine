/**
 * promote-act-gate — the kapae arrival on the RAISING device waits for the raise's own session act to be answered, never for a timer.
 *
 * The raise (`lares kapae raise`) runs as a face row on the daemon island and the board watcher sees its act land before the row's reply
 * leaves; a plain holder restart then rejects the row (`daemon-restarting`) though the act landed. The gate counts the promote acts a
 * session has begun and releases a waiter once each of THEM has settled (reply written). It never waits on an act that begins later,
 * and it never holds anything the vessel did not begin itself (the holder keeps its no-wait law).
 */
import { expect, test } from "vitest";
import { promoteActGate, isPromoteAct } from "../src/promote-act-gate.js";

test("the names the gate counts: promote and kapae rows, nothing else", () => {
  for (const act of ["promote-commit", "promote-drop", "promote-orphan", "promote-prepare", "kapae-raise", "kapae-lower", "kapae-flag"]) expect(isPromoteAct(act), act).toBe(true);
  for (const act of ["kahua-lift", "face.resolve", "island.restart", "promote", ""]) expect(isPromoteAct(act), act).toBe(false);
});

test("RED: a waiter parks while a begun act stands and releases the moment it settles; CONTROL: an idle gate releases at once", async () => {
  const gate = promoteActGate();
  let idle = false;
  await gate.settled().then(() => { idle = true; });
  expect(idle, "no act stands, so nothing waits").toBe(true);
  const act = {};
  gate.begin(act);
  let released = false;
  const waiting = gate.settled().then(() => { released = true; });
  await Promise.resolve(); await Promise.resolve();
  expect(released).toBe(false);
  gate.end(act);
  await waiting;
  expect(released).toBe(true);
});

test("an act that begins after the request does not extend the wait; one that never begins here is never waited on", async () => {
  const gate = promoteActGate();
  const first = {}, later = {};
  gate.begin(first);
  const waiting = gate.settled();
  gate.begin(later);
  gate.end(first);
  await waiting;
  gate.end(later);
  gate.end({});          // an end for an act this gate never began is a no-op
  await gate.settled();
});
