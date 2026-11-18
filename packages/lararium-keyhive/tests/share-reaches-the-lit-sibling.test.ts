/**
 * share-reaches-the-lit-sibling — the daemon island's share landing reaches a lit sibling without opening its sealed half.
 *
 * A face's catalog half rests sealed under that face's own content key, and the island's one holder carries the worn
 * face's. The landing asked for each lit sibling's half by address, waited the document bound on each (`[share-apply] h1's
 * catalog half unreached in 60007ms`) and answered `landed: 0 grant(s); 2 wait for a shut face` with every face open
 * (walked, 0dd4659ff). The behaviour of the carry and the lift lives in `share-apply.test.ts` (SA4, SA5); the walked hearth
 * proves the door. This reads the composition (static: the wiring lives in one function body):
 *
 *   W1 RED  the verb names NO catalog document for a lit sibling, hands the landing a carry over the control document,
 *           and the worn face's stand lifts what carried
 *   W2 RED  a lit sibling's hive hands the worn hive the cap events it delegated to it, at the sibling's light
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const island = readFileSync(new URL("../src/operator-daemon-behavior.ts", import.meta.url), "utf8");

describe("the share landing reaches a lit sibling", () => {
  test("W1 RED (static): a lit sibling names no catalog half, the landing carries, and the wear lifts", () => {
    const verb = island.slice(island.indexOf('registry.register("share-apply"'), island.indexOf("workbench: async (row, owner, members)"));
    expect(verb, "a sibling's half never rides a document find").toMatch(/litByIndex\.set\(entry\.handleIndex, \{ group: entry\.personaGroupId, catalogUrl: null \}\)/);
    expect(verb).not.toMatch(/faceCatalogDocUrl/);
    expect(verb).toMatch(/carry: shareCarryOver\(control\)/);
    const stand = island.slice(island.indexOf("THE WEAR LIFTS WHAT CARRIED"), island.indexOf('registry.register("share-apply"'));
    expect(stand, "the worn face's stand lifts the carried rows into its own half").toMatch(/liftCarriedShares\(\{ group,/);
  });

  test("W2 RED (static): the sibling's light hands the worn hive the sibling's cap events for it", () => {
    const light = island.slice(island.indexOf("const lightJoinedFace = async"), island.indexOf("THE LIFT'S RE-REGISTRATION"));
    expect(light).toMatch(/joined\.keyhive\.receiveContactCard\(await worn\.contactCard\(\)\)/);
    expect(light).toMatch(/worn\.ingestPeerEvents\(await joined\.keyhive\.eventsForPeer\(id\)\)/);
  });
});
