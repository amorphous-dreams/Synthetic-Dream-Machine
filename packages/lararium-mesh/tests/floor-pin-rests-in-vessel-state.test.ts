/**
 * floor-pin-rests-in-vessel-state — the vessel's floor pin rests in its fixed-title state (the secret home), never in a control
 * document: the pin titles under the secret home's bag, a pin written through the state store survives the document's reload
 * (a restart's Repo), and the mount reads it back; the pin row stays ONE title per Nexus, rewritten in place.
 */
import * as A from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { FLOOR_PIN_KIND } from "../src/wire-names.js";
import { FLOOR_PIN_PREFIX, floorCidToMount, floorPinTitle, writeFloorPin } from "../src/floor-pin.js";
import { SECRET_HOME_ID, bagUri } from "../src/lar-uris.js";
import { VESSEL_STATE_HOME, vesselStateStoreOf } from "../src/vessel-state.js";

const NEXUS = "a".repeat(64);

describe("the floor pin rests in the vessel's fixed-title state", () => {
  test("RED: the pin titles under the secret home, never under bags/control", () => {
    expect(VESSEL_STATE_HOME).toBe(SECRET_HOME_ID);
    expect(FLOOR_PIN_PREFIX.startsWith(`${SECRET_HOME_ID}/`)).toBe(true);
    expect(FLOOR_PIN_PREFIX.startsWith(`${bagUri("control")}/`)).toBe(false);
  });

  test("RED: a pin written into the state survives a reload and the mount reads it; a second accept rewrites the one row", async () => {
    const repo = new Repo();
    const home = repo.create<LarDoc>(emptyLarDoc());
    home.change((d) => { writeFloorPin(d, { kind: FLOOR_PIN_KIND, nexus: NEXUS, release: "1".repeat(64), manifest: "2".repeat(64) }); });
    home.change((d) => { writeFloorPin(d, { kind: FLOOR_PIN_KIND, nexus: NEXUS, release: "3".repeat(64), manifest: "4".repeat(64) }); });
    const reloaded = A.load<LarDoc>(A.save(home.doc()));
    expect(Object.keys(reloaded.tiddlers).filter((t) => t.startsWith(FLOOR_PIN_PREFIX))).toEqual([floorPinTitle(NEXUS)]);
    expect(floorCidToMount({ stateDoc: reloaded, nexus: NEXUS, genesis: "0".repeat(64) })).toEqual({ cid: "4".repeat(64), source: "pin" });
    // CONTROL: the state store over the same document answers the row under the secret home's bag.
    const state = vesselStateStoreOf(home);
    expect(await state.listBagsHolding(floorPinTitle(NEXUS))).toEqual([SECRET_HOME_ID]);
  });
});
