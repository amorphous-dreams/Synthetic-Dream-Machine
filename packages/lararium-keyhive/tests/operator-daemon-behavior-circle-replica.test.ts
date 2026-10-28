/**
 * operator-daemon-behavior — THE FOLLOW-GRAPH'S REPLICA INJECTION (M5′, gp25 iteration 5, E2 commit 2/2).
 *
 * `circle-verbs.ts`'s M5′ half (commit 1) made `CircleVerbOptions.replica` REQUIRED — a dot a circle-add/
 * circle-remove mints now carries no fallback `"local"` id. This wiring site is the one standing production
 * call site: it must inject THIS device's own did — the SAME identity `cold-boot-ceremony` mints a fresh
 * genesis follow's `<did>.0` dot from (`didFromVerifyingKey(daemonAuth.placeVerifyingKey)`) — so a device's
 * own follow-graph writes land disjoint from every OTHER device of the same operator by construction,
 * matching the dot the genesis follow already carries.
 *
 * `makeCircleReactors` is captured once at WIRE time (the registration pass), before any store ever
 * resolves — the `replica` it is called with is fixed into the reactor closures right there, so a test can
 * observe it without standing a live catalog registry or Automerge repo at all.
 */
import { describe, test, expect, vi } from "vitest";

const captured: Array<{ replica?: string }> = [];
vi.mock("@lararium/tw5", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/tw5")>();
  return {
    ...real,
    makeCircleReactors: (opts: { replica?: string; [k: string]: unknown }) => {
      captured.push({ replica: opts.replica });
      return real.makeCircleReactors(opts as never);
    },
  };
});

import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";
import { VerbTable } from "@lararium/tw5";
import { didFromVerifyingKey, faceAtomKeyFromSeed } from "@lararium/mesh";

/** The minimum an island context must offer for the wiring pass to run the FOLLOW-GRAPH branch (it gates
 *  on `ctx.oracleUrl`; `catalogUrl` stands the (lazy, never-dialed-here) facePlane accessor). */
const fakeCtx = () => ({
  composite: {} as never,
  repo:      {} as never,
  catalogUrl: "automerge:fakeCatalog",
  oracleUrl:  "automerge:fakeOracle",
  tw5:       {} as never,
  post:      () => {},
}) as never;

const GROUP = "ab".repeat(16);
const atomKey = (seedHex: string) => faceAtomKeyFromSeed(new Uint8Array(Buffer.from(seedHex, "hex")), GROUP).key;
const manifestWithKey = (seedHex: string) => ({
  daemonAuth: {
    placeVerifyingKey: "aa".repeat(32),
    registerBags: [],
    personaGroupId: GROUP,
    atom: { seed: seedHex, key: atomKey(seedHex) },
    deviceEdge: { deviceVerifyingKey: atomKey(seedHex) },
  },
}) as never;

/** Wire the daemon's verbs over a fresh registry, recording every verb name registered. */
function wire(seedHex: string): string[] {
  const registry = new VerbTable();
  const names: string[] = [];
  const real = registry.register.bind(registry);
  (registry as unknown as { register: (n: string, f: unknown) => void }).register = (n, f) => {
    names.push(n); real(n, f as never);
  };
  operatorDaemonOptions(manifestWithKey(seedHex)).wireWorkerVerbs?.(registry, fakeCtx());
  return names;
}

describe("operator-daemon-behavior — the follow-graph's replica injection (M5′ commit 2/2)", () => {
  test("CONTROL — wiring registers the follow-graph verbs and calls makeCircleReactors exactly once", () => {
    captured.length = 0;
    const names = wire("a".repeat(64));
    expect(names, "the wiring pass never ran").toContain("circle-add");
    expect(names).toContain("circle-remove");
    expect(names).toContain("circle-list");
    expect(captured.length).toBe(1);
  });

  test("F1 — this device's OWN did (off placeVerifyingKey) is injected as the replica — never the bare-string fallback", () => {
    captured.length = 0;
    const treeKey = "ab".repeat(32);
    wire(treeKey);
    expect(captured[0]!.replica).toBe(didFromVerifyingKey(atomKey(treeKey)));
    expect(captured[0]!.replica).not.toBe("local");
  });

  test("F1b — TWO DEVICES with distinct placeVerifyingKeys inject DISTINCT replica ids (no collision by construction)", () => {
    captured.length = 0;
    wire("11".repeat(32));
    wire("22".repeat(32));
    expect(captured).toHaveLength(2);
    expect(captured[0]!.replica).not.toBe(captured[1]!.replica);
    expect(captured[0]!.replica).toBe(didFromVerifyingKey(atomKey("11".repeat(32))));
    expect(captured[1]!.replica).toBe(didFromVerifyingKey(atomKey("22".repeat(32))));
  });

  test("MUTATION — the SAME device's own did is stable across a re-wire (a reboot never mints a fresh replica for one device)", () => {
    captured.length = 0;
    const treeKey = "cd".repeat(32);
    wire(treeKey);
    wire(treeKey);
    expect(captured[0]!.replica).toBe(captured[1]!.replica);
  });
});
