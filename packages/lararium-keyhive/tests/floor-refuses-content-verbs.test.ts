/**
 * The waking floor holds no face, so it refuses every content verb by naming the lift, BEFORE the cap
 * check, the mint or any registry write. Carrying and serving stay: `where`, `resolve`, the readers.
 *
 *   V1 — every ACTION verb refuses on the floor, and `ctx.cap` is never reached
 *   V2 — REPACK and the wiki-minting and composing verbs refuse the same way
 *   V3 — the refused set derives from the mesh table, so a verb added there cannot slip the floor
 *   control — with a face the real reactor registers (it fails on its own first line, not the floor's)
 */
import { describe, test, expect } from "vitest";
import { ACTION_VERBS, isVerbRefusal } from "@lararium/mesh";
import { operatorDaemonOptions } from "../src/operator-daemon-behavior.js";
import { VerbTable } from "@lararium/tw5";

const fakeCtx = () => ({
  composite: {} as never,
  repo:      {} as never,
  catalogUrl: "automerge:fakeCatalog",
  oracleUrl:  "automerge:fakeOracle",
  tw5:       {} as never,
  post:      () => {},
}) as never;

const manifest = (face: boolean) => ({
  daemonAuth: {
    vesselVerifyingKey: "a".repeat(64),
    registerBags: [],
    ...(face ? { personaGroupId: "ab".repeat(16) } : {}),
  },
}) as never;

const wire = (face: boolean) => {
  const registry = new VerbTable();
  operatorDaemonOptions(manifest(face)).wireWorkerVerbs?.(registry, fakeCtx());
  return registry;
};

const FLOOR = /waking floor|persona new 0/i;
const capCalls: unknown[] = [];
const verbCtx = () => ({
  daemon: {} as never,
  invocation: { requestId: "r1" } as never,
  cap: async (...a: unknown[]) => { capCalls.push(a); return { ok: true }; },
}) as never;

describe("the faceless floor refuses content verbs by name", () => {
  test("V1 — every ACTION verb refuses with the lift and reaches no cap", async () => {
    const registry = wire(false);
    capCalls.length = 0;
    expect(ACTION_VERBS.length).toBeGreaterThan(0);
    for (const v of ACTION_VERBS) {
      await expect(registry.get(v)!({}, verbCtx()), v).rejects.toThrow(FLOOR);
    }
    expect(capCalls).toEqual([]);
  });

  test("V2 — REPACK and the wiki mint and compose verbs refuse the same way", async () => {
    const registry = wire(false);
    for (const v of ["REPACK", "init-wiki", "add-bag", "remove-bag", "prune-stale"]) {
      await expect(registry.get(v)!({}, verbCtx()), v).rejects.toThrow(FLOOR);
    }
    expect(capCalls).toEqual([]);
  });

  test("V2b — the floor's refusal is a VerbRefusal named waking-floor, so a caller routes on the reason", async () => {
    const registry = wire(false);
    for (const v of [...ACTION_VERBS, "REPACK", "init-wiki", "circle-list", "circle-add"]) {
      const err = await registry.get(v)!({}, verbCtx()).catch((e: unknown) => e);
      expect(isVerbRefusal(err), v).toBe(true);
      expect((err as { reason: string }).reason, v).toBe("waking-floor");
      expect(String((err as Error).message), v).toMatch(FLOOR);
    }
  });

  test("V3 — the refused set covers the mesh table by iteration", () => {
    const registry = wire(false);
    for (const v of ACTION_VERBS) expect(registry.get(v), `${v} registered on the floor`).toBeTypeOf("function");
  });

  test("carrying and serving stay registered on the floor", () => {
    const registry = wire(false);
    for (const v of ["where", "resolve", "list-wikis", "open-wiki", "meme-get"]) {
      expect(registry.get(v), v).toBeTypeOf("function");
    }
  });

  test("control — with a face, CREATE is the real reactor, not the floor's refusal", async () => {
    const registry = wire(true);
    const err = await registry.get("CREATE")!({}, verbCtx()).catch((e: Error) => e);
    expect(String(err)).toMatch(/malformed args/);
    expect(String(err)).not.toMatch(FLOOR);
    await expect(registry.get("init-wiki")!({}, verbCtx())).rejects.not.toThrow(FLOOR);
  });
});
