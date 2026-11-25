/**
 * The registered bag set is the UNION over the PersonaGroups a vessel stands in.
 *
 * THE AXIS: joined-or-not. A vessel in no PersonaGroup stays an anonymous dyad and carries its own ground.
 * A vessel standing in a group carries that group's work — private and contracted alike, because a fleet that
 * syncs a person's bags to some of their devices and not others has not synced them.
 *
 * AND A VESSEL HOLDS SEVERAL. A human runs more than one PersonaGroup, and the same laptop and phone may
 * carry more than one of them — so the tests drive one group, several, and none. A model that answered
 * only the first would freeze today's boot path into the ontology.
 *
 * WHY A MISSING BAG COSTS SOMETHING. Keyhive's bag→doc map lives in process memory, so a bag absent from
 * this set can never satisfy a cap check — no throw, no warning, an `act LOAD` that refuses forever, on
 * the vessel a person most often carries.
 */
import { describe, expect, test } from "vitest";

import { catalogFaceSlotBags, catalogNamedBags, deriveRegisterBags, isFaceSlotBag, isVesselGround, litFaceOwnBags, wornFaceWikiBags, type FleetMembership } from "../src/register-bags.js";
import { wikiBagUri, wikiSlotUri } from "../src/wiki-recipe.js";
import { personaBagIdFor } from "../src/persona-scope.js";
import { BAG_IDS, DAEMON_BAG_ID, PERSONA_NAMESPACE, recipeUri } from "../src/lar-uris.js";
import { personaScopedBagIds, personaTagFromBagId, personaSiblingBagIds, isFaceScopedBag, faceTagOfBag } from "../src/persona-scope.js";

const WIKI = ["lar:///ha.ka.ba/bags/my-wiki", "lar:///ha.ka.ba/bags/my-wiki/draft"];
const WORK = ["lar:///ha.ka.ba/bags/elyncia", "lar:///ha.ka.ba/bags/notes"];
const PLAY = ["lar:///ha.ka.ba/bags/discordia"];

const standingIn = (id: string, catalogNamed?: readonly string[]): FleetMembership =>
  ({ personaGroupId: id, ...(catalogNamed ? { catalogNamed } : {}) });

