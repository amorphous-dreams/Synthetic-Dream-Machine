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
  test("ordinary destination and source bags also reach the gate", () => {
    // RED today: the gate filters out all ordinary bags before checking them.
    expect(routedInnerBags(verb({ verb: "MOVE", args: { "from-bag": "lar:///ha.ka.ba/wikis/lares/working", "to-bag": bagUri("garden") } }))).toEqual([bagUri("garden"), "lar:///ha.ka.ba/wikis/lares/working"]);
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

test("the gate hands the presenter to the verifier's Kahu predicate", async () => {
  const seen: unknown[][] = [];
  const verifier: CapabilityVerifier = { verify: async () => ({ ok: true }), kahuReach: async (...args: unknown[]) => { seen.push(args); } };
  await gateRoutedVerb(verb({ verb: "MOVE", args: { "from-bag": "lar:///ha.ka.ba/wikis/lares/working", "to-bag": BAG_IDS.lares } }), verifier, "sibling-atom", true);
  expect(seen).toEqual([[BAG_IDS.lares, "wiki-act", "sibling-atom"]]);
});


test.each(["from-bag", "to-bag"])("the routed gate verifies an ordinary inner %s", async (field) => {
  const source = "lar:///ha.ka.ba/wikis/home/working";
  const destination = bagUri("garden");
  const seen: string[] = [];
  const verifier: CapabilityVerifier = { verify: async ({ bagUrl }) => {
    seen.push(bagUrl);
    return { ok: bagUrl !== source && bagUrl !== destination, reason: "no grant" };
  } };
  // CONTROL: an envelope with no denied inner bag routes through the outer cap.
  await expect(gateRoutedVerb(verb({ verb: "CLEAR", args: {} }), verifier, "mounted", true)).resolves.toBeUndefined();
  expect(seen.length).toBeGreaterThan(0);
  // RED today: only the outer cap and system-canon inner bags reach this gate.
  const inner = { [field]: field === "from-bag" ? source : destination };
  await expect(gateRoutedVerb(verb({ verb: "MOVE", args: inner }), verifier, "mounted", true)).rejects.toThrow(/capability denied/);
});


describe("Sol's read (slice 4): the gate derives each inner bag's grade from the act it parses", () => {
  const recording = () => {
    const seen: Array<[string, string]> = [];
    const kahu: string[] = [];
    const verifier: CapabilityVerifier = {
      verify: async ({ bagUrl, access }) => { seen.push([bagUrl, access]); return { ok: true }; },
      kahuReach: async (bag) => { kahu.push(bag); },
    };
    return { seen, kahu, verifier };
  };
  const wikiAct = (inner: Record<string, unknown>, innerVerb: string) =>
    ({ requestId: "r", title: "t", action: "wiki-act", requestedBy: "mounted", args: { wiki: "home", verb: innerVerb, args: inner } }) as never;

  test("RED: a bag named as both source and destination takes the stronger grade; a MOVE's source is admin", async () => {
    const B = bagUri("garden");
    const a = recording();
    await gateRoutedVerb(wikiAct({ bag: B, "from-bag": B }, "CLEAR"), a.verifier, "mounted", true);
    expect(a.seen.filter(([bag]) => bag === B).map(([, access]) => access)).toContain("admin");
    expect(a.seen.some(([bag, access]) => bag === B && access === "read")).toBe(false);
    const m = recording();
    await gateRoutedVerb(wikiAct({ "from-bag": B, "to-bag": bagUri("orchard") }, "MOVE"), m.verifier, "mounted", true);
    expect(m.seen.find(([bag]) => bag === B)?.[1], "a MOVE deletes at its source").toBe("admin");
  });

  test("RED: a COPY out of canon asks no Kahu hand for its source; a MOVE out of canon does", async () => {
    const c = recording();
    await gateRoutedVerb(wikiAct({ "from-bag": BAG_IDS.lares, "to-bag": bagUri("garden") }, "COPY"), c.verifier, "mounted", true);
    expect(c.kahu).toEqual([]);
    expect(c.seen.find(([bag]) => bag === BAG_IDS.lares)?.[1], "a copy reads its source").toBe("read");
    const m = recording();
    await gateRoutedVerb(wikiAct({ "from-bag": BAG_IDS.lares, "to-bag": bagUri("garden") }, "MOVE"), m.verifier, "mounted", true);
    expect(m.kahu).toEqual([BAG_IDS.lares]);
  });
});
