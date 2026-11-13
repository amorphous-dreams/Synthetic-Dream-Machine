/**
 * daemon-reopen-browser-hazards-weld — the browser vessel drops a mid-swap island event by name, as the node does (Luna 1, P2; a source weld).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SRC = readFileSync(join(__dirname, "..", "..", "lararium-browser", "src", "open-browser-vessel.ts"), "utf8");

describe("the browser vessel's island events", () => {
  test("the worker-event place and the daemon's own verb-event place each drop a DaemonRestarting refusal and rethrow any other", () => {
    expect((SRC.match(/catch \(err\) \{ if \(!\(err instanceof DaemonRestarting\)\) throw err;/g) ?? []).length).toBe(2);
    expect(SRC).toMatch(/import \{[^}]*\bDaemonRestarting\b[^}]*\} from "@lararium\/tw5"/);
  });

  test("CONTROL: the pattern reads a bare place as red", () => {
    expect("if (ask) daemon.placeVerb(ask);".match(/catch \(err\) \{ if \(!\(err instanceof DaemonRestarting\)\)/)).toBeNull();
  });
});