describe("the ground every vessel stands on", () => {
  test("the substrate bags ride the ground, so no vessel can lose them by standing in nothing", () => {
    // The drift this ends: one opener registered the shared substrate bag and its catalog, the other
    // registered neither, and the second could not satisfy a cap check over its own operator's bags.
    const bags = deriveRegisterBags({ fleets: [] });
    expect(bags).toEqual(expect.arrayContaining([DAEMON_BAG_ID, BAG_IDS.catalog, BAG_IDS.oracle]));
  });

  test("★ the live system bags are NOT ground — only a vessel the Kahu cabal admitted registers them (W26 slice 3) ★", () => {
    // `lares` and `lararium` rest in the Kahu realm: a vessel outside the cabal holds neither document, so it registers
    // neither bag and its caps over them never form. They stay VESSEL-ground in kind (the daemon's own key holds them).
    for (const bag of [BAG_IDS.lares, BAG_IDS.lararium]) {
      expect(deriveRegisterBags({ fleets: [] })).not.toContain(bag);
      expect(deriveRegisterBags({ fleets: [standingIn("g1")], wikiBags: WIKI })).not.toContain(bag);
      expect(deriveRegisterBags({ fleets: [], systemCanon: true })).toContain(bag);       // CONTROL
      expect(isVesselGround(bag)).toBe(true);
    }
  });

  test("RED: a face outside the cabal that stands a house canon wiki registers that wiki's slots and never its canon bag", () => {
    // The active wiki's own canon bag rides `wikiBags` (`wornFaceWikiBags`). Where that wiki composes house canon (`lares`), the
    // bag's live document rests in the Kahu realm: a face the cabal never admitted that registered the bag id held a read cap
    // by name over a document it holds no seat in, so `meme get --bag lares` read the live document where the floor answers.
    const slots = ["lar:///ha.ka.ba/wikis/lares/working", "lar:///ha.ka.ba/wikis/lares/draft"];
    const outside = deriveRegisterBags({ fleets: [standingIn("g1")], wikiBags: [BAG_IDS.lares, ...slots] });
    expect(outside).not.toContain(BAG_IDS.lares);
    for (const slot of slots) expect(outside).toContain(slot);
    // CONTROLS: the admitted vessel registers it; a wiki whose canon carries no house canon registers its own bag as before.
    expect(deriveRegisterBags({ fleets: [standingIn("g1")], wikiBags: [BAG_IDS.lares, ...slots], systemCanon: true })).toContain(BAG_IDS.lares);
    expect(deriveRegisterBags({ fleets: [standingIn("g1")], wikiBags: WIKI })).toEqual(expect.arrayContaining(WIKI));
  });

  test("★ a face's relations are NOT ground — a vessel standing in nothing carries no one's circles ★", () => {
    // A single vessel-wide circles plane would put one persona's blocked list in the same document as another's
    // follows, where anything reading it correlates the faces a multitude exists to hold apart. So the
    // three planes that travel with a face arrive through a MEMBERSHIP, exactly as the persona plane does.
    const bags = deriveRegisterBags({ fleets: [] });
    for (const stem of ["circles", "identities", "sessions", "intents"]) {
      expect(bags.some((b) => b.includes(stem))).toBe(false);
    }
  });

  test("★ standing in a group brings the WHOLE face, all four planes sharing ONE tag ★", () => {
    const bags = deriveRegisterBags({ fleets: [standingIn("g1")] });
    const face = personaScopedBagIds("g1");
    for (const b of [face.persona, face.circles, face.identities, face.sessions, face.intents]) expect(bags).toContain(b);
    // The tag is what binds them: read it off the persona plane and the other three follow from it.
    const tag = personaTagFromBagId(face.persona);
    expect(tag).not.toBeNull();
    for (const b of [face.circles, face.identities, face.sessions, face.intents]) expect(b.endsWith(`-${tag}`)).toBe(true);
  });

  test("★ two faces on one vessel keep DISJOINT sets — no plane is shared between them ★", () => {
    const a = personaScopedBagIds("g1");
    const b = personaScopedBagIds("g2");
    const setA = new Set([a.persona, a.circles, a.identities, a.sessions, a.intents]);
    for (const id of [b.persona, b.circles, b.identities, b.sessions, b.intents]) expect(setA.has(id)).toBe(false);
    // and a vessel standing in both registers all eight, none collapsing into another
    const bags = deriveRegisterBags({ fleets: [standingIn("g1"), standingIn("g2")] });
    for (const id of [...setA, b.persona, b.circles, b.identities, b.sessions, b.intents]) expect(bags).toContain(id);
  });

  test("★ an anon dyad stands in no group, so it carries NO persona plane and no one's work ★", () => {
    const bags = deriveRegisterBags({ fleets: [], wikiBags: WIKI });
    expect(bags.some((b) => b.includes("persona"))).toBe(false);
    for (const b of [...WORK, ...PLAY]) expect(bags).not.toContain(b);
    expect(bags).toEqual(expect.arrayContaining(WIKI));   // its own wiki still stands
  });

  test("a Herm carries no wiki, so it registers none — blind by structure, never by a flag", () => {
    expect(deriveRegisterBags({ fleets: [standingIn("g1")] }).some((b) => b.includes("@my-wiki"))).toBe(false);
  });
});

