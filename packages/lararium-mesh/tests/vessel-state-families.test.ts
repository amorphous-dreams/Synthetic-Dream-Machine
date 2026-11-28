/**
 * vessel-state-families — the lease slots, the device daemon pointers and the share rows rest in the vessel's fixed-title state
 * (its secret home), never in a control document: each title family roots under the secret home's bag, a face's daemon canon
 * stood over the state survives the document's reload and reopens to the same name, and the device table and the vessel-only
 * deny set read their names off the state.
 */
import * as A from "@automerge/automerge";
import { Repo } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { SECRET_HOME_ID, bagUri } from "../src/lar-uris.js";
import { leaseEpochPrefix, leaseEpochSlotUri } from "../src/epoch-lease.js";
import { daemonCanonTitle, daemonSlotTitle, deviceDaemonDocs } from "../src/device-daemon-docs.js";
import { standFaceDaemonCanon } from "../src/face-daemon-canon.js";
import { vesselOnlyDocIds } from "../src/vessel-only-book.js";
import { VESSEL_STATE_HOME } from "../src/vessel-state.js";

const CONTROL = bagUri("control");

describe("the fixed-title families rest in the vessel's state", () => {
  test("RED: lease slots and device pointers title under the secret home, never under bags/control", () => {
    expect(VESSEL_STATE_HOME).toBe(SECRET_HOME_ID);
    for (const title of [leaseEpochPrefix("group"), leaseEpochSlotUri("group", "writer"), daemonSlotTitle("working", "group"), daemonCanonTitle("face")]) {
      expect(title.startsWith(`${SECRET_HOME_ID}/`), title).toBe(true);
      expect(title.startsWith(`${CONTROL}/`), title).toBe(false);
    }
  });

  test("RED: a face's daemon canon named in the state survives a reload and reopens to the same name; the device table files it off the state", async () => {
    const repo = new Repo();
    const state = repo.create<LarDoc>(emptyLarDoc());
    const first = await standFaceDaemonCanon({ repo, state, faceRelation: "face-1" });
    const reloaded = A.load<LarDoc>(A.save(state.doc()));
    const restartedRepo = new Repo();
    const restarted = restartedRepo.create<LarDoc>(reloaded);
    const again = await standFaceDaemonCanon({ repo: restartedRepo, state: restarted, faceRelation: "face-1" });
    expect(again.url).toBe(first.url);
    // CONTROL: the device table files the canon off the state, and the deny set names it beside the state's own document.
    const table = deviceDaemonDocs({ enrollFloor: () => {} });
    expect(table.readState(reloaded)).toBe(true);
    expect(vesselOnlyDocIds(reloaded, "automerge:state-doc")).toEqual(new Set(["state-doc", first.documentId]));
  });
});
