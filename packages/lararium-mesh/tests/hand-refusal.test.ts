/**
 * hand-refusal — one sentence for every refused hand act, and one reading of a booked asker.
 *
 * Proven:
 *   · each code, read off a branch or a peer, names its witness and its cure, with the command line where the door knows it
 *     and the act itself where it does not;
 *   · a booked asker reads as the gate's verdict: `cli` and `tab` stand, `seat` refuses `hand-act-only`, no asker and a
 *     watcher refuse `hand-unattested`.
 *
 * Research: lar:///ha.ka.ba/kahua/memory/research/affordance-map (collision 1: one refusal builder beside `readHand`)
 */
import { describe, expect, test } from "vitest";
import { askerRefusal, handRefusalOf } from "../src/hand-refusal.js";

describe("one refusal builder", () => {
  test("hand-act-only off a branch names the harness and the operator's terminal", () => {
    const r = handRefusalOf("hand-act-only", { act: "`lares shore take-disk`", reads: "branch", line: "lares shore take-disk lar:///a --key k" });
    expect(r.code).toBe("hand-act-only");
    expect(r.message).toBe("hand-act-only: `lares shore take-disk` runs on a person's hand at a real terminal, and an AI harness stands on this command's branch. Ask the operator to run `lares shore take-disk lar:///a --key k` on their own terminal.");
  });

  test("hand-unattested off a branch names the unread chain and a readable terminal", () => {
    const r = handRefusalOf("hand-unattested", { act: "a release", reads: "branch", line: "lares spirit otakiage p" });
    expect(r.message).toBe("hand-unattested: a release runs on a person's hand at a real terminal, and this command's process chain reads nothing to attest one. Run `lares spirit otakiage p` on a terminal whose processes the host can read.");
  });

  test("off a peer, the sentence names the seat or the line's peer; with no line, the cure names the act", () => {
    expect(handRefusalOf("hand-act-only", { act: "\"purge\"", reads: "peer" }).message)
      .toBe("hand-act-only: \"purge\" runs on a person's hand at a real terminal, and a seat asked. Ask the operator to run it on their own terminal.");
    expect(handRefusalOf("hand-unattested", { act: "\"purge\"", reads: "peer" }).message)
      .toBe("hand-unattested: \"purge\" runs on a person's hand at a real terminal, and this line's peer reads nothing to attest one. Run it on a terminal whose processes the host can read.");
  });
});

describe("a booked asker reads as the gate's verdict", () => {
  test("cli and tab stand; a seat refuses hand-act-only; no asker and a watcher refuse hand-unattested", () => {
    expect(askerRefusal("cli")).toBeNull();
    expect(askerRefusal("tab")).toBeNull();
    expect(askerRefusal("seat")).toBe("hand-act-only");
    expect(askerRefusal(undefined)).toBe("hand-unattested");
    expect(askerRefusal("watcher")).toBe("hand-unattested");
  });
});
