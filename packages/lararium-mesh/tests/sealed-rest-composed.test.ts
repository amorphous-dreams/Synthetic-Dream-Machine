/**
 * sealed-rest-composed — a census of the production composition (sealed-store#/owed, R1 and R2): each vessel's own
 * Repo stands on the sealed rest, each daemon island answers the document store's door beside its holder, and the
 * node island hands its seat the fresh base's cut. Behaviour reads in `sealed-rest.test.ts` (the door over a modelled
 * key shore) and `packages/lararium-node/tests/sealed-rest-vessel.test.ts` (a real founded island); this census pins
 * the call sites a rename or a revert would drop.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { litFaceOwnBags, DAEMON_WIKI_SLOT_BAGS, FACE_CATALOG_BAG_ID, daemonFaceCanonBag, selvesRecordOf } from "../src/index.js";

const stripped = (path: readonly string[]): string => {
  const source = readFileSync(join(import.meta.dirname, "..", "..", ...path), "utf8");
  const out = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // THE STRIP LEFT SOMETHING: a file stripped to nothing would green every absence.
  expect(out.length).toBeGreaterThan(1_000);
  return out;
};
const count = (text: string, pattern: RegExp): number => (text.match(new RegExp(pattern.source, "g")) ?? []).length;

describe("each vessel's Repo stands on the sealed rest", () => {
  it("the node's standing vessel composes its Repo over the sealed rest, and its lock flushes before a signer drops", () => {
    const node = stripped(["lararium-node", "src", "open-node-vessel.ts"]);
    expect(count(node, /composeSealedRest(<[^>]*>)?\(/)).toBe(1);
    // The Repo takes the sealed rest through its wire face (`wireIdentityOf`: the worn face's store id over the same store).
    expect(node).toMatch(/wireIdentityOf\(\{\s*store:\s*sealedRest\.store,/);
    // The node's Repo wraps that rest in `compactingStorage` (every document compacts by count and bytes, never by clock).
    expect(node).toMatch(/new Repo\(\{\s*storage:\s*compactingStorage\(wire\.storage,[\s\S]{0,800}?\}\),\s*peerId:\s*wire\.peerId,/);
    const uds = stripped(["lararium-node", "src", "uds-channel.ts"]);
    expect(uds).toMatch(/await opts\.beforeSignerDrops\?\.\(/);
  });

  it("the browser's vessel worker composes its Repo over the sealed rest, and its lock flushes before the lift drops", () => {
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(count(browser, /composeSealedRest(<[^>]*>)?\(/)).toBe(1);
    expect(browser).toMatch(/wireIdentityOf\(\{\s*store:\s*sealedRest\.store,/);
    expect(browser).toMatch(/new Repo\(\{\s*storage:\s*wire\.storage,\s*peerId:\s*wire\.peerId,/);
    // The lift drops its signer through its own dispose (slice 5b: the lift stack's dispose IS the lock).
    expect(browser).toMatch(/await sealedRest\.lock\(\)[\s\S]{0,600}await lifted\.dispose\(\)/);
  });

  it("the browser derives registration and live announced-slot sealing through the mesh bag classification", () => {
    const browser = stripped(["lararium-browser", "src", "open-browser-vessel.ts"]);
    expect(browser).toMatch(/wikiBags:\s*\[\s*\.\.\.wornFaceWikiBags\(\{[\s\S]*?announced:\s*catalogFaceSlotBags\(catalogHandle\.doc\(\)\)[\s\S]*?\}\)\.registered/);
    expect(browser).toMatch(/sealedCells\.bags = \(\) => wornFaceWikiBags\(\{[\s\S]*?announced:\s*slotDocsNamed\.keys\(\)[\s\S]*?\}\)\.sealed/);
  });

  it("each daemon island answers the document store's door beside its holder", () => {
    expect(stripped(["lararium-node", "src", "node-daemon-island.ts"])).toMatch(/docStoreDoor\s*:/);
    expect(stripped(["lararium-browser", "src", "daemon-island-start.ts"])).toMatch(/docStoreDoor\s*:/);
    expect(stripped(["lararium-keyhive", "src", "operator-daemon-behavior.ts"])).toMatch(/answerDocStoreAsks\(/);
  });
});

describe("the node holds the lit set (sealed-store#/the-lit-set)", () => {
  it("each sibling stands its own place session in the book, its own canon and bases keeper; a lock drops its waiting saves and handles", () => {
    const node = stripped(["lararium-node", "src", "open-node-vessel.ts"]);
    expect(node).toMatch(/const litSibling = async \(entry: JoinedFaceAuth, live: \(\) => boolean\): Promise<void> => \{[\s\S]{0,900}await standSiblingSession\(\{ group, atomKey: entry\.atom\.key \}, current, entry\.deviceEdge\.personaRootDid\)/);
    expect(node).toMatch(/for \(const sibling of siblingSessions\.values\(\)\) sibling\.seat\.book\(book\)/);
    expect(node).toMatch(/standFaceDaemonCanon\(\{ repo, control, faceRelation: relation/);
    expect(node).toMatch(/siblingBasesKeepers\.set\(group, keepFaceBases\(/);
    // A closed face forgets its saves, a refused one keeps them: the choice lives in `settleFaceSaves` (face-lend.ts), the teardown hands it both doors.
    expect(node).toMatch(/settleFaceSaves\(owned, why, \{ forget: \(ids\) => sealedRest\.forget\(ids\), keep: \(ids\) => sealedRest\.keep\(ids\) \}\);[\s\S]{0,120}repo\.removeFromCache\(/);
    const lend = stripped(["lararium-node", "src", "face-lend.ts"]);
    expect(lend).toMatch(/if \(why === "refused"\) return \{ dropped: 0, held: rest\.keep\(owned\) \};\s*return \{ dropped: rest\.forget\(owned\), held: 0 \};/);
    expect(node).toMatch(/sealedRest\.watch\(repo, standingSaveSessionFor\)/);
    expect(node).toMatch(/openFaces: openFaceSubjects/);
  });

  it("the island resolves each lit face's own slots and lands a face-named wave there", () => {
    const island = stripped(["lararium-keyhive", "src", "operator-daemon-behavior.ts"]);
    expect(island).toMatch(/faceTarget: litFaceTargetOf\(ctx\)/);
    expect(island).toMatch(/litSiblings\.set\(key, face\)/);
  });

  // BEHAVIOUR, NOT A CALL SITE: what a lit sibling's hive registers reads off `litFaceOwnBags` itself (the node's
  // `joined-face-auth.test.ts` pins that `joinedFaceAuth` hands each sibling exactly this set, by its own group).
  it("a lit face's own bags carry its daemon slots, its canon, its catalog half and its own selves record, never another face's", () => {
    const relation = "11111111-1111-4111-8111-111111111111";
    const own = litFaceOwnBags(relation, "group-own");
    expect(own).toEqual(expect.arrayContaining([...DAEMON_WIKI_SLOT_BAGS, daemonFaceCanonBag(relation), FACE_CATALOG_BAG_ID, selvesRecordOf("group-own").bagId]));
    expect(own).not.toContain(selvesRecordOf("group-other").bagId);
    expect(litFaceOwnBags(null).some((b) => b.includes("/selves-")), "no group, no selves record").toBe(false);
  });
});