describe("one PersonaGroup", () => {
  test("standing in a group brings its plane and every bag its catalog names", () => {
    const bags = deriveRegisterBags({ fleets: [standingIn("g1", WORK)], wikiBags: WIKI });
    expect(bags).toContain(personaBagIdFor("g1"));
    for (const b of WORK) expect(bags).toContain(b);
  });

  test("★ how the membership ARRIVED changes nothing — a founder's own laptop carries their work ★", () => {
    // The correction this encodes: founded-versus-admitted decides whose signature stands behind a
    // binding, never which bags are the person's. A model that withheld a founder's catalog would have
    // left the vessel that MINTED a bag unable to open it.
    const asFounder  = deriveRegisterBags({ fleets: [standingIn("g1", WORK)] });
    const asAdmitted = deriveRegisterBags({ fleets: [standingIn("g1", WORK)] });
    expect(asFounder).toEqual(asAdmitted);
  });
});

describe("★ A PLANE CARRIES ONE NAME EVERYWHERE ★", () => {
  // The failure this forbids: a plane registered under one spelling while the composite, the oracle
  // registry and the admit payload reach it by another. keyhive hashes the bag URL to SEED the Document
  // behind it, so a second spelling is a second document no later aliasing reconciles — and the plane a
  // vessel actually stands in would answer no cap check, with no throw and no warning.
  test("★ every plane registers under its DERIVED name — the deictic reaches no map ★", () => {
    const bags = deriveRegisterBags({ fleets: [standingIn("work"), standingIn("play")] });
    expect(bags).toContain(personaBagIdFor("work"));
    expect(bags).toContain(personaBagIdFor("play"));
    expect(bags).not.toContain(PERSONA_NAMESPACE);
  });

  test("★ no plane ever carries two names — two planes, two names, never four ★", () => {
    const bags = deriveRegisterBags({ fleets: [standingIn("work"), standingIn("play")] });
    expect(bags.filter((b) => b.includes("persona"))).toHaveLength(2);
  });
});

describe("★ SEVERAL groups on one vessel — a work compartment and a play compartment, one laptop ★", () => {
  test("★ each group gets its OWN persona plane, so the second compartment has somewhere to stand ★", () => {
    // Collapse the two planes back to one constant and both groups write their multitude, signer pin and
    // device edge into one document — the work self and the play self fused inside the vessel that was
    // supposed to keep them apart.
    const bags = deriveRegisterBags({ fleets: [standingIn("work"), standingIn("play")] });
    expect(bags).toContain(personaBagIdFor("work"));
    expect(bags).toContain(personaBagIdFor("play"));
    expect(personaBagIdFor("work")).not.toBe(personaBagIdFor("play"));
  });

  test("the set is the UNION, so each group's work arrives", () => {
    const bags = deriveRegisterBags({ fleets: [standingIn("work", WORK), standingIn("play", PLAY)], wikiBags: WIKI });
    for (const b of [...WORK, ...PLAY]) expect(bags).toContain(b);
  });

  test("two groups naming a bag in common register it once", () => {
    const shared = ["lar:///ha.ka.ba/bags/shared"];
    const bags = deriveRegisterBags({ fleets: [standingIn("work", shared), standingIn("play", shared)], systemCanon: true });
    expect(bags.filter((b) => b === shared[0])).toHaveLength(1);
    expect(bags.filter((b) => b === BAG_IDS.lararium)).toHaveLength(1);
  });

  test("joining another group only ever WIDENS — no group can take another's bags away", () => {
    const one = new Set(deriveRegisterBags({ fleets: [standingIn("work", WORK)] }));
    const two = deriveRegisterBags({ fleets: [standingIn("work", WORK), standingIn("play", PLAY)] });
    for (const b of one) expect(two).toContain(b);
  });
});

describe("no platform appears in the answer", () => {
  test("the same groups yield the same set whichever vessel asks", () => {
    const fleets = [standingIn("work", WORK), standingIn("play")];
    expect(deriveRegisterBags({ fleets, wikiBags: WIKI })).toEqual(deriveRegisterBags({ fleets, wikiBags: WIKI }));
  });
});

