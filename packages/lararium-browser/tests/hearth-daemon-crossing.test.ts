/**
 * hearth-daemon-crossing (road row `L4f`) — a joined page at its own hearth opens the hearth's daemon working document
 * through the widened carriage, and a guest page opens none.
 *
 * The face's signed log names the document for this device (`hearthDaemons`, a root-signed `device-edge` act). The crossing
 * opens it only at the vessel's own hearth, and the share verdict lets that one vessel-only document reach the relay under
 * the crossing's gate. Reds: the proven name reads for this device alone; the own-hearth gate federates the document once
 * the crossing opens it; the share verdict hands that document to the gate where every other vessel-only document stays
 * off the wire. Controls: a guest page (a foreign pin, a vessel with no device edge, a vessel that founded its own face)
 * opens none; a reserved document (the oracle, a board) and a torn url open none; a sibling and a wiki island read nothing.
 */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl, type DocumentId } from "@automerge/automerge-repo";
import { crossroadsDocUrl, makeVesselOnlyDocs, oracleGenesisDocUrl } from "@lararium/mesh";
import { hearthCrossingOf, provenHearthDaemon } from "../src/hearth-canon.js";
import { browserShareConfig } from "../src/open-browser-vessel.js";

const NEXUS = "ab".repeat(32);
const HEARTH_KEY = "cd".repeat(32), FOREIGN_KEY = "ef".repeat(32);
const DEVICE = "a7".repeat(32), OTHER_DEVICE = "b8".repeat(32);
const WORKING = generateAutomergeUrl();
const idOf = (url: string) => interpretAsDocumentId(url as AutomergeUrl) as DocumentId;
const at = (over: Partial<Parameters<typeof hearthCrossingOf>[0]> = {}) => hearthCrossingOf({
  pinnedGatePubKey: HEARTH_KEY, hearthGatePubKey: HEARTH_KEY, holdsDeviceEdge: true, hearthCanonDocs: {}, nexusPubkey: NEXUS, ...over,
});

describe("the face's signed log names the hearth's daemon document for this device", () => {
  test("RED: the name reads for the device the log names it under; CONTROL: another device, an empty log and a torn url read none", () => {
    const projection = { hearthDaemons: { [DEVICE]: WORKING, [OTHER_DEVICE]: "automerge:not-a-document" } };
    expect(provenHearthDaemon(projection, DEVICE)).toBe(WORKING);
    expect(provenHearthDaemon(projection, DEVICE.toUpperCase())).toBe(WORKING);
    expect(provenHearthDaemon(projection, OTHER_DEVICE)).toBeNull();
    expect(provenHearthDaemon(projection, "c9".repeat(32))).toBeNull();
    expect(provenHearthDaemon({ hearthDaemons: {} }, DEVICE)).toBeNull();
  });
});

describe("the own-hearth crossing opens the hearth's daemon document", () => {
  test("RED: a joined page at its own hearth opens the document, and the gate federates it from then on", async () => {
    const own = at();
    expect(await own.gate!.mayFederate(idOf(WORKING))).toBe(false);   // nothing crosses before the face proof names it
    expect(own.openHearthDaemon(WORKING)).toBe(idOf(WORKING));
    expect(await own.gate!.mayFederate(idOf(WORKING))).toBe(true);
  });

  test("CONTROL: a guest page opens no daemon document: a foreign pin, a vessel with no device edge, and a vessel that founded its own face", async () => {
    for (const guest of [at({ pinnedGatePubKey: FOREIGN_KEY }), at({ holdsDeviceEdge: false }), at({ hearthGatePubKey: null })]) {
      expect(guest.ownHearth).toBe(false);
      expect(guest.openHearthDaemon(WORKING)).toBeNull();
      expect(await guest.gate!.mayFederate(idOf(WORKING))).toBe(false);
    }
    expect(at({ pinnedGatePubKey: null }).openHearthDaemon(WORKING)).toBeNull();   // no gate pinned: no crossing to open
  });

  test("CONTROL: the log's name opens no system plane and no torn url, and an absent name opens nothing", async () => {
    const own = at();
    for (const url of [oracleGenesisDocUrl(), crossroadsDocUrl(NEXUS), "automerge:not-a-document", null]) expect(own.openHearthDaemon(url), String(url)).toBeNull();
    expect(await own.gate!.mayFederate(idOf(oracleGenesisDocUrl()))).toBe(false);
  });
});

describe("the share verdict hands the opened hearth document to the crossing's gate", () => {
  const OTHER_PRIVATE = idOf(generateAutomergeUrl());
  function vessel(crossing: ReturnType<typeof at>) {
    const vesselOnly = makeVesselOnlyDocs();
    vesselOnly.add(idOf(WORKING)); vesselOnly.add(OTHER_PRIVATE);   // the leaf's control document names both
    const opened = new Set<string>();
    const id = crossing.openHearthDaemon(WORKING);
    if (id) opened.add(id);
    return browserShareConfig(new Set(["relay"]), () => crossing.gate, { isSibling: (p) => p === "sibling", gate: () => ({ mayFederate: () => true }) },
      vesselOnly, new Set(["daemon-island", "wiki-island"]), new Set(["wiki-island"]), new Set<string>(), opened);
  }

  test("RED: at its own hearth the relay reads the hearth's daemon document; CONTROL: every other vessel-only document stays off the wire", async () => {
    const cfg = vessel(at());
    expect(await cfg.access("relay" as never, idOf(WORKING))).toBe(true);
    expect(await cfg.announce("relay" as never, idOf(WORKING))).toBe(true);
    expect(await cfg.access("relay" as never, OTHER_PRIVATE)).toBe(false);
  });

  test("CONTROL: a sibling and a wiki island read nothing of it, the daemon island reads it, and a guest's relay reads none", async () => {
    const cfg = vessel(at());
    expect(await cfg.access("sibling" as never, idOf(WORKING))).toBe(false);
    expect(await cfg.access("wiki-island" as never, idOf(WORKING))).toBe(false);
    expect(await cfg.access("daemon-island" as never, idOf(WORKING))).toBe(true);
    expect(await vessel(at({ pinnedGatePubKey: FOREIGN_KEY })).access("relay" as never, idOf(WORKING))).toBe(false);
  });
});
