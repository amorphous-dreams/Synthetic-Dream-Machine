/**
 * working-slot-current (road row `L4f`, the batch's cold read) — when a running hearth's control row moves a face's daemon
 * working slot from one document to another, the device table answers the CURRENT binding alone: the new document reads as
 * the face's working slot, and the replaced one no longer does, so neither the vessel-only exception nor the face's fleet
 * gate lets the replaced document through. Control: a slot the row never moved keeps answering.
 */
import { VESSEL_STATE_HOME } from "../src/vessel-state.js";
import { describe, expect, test } from "vitest";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { deviceDaemonDocs } from "../src/device-daemon-docs.js";

const slot = (group: string, kind = "working"): string => `${VESSEL_STATE_HOME}/daemon-slot/${kind}/${encodeURIComponent(group)}`;
const control = (entries: Record<string, string>): LarDoc => {
  const doc = emptyLarDoc();
  for (const [title, id] of Object.entries(entries)) doc.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  return doc;
};

describe("the working slot answers its current binding", () => {
  test("a moved working slot answers the new document and drops the old", () => {
    const docs = deviceDaemonDocs({ enrollFloor: () => {} });
    docs.readState(control({ [slot("g1")]: "d1" }));
    docs.readState(control({ [slot("g1")]: "d2" }));
    expect(docs.workingGroupOf("d2")).toBe("g1");
    expect(docs.workingGroupOf("d1")).toBeNull();
    expect(docs.workingOf("g1")).toBe("d2");
  });
  test("control: a slot the row never moved keeps answering", () => {
    const docs = deviceDaemonDocs({ enrollFloor: () => {} });
    docs.readState(control({ [slot("g1")]: "d1", [slot("g2")]: "e1" }));
    docs.readState(control({ [slot("g1")]: "d2", [slot("g2")]: "e1" }));
    expect(docs.workingGroupOf("e1")).toBe("g2");
    expect(docs.workingOf("g2")).toBe("e1");
    expect(docs.workingOf("nobody")).toBeNull();
  });
});