describe("★ the registry admits only its OWN kind ★", () => {
  const rec = (title: string, text: string) => ({ tiddler: { title, text }, meta: { authority: "t" } });
  const catalog = {
    tiddlers: {
      "lar:///ha.ka.ba/bags/notes":                       rec("lar:///ha.ka.ba/bags/notes", "automerge:aaa"),
      // A wiki slot's per-device draft pointer: same title prefix, same automerge text, NOT a bag.
      "lar:///ha.ka.ba/wikis/notes/drafts/did:key:z6Mk":   rec("lar:///ha.ka.ba/wikis/notes/drafts/did:key:z6Mk", "automerge:bbb"),
      "lar:///ha.ka.ba/wikis/notes":                       rec("lar:///ha.ka.ba/wikis/notes", "automerge:ccc"),
      "lar:///ha.ka.ba/bags/notes/recipes/default":        rec("lar:///ha.ka.ba/bags/notes/recipes/default", "automerge:ddd"),
      "lar:///ha.ka.ba/bags/never-minted":                 rec("lar:///ha.ka.ba/bags/never-minted", ""),
    },
  } as unknown as Parameters<typeof catalogNamedBags>[0];

  test("★ a wiki slot pointer is NOT registered as a bag ★", () => {
    // It carries a lar title and an automerge url, indistinguishable from a bag entry by shape alone.
    // Registering it mints a Keyhive Document for a thing that is not a bag, and nothing throws.
    const named = catalogNamedBags(catalog);
    expect(named).toContain("lar:///ha.ka.ba/bags/notes");
    expect(named).not.toContain("lar:///ha.ka.ba/wikis/notes/drafts/did:key:z6Mk");
    expect(named).not.toContain("lar:///ha.ka.ba/wikis/notes");
  });

  test("a tiddler INSIDE a bag is not a bag either — only the bag surface counts", () => {
    expect(catalogNamedBags(catalog)).not.toContain("lar:///ha.ka.ba/bags/notes/recipes/default");
  });

  test("an entry that never minted stays skipped — a doc that cannot resolve is not registered", () => {
    expect(catalogNamedBags(catalog)).not.toContain("lar:///ha.ka.ba/bags/never-minted");
  });
});

describe("a group registers its own four planes and never another face's, by the derived shape", () => {
  test("RED: the catalog names another face's plane bags and no list of faces is consulted: they stay out; CONTROL: ordinary catalog bags and the group's own four register", () => {
    const mine = "ab".repeat(16), theirs = "cd".repeat(16);
    const other = personaScopedBagIds(theirs);
    const own = personaScopedBagIds(mine);
    const bags = deriveRegisterBags({ fleets: [{ personaGroupId: mine, catalogNamed: [...WORK, other.persona, other.circles, other.identities, other.sessions, other.intents, own.circles] }] });
    for (const foreign of [other.persona, other.circles, other.identities, other.sessions, other.intents]) expect(bags, foreign).not.toContain(foreign);
    for (const bag of [...WORK, own.persona, own.circles, own.identities, own.sessions, own.intents]) expect(bags, bag).toContain(bag);
  });
  test("RED: an intents bag takes only a full lowercase 16-hex tag; CONTROL: its sibling set and wiki bag resolve", () => {
    const tag = "a1".repeat(8);
    const id = `lar:///ha.ka.ba/bags/intents-${tag}`;
    expect(isFaceScopedBag(id)).toBe(true);
    expect(faceTagOfBag(id)).toBe(tag);
    expect(personaSiblingBagIds(`lar:///ha.ka.ba/bags/persona-${tag}`)?.intents).toBe(id);
    for (const malformed of ["intents-xyz", `intents-${tag.slice(1)}`]) {
      expect(isFaceScopedBag(`lar:///ha.ka.ba/bags/${malformed}`)).toBe(false);
      expect(faceTagOfBag(`lar:///ha.ka.ba/bags/${malformed}`)).toBeNull();
    }
    expect(isFaceScopedBag(WIKI[0]!)).toBe(false);
  });
});

