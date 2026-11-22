/**
 * own-hand-gate — a command that runs in its own process, with no socket between it and the vessel, reads its OWN branch for
 * the hand (hitl-reads-a-hand). The sense lifecycle's hand verbs run direct over manifest.json, so the CLI asks the same gate
 * the custody door and the pūlama's hand door ask (`readHand`), over the process that runs the command: a harness mark in its
 * environment, or a harness on its parent chain, reads `ai` and refuses `hand-act-only`; an unreadable chain refuses
 * `hand-unattested`; a chain with no harness admits the hand.
 *
 * The socket half: a seat session's `session:call` for each hand verb refuses at the door by its code (`sense-needs-hand`).
 */
import { describe, expect, test } from "vitest";
import { ownPeerKind, readOwnHand } from "../src/hand-act-gate.js";
import type { ProcReader } from "../src/uds-peer.js";
import { STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS } from "../src/store-door-verbs.js";

/** A process table: pid → [comm, ppid, environ]. */
function procs(table: Record<number, readonly [string, number, Record<string, string>]>): ProcReader {
  return {
    stat: (pid) => { const p = table[pid]; return p ? `${pid} (${p[0]}) S ${p[1]} 0 0` : null; },
    environ: (pid) => { const p = table[pid]; return p ? Object.entries(p[2]).map(([k, v]) => `${k}=${v}`).join("\0") : null; },
    cmdline: (pid) => { const p = table[pid]; return p ? `${p[0]}\0` : null; },
  };
}

const TERMINAL = procs({ 300: ["node", 200, {}], 200: ["zsh", 100, {}], 100: ["tmux: server", 1, {}], 1: ["init", 0, {}] });
const HARNESS = procs({ 300: ["node", 200, {}], 200: ["zsh", 150, { CLAUDECODE: "1" }], 150: ["claude", 100, {}], 100: ["zsh", 1, {}], 1: ["init", 0, {}] });
const RENAMED = procs({ 300: ["node", 200, {}], 200: ["bash", 150, {}], 150: ["claude", 100, {}], 100: ["zsh", 1, {}], 1: ["init", 0, {}] });

describe("a command reads its own hand", () => {
  test("RED: a harness mark in the command's own environment reads ai", () => {
    expect(ownPeerKind({ CLAUDECODE: "1" }, 300, TERMINAL)).toBe("ai");
    expect(ownPeerKind({ CODEX_SANDBOX: "seatbelt" }, 300, TERMINAL)).toBe("ai");
  });

  test("RED: a harness on the parent chain reads ai, the mark stripped (`env -u CLAUDECODE`) or the shell renamed", () => {
    expect(ownPeerKind({}, 300, HARNESS)).toBe("ai");
    expect(ownPeerKind({}, 300, RENAMED)).toBe("ai");
  });

  test("RED: an unreadable chain reads unknown, never a hand", () => {
    expect(ownPeerKind({}, 300, procs({}))).toBe("unknown");
  });

  test("CONTROL: a terminal's chain with no harness reads hand", () => {
    expect(ownPeerKind({}, 300, TERMINAL)).toBe("hand");
  });

  test("RED: readOwnHand refuses hand-act-only for ai and hand-unattested for unknown; CONTROL: a hand admits", () => {
    expect(readOwnHand({ proveRoute: false }, "ai")).toEqual({ refusal: "hand-act-only" });
    expect(readOwnHand({ proveRoute: false }, "unknown")).toEqual({ refusal: "hand-unattested" });
    expect(readOwnHand({ proveRoute: false }, "hand")).toEqual({ admit: "hand" });
  });
});

describe("the socket refuses a seat's session call for a sense hand verb", () => {
  test("RED: each sense hand verb rides the socket's one hand-only table under sense-needs-hand", () => {
    for (const verb of ["promote", "retire", "un-retire", "purge"]) {
      expect(STORE_DOOR_HAND_ONLY_ACTS.has(verb), verb).toBe(true);
      expect(STORE_DOOR_HAND_CODES.get(verb), verb).toBe("sense-needs-hand");
    }
  });

  test("CONTROL: the reads and the reversible re-settle stay open to a seat session", () => {
    for (const verb of ["roster", "inspect", "reconcile", "build"]) expect(STORE_DOOR_HAND_ONLY_ACTS.has(verb), verb).toBe(false);
  });
});
