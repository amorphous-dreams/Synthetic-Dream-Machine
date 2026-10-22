/**
 * kahu-reach-gate-envelope — a routed `wiki-act` carries its real destination and source INSIDE `args.args`, where the
 * gate's cap derivation never looks. The keyholder island's gate asks the Kahu predicate for each system canon bag the
 * envelope names (`routedInnerBags` -> `verifier.kahuReach`), and the wiki island it delegates to trusts that gate
 * (`kahuReachClearedAtGate`) because it holds no board and no sentinel.
 *
 * Proven: the envelope's system bags are named (destination and source), and a library bag mounts from the registry row or the realm's standing registration; CONTROLS: a user bag, a wiki slot and a
 * flat verb name none, and a wiki island composed with no gate flag still refuses a stranger by itself.
 */
import { describe, test, expect } from "vitest";
import type { Verb } from "@lararium/mesh";
import { BAG_IDS, bagUri } from "@lararium/mesh";
import { gateRoutedVerb, routedInnerBags } from "../src/verb-local-dispatch.js";
import { requireKahuReach, type CapabilityVerifier } from "@lararium/mesh";
import { kahuHand, strangerHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";
import { makeActionReactorFor } from "../src/action-handler.js";
import { libraryDocUrl, type CatalogAccessor } from "../src/catalog-accessor.js";
import { CompositeStore } from "@lararium/mesh";

const verb = (args: Record<string, unknown>): Verb => ({ requestId: "r", title: "t", action: "wiki-act", args, targets: [], batchMode: "best-effort", status: "pending", requestedBy: "test", requestedAt: "2026-10-21" } as unknown as Verb);

describe("a routed envelope's system bags reach the Kahu gate", () => {
  test("a MOVE names its destination and its source", () => {
    expect(routedInnerBags(verb({ verb: "MOVE", args: { "from-bag": BAG_IDS.lares, "to-bag": BAG_IDS.lararium } }))).toEqual([BAG_IDS.lararium, BAG_IDS.lares]);
  });
  test("CONTROLS: a user bag, a wiki slot and a flat verb name none", () => {
    expect(routedInnerBags(verb({ verb: "MOVE", args: { "from-bag": "lar:///ha.ka.ba/wikis/lares/working", "to-bag": bagUri("garden") } }))).toEqual([]);
    expect(routedInnerBags(verb({ "to-bag": BAG_IDS.lares }))).toEqual([]);
  });
  test("CONTROL: without the gate flag the action reactor asks itself and refuses a stranger", async () => {
    const reactor = makeActionReactorFor("ADD", { composite: new CompositeStore() });
    await expect(reactor({ title: "x", "from-bag": bagUri("garden"), "to-bag": BAG_IDS.lares, "change-id": "c" }, { daemon: new CompositeStore(), invocation: verb({}), cap: async () => ({ ok: true }) } as never))
      .rejects.toMatchObject({ reason: "kahu-reach" });
  });
});

describe("a recipe's library bag mounts from the registry row, else from the Kahu realm for a system bag", () => {
  const accessor = (rows: Record<string, string>, doc: unknown): CatalogAccessor => ({
    urlOf: async (bag) => rows[bag] ?? null,
    handle: async () => ({ doc: () => doc }) as never,
  }) as unknown as CatalogAccessor;

  test("a registry row wins; a user bag with no row reads null; a system bag with no realm standing reads null", async () => {
    const empty = accessor({ [bagUri("garden")]: "automerge:garden" }, { tiddlers: {} });
    expect(await libraryDocUrl(empty, bagUri("garden"))).toBe("automerge:garden");
    expect(await libraryDocUrl(empty, bagUri("orchard"))).toBeNull();
    expect(await libraryDocUrl(empty, BAG_IDS.lararium)).toBeNull();
  });
});

describe("the gate refuses a routed envelope that names system canon, from a hand outside the cabal", () => {
  const verifierOf = (source: Awaited<ReturnType<typeof kahuHand>> | undefined): CapabilityVerifier => ({
    verify: async () => ({ ok: true, reason: "inner" }),
    kahuReach: (bag, act) => requireKahuReach(bag, source, act),
  });
  const mv = (to: string, extra: Record<string, unknown> = {}) => verb({ verb: "MOVE", args: { "from-bag": "lar:///ha.ka.ba/wikis/lares/working", "to-bag": to, ...extra } });

  test("RED: a wiki-act MOVE into bags/lares from a stranger, and from a vessel with no source, refuses at the gate", async () => {
    await expect(gateRoutedVerb(mv(BAG_IDS.lares), verifierOf(await strangerHand("admitted-not-joined")), "p", true)).rejects.toMatchObject({ reason: "kahu-reach" });
    await expect(gateRoutedVerb(mv(BAG_IDS.lares), verifierOf(undefined), "p", true)).rejects.toMatchObject({ reason: "kahu-reach" });
  });
  test("CONTROLS: the Kahu hand passes; a user bag passes for a stranger", async () => {
    await expect(gateRoutedVerb(mv(BAG_IDS.lares), verifierOf(await kahuHand()), "p", true)).resolves.toBeUndefined();
    await expect(gateRoutedVerb(mv(bagUri("garden")), verifierOf(await strangerHand("admitted-not-joined")), "p", true)).resolves.toBeUndefined();
  });
  test("a clearance claim carried inside the envelope lifts nothing: the gate and the reactor both ignore it", async () => {
    const claim = { kahuReachClearedAtGate: true, "kahu-reach-cleared": true };
    await expect(gateRoutedVerb(mv(BAG_IDS.lares, claim), verifierOf(await strangerHand("admitted-not-joined")), "p", true)).rejects.toMatchObject({ reason: "kahu-reach" });
    const reactor = makeActionReactorFor("ADD", { composite: new CompositeStore() });
    await expect(reactor({ title: "x", "from-bag": bagUri("garden"), "to-bag": BAG_IDS.lares, "change-id": "c", ...claim }, { daemon: new CompositeStore(), invocation: verb({}), cap: async () => ({ ok: true }) } as never))
      .rejects.toMatchObject({ reason: "kahu-reach" });
  });
});