describe("the boot's register set carries every layer the worn face's catalog announces", () => {
  const row = (title: string, meta: Record<string, unknown> = {}) => ({ tiddler: { title, text: "" }, meta: { authority: "t", ...meta } });
  const catalogOf = (...slugs: string[]) => ({ tiddlers: Object.fromEntries(slugs.map((slug) => [recipeUri("catalog", slug), row(recipeUri("catalog", slug))])) }) as unknown as Parameters<typeof catalogFaceSlotBags>[0];
  const SLOT = { wikiBagId: wikiBagUri("lares"), workingBagId: wikiSlotUri("lares", "working"), draftBagId: wikiSlotUri("lares", "draft") };
  const layers = (slug: string) => [wikiSlotUri(slug, "personal"), wikiSlotUri(slug, "draft")];

  test("each wiki the catalog names by its recipe row announces its personal layer and its draft; a working layer, the daemon wiki and a tombstoned row announce none", () => {
    const catalog = { tiddlers: {
      [recipeUri("catalog", "notes")]: row(recipeUri("catalog", "notes")),
      [recipeUri("catalog", "daemon")]: row(recipeUri("catalog", "daemon")),
      [recipeUri("catalog", "burned")]: row(recipeUri("catalog", "burned"), { deleted: true }),
      [`${recipeUri("catalog", "notes")}/inner`]: row("inner"),
      "lar:///ha.ka.ba/bags/notes": row("lar:///ha.ka.ba/bags/notes"),
    } } as unknown as Parameters<typeof catalogFaceSlotBags>[0];
    expect(catalogFaceSlotBags(catalog)).toEqual(layers("notes"));
    expect(catalogFaceSlotBags(null)).toEqual([]);
  });

  test("the mount's own personal layer rides the lit face's set with no catalog row and no naming; the floor registers none", () => {
    expect(wornFaceWikiBags({ slot: SLOT, lit: true }).registered).toContain(wikiSlotUri("lares", "personal"));
    expect(wornFaceWikiBags({ slot: SLOT, lit: true }).sealed).toContain(wikiSlotUri("lares", "personal"));
    expect(wornFaceWikiBags({ slot: SLOT, lit: false }).registered).not.toContain(wikiSlotUri("lares", "personal"));
    expect(wornFaceWikiBags({ slot: SLOT, lit: false, announced: catalogFaceSlotBags(catalogOf("notes")) }).registered).toEqual([SLOT.wikiBagId, SLOT.workingBagId, SLOT.draftBagId]);
  });

  test("TWO FACES LIT: the worn face's set carries the layers its own catalog announces and none a sibling's catalog names; the sibling's own set carries no wiki's layer", () => {
    const wornCatalog = catalogOf("notes"), siblingCatalog = catalogOf("ledger");
    const worn = deriveRegisterBags({ fleets: [{ personaGroupId: "ab".repeat(16) }], wikiBags: wornFaceWikiBags({ slot: SLOT, lit: true, announced: catalogFaceSlotBags(wornCatalog) }).registered });
    for (const bag of [...layers("lares"), ...layers("notes")]) expect(worn, bag).toContain(bag);
    for (const bag of catalogFaceSlotBags(siblingCatalog)) expect(worn, bag).not.toContain(bag);
    // The sibling registers what a lit face owns beside the worn one (`joined-face-auth`): no user wiki's personal layer or draft.
    const sibling = deriveRegisterBags({ fleets: [], wikiBags: litFaceOwnBags("0a1b2c3d-0a1b-4a1b-8a1b-0a1b2c3d4e5f") });
    expect(sibling.filter(isFaceSlotBag)).toEqual([]);
    for (const bag of [...layers("lares"), ...layers("notes"), ...layers("ledger")]) expect(sibling, bag).not.toContain(bag);
  });
});
