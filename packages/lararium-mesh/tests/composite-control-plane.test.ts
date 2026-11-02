/**
 * composite-control-plane — the title law the disk projector reads to keep the daemon's control plane off disk.
 *
 * The daemon stays the control plane, CRDT only, never projected (operator, 2026-11-01). `isControlPlaneUri` names every
 * `bags/daemon/**` title (a verb outcome, an effect, a flow, a summons, a ward audit) and nothing else; the projector skips
 * such a title from every mirror (lararium-node kahua-disk-witness (d)). The composition keeps routing these titles where
 * the house's laws put them: the dispatcher writes outcomes into the daemon doc by name, and a summons or a ward audit
 * rests in the working layer, device-local and never projected.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect } from "vitest";
import { DAEMON_BAG_ID, isControlPlaneUri } from "../src/lar-uris.js";
import { OUTCOME_URI_PREFIX } from "../src/verb-tiddler.js";
import { KAHUA_BAG, wikiSlotUri } from "../src/wiki-recipe.js";

describe("the control-plane title law", () => {
  test("a verb outcome, a flow, a summons and a ward audit read as control-plane titles", () => {
    for (const title of [`${OUTCOME_URI_PREFIX}req-0001`, `${DAEMON_BAG_ID}/flows/couple`, `${DAEMON_BAG_ID}/summons/r1`, `${DAEMON_BAG_ID}/ledger/ward/a1`]) {
      expect(isControlPlaneUri(title), title).toBe(true);
    }
  });

  test("CONTROL: the daemon bag's own id, a kahua item, a working-slot title and a plain title read as none", () => {
    for (const title of [DAEMON_BAG_ID, `${DAEMON_BAG_ID}-draft/x`, `${KAHUA_BAG}/notes/a`, `${wikiSlotUri("daemon", "working")}/x`, "Plain Note", "lar:///ha.ka.ba/t/kahua/note"]) {
      expect(isControlPlaneUri(title), title).toBe(false);
    }
  });
});
