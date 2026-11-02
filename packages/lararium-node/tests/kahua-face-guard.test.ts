/**
 * kahua-face-guard — the stage stays its own face's: a vessel that switches faces never hands face A's stage to face B's
 * sessions through the bridge (the catalog row `bags/kahua` locates a doc and scopes nothing), and the organs stay apart:
 * the stage and the daemon ride as two documents, the daemon stays sovereign, and no path hands the sensorium to a facet.
 *
 * Each red stands beside a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { generateAutomergeUrl, interpretAsDocumentId, type AutomergeUrl } from "@automerge/automerge-repo";
import {
  DAEMON_BAG_ID, KAHUA_BAG, PERSONA_GROUP_ID_TIDDLER, isSovereignBag, personaMembershipEntries, storedLarRecord, type LarDoc,
} from "@lararium/mesh";
import { bridgeBooks, faceFleetFacets, faceFleetViews } from "../src/face-fleet-view.js";

const groupA = "0x" + "55".repeat(16), groupB = "0x" + "66".repeat(16);

function vessel() {
  const stage = generateAutomergeUrl(), daemon = generateAutomergeUrl(), wiki = generateAutomergeUrl();
  const boot: Record<string, { text?: string }> = { [DAEMON_BAG_ID]: { text: daemon }, [PERSONA_GROUP_ID_TIDDLER]: { text: groupA } };
  for (const group of [groupA, groupB]) for (const e of personaMembershipEntries({ personaGroupId: group, url: generateAutomergeUrl() })) boot[e.title] = { text: e.text ?? undefined };
  // The catalog the vessel holds while it wears face A: A's stage row beside an ordinary book.
  const catalog = { schemaVersion: "lar/1", tiddlers: {
    [KAHUA_BAG]: storedLarRecord(KAHUA_BAG, { text: stage }, "pin"),
    "lar:///ha.ka.ba/bags/notes": storedLarRecord("lar:///ha.ka.ba/bags/notes", { text: wiki }, "row"),
  } } as unknown as LarDoc;
  return { stage, daemon, wiki, boot, catalog, id: (url: string) => String(interpretAsDocumentId(url as AutomergeUrl)) };
}

describe("the stage never crosses a face switch", () => {
  test("RED: worn face B's session reads no stage of face A through the bridge the catalog row names; CONTROL: an ordinary book still crosses", () => {
    const v = vessel();
    expect(bridgeBooks(v.catalog).has(v.id(v.stage))).toBe(false);
    expect(bridgeBooks(v.catalog).has(v.id(v.wiki))).toBe(true);
    let worn = groupA;
    const views = faceFleetViews(() => v.boot, () => worn, () => bridgeBooks(v.catalog), (g) => (g === groupA ? v.stage : null));
    worn = groupB;
    views.seat("peer-b", { personaGroup: groupB });
    expect(views.gateFor("peer-b")?.mayFederate(v.id(v.stage) as never)).toBe(false);
    expect(views.gateFor("peer-b")?.mayFederate(v.id(v.wiki) as never)).toBe(true);
    views.close();
  });

  test("CONTROL: face A's own session reads its stage through the facet its pin names, bridge or none", () => {
    const v = vessel();
    const views = faceFleetViews(() => v.boot, () => groupA, () => bridgeBooks(v.catalog), (g) => (g === groupA ? v.stage : null));
    views.seat("peer-a", { personaGroup: groupA });
    expect(views.gateFor("peer-a")?.mayFederate(v.id(v.stage) as never)).toBe(true);
    views.close();
  });
});

describe("the organs stay apart", () => {
  test("RED (guard): the facet list holds the stage and the daemon as two documents, and the daemon stays sovereign; CONTROL: a face with no pin carries no stage", () => {
    const v = vessel();
    const facets = faceFleetFacets(v.boot, groupA, (g) => (g === groupA ? v.stage : null))!;
    const kahua = facets.documents.filter((d) => d.name === "kahua"), daemon = facets.documents.filter((d) => d.name === "daemon");
    expect(kahua).toEqual([{ name: "kahua", document: v.stage, layer: "library" }]);
    expect(daemon).toEqual([{ name: "daemon", document: v.daemon, layer: "plane" }]);
    expect(isSovereignBag("daemon")).toBe(true);
    expect(faceFleetFacets(v.boot, groupB, (g) => (g === groupA ? v.stage : null))?.documents.some((d) => d.name === "kahua") ?? false).toBe(false);
  });

  test("RED (guard): no source file hands a sensorium url to the facet builders; CONTROL: the scanner sees a planted call", () => {
    const PACKAGES = join(import.meta.dirname, "..", "..");
    const callers: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === "dist" || name === "tests") continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) callers.push(full);
      }
    };
    walk(PACKAGES);
    const handsSensorium = (src: string): boolean =>
      /faceFleet(?:Facets|Views)\s*\([^;]*sensorium/is.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, ""));
    expect(handsSensorium("faceFleetFacets(boot, group, () => sensoriumUrl)")).toBe(true);
    expect(callers.filter((file) => handsSensorium(readFileSync(file, "utf8")))).toEqual([]);
  });
});
