/**
 * cross-face-private-docs — A LIT FACE RECEIVES VISITS (Sol H3): a cross-face view checks the DOCUMENT each binding resolves to,
 * against every document a private slot names on this island, so a label never carries a private document past it.
 *
 *   P1  RED: the deny set names every lit face's daemon personal and draft documents (the worn face's mounted ones, each face's
 *       as the control document names it), and every personal or draft binding the daemon document records for any wiki
 *   P2  RED: working, canon and other binding kinds stay out of the set; a torn url names nothing
 */
import { describe, expect, it } from "vitest";
import { CONTROL_HOME_ID, wikiSlotUri } from "@lararium/mesh";
import { crossFacePrivateDocs } from "../src/face-engine-source.js";

const rec = (fields: Record<string, string>) => ({ tiddler: fields });
const slotTitle = (kind: string, group: string) => `${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;

describe("a lit face receives visits: the documents a view refuses by identity", () => {
  const control = new Map<string, unknown>([
    [slotTitle("personal", "group-0"), rec({ title: slotTitle("personal", "group-0"), text: "automerge:worn-personal" })],
    [slotTitle("personal", "group-1"), rec({ title: slotTitle("personal", "group-1"), text: "automerge:sib-personal" })],
    [slotTitle("draft", "group-1"), rec({ title: slotTitle("draft", "group-1"), text: "automerge:sib-draft" })],
    [slotTitle("working", "group-1"), rec({ title: slotTitle("working", "group-1"), text: "automerge:sib-working" })],
  ]);
  const daemon = new Map<string, unknown>([
    ["b/personal", rec({ title: "b/personal", text: "automerge:garden-personal", kind: "personal" })],
    ["b/draft-mint", rec({ title: "b/draft-mint", text: "automerge:garden-draft", kind: "binding-mint", "binding-kind": "draft" })],
    ["b/working", rec({ title: "b/working", text: "automerge:garden-working", kind: "working" })],
    ["b/torn", rec({ title: "b/torn", text: "not a url", kind: "personal" })],
  ]);
  const deps = {
    faces: [{ handleIndex: 0, group: "group-0", relation: null }, { handleIndex: 1, group: "group-1", relation: null }],
    mounted: (slot: string) => (slot === wikiSlotUri("daemon", "personal") ? { documentId: "mounted-personal" } : slot === wikiSlotUri("daemon", "draft") ? { documentId: "mounted-draft" } : slot === wikiSlotUri("daemon", "working") ? { documentId: "mounted-working" } : null),
    control: { get: async (title: string) => control.get(title) ?? null },
    daemon: { listVisible: async () => [...daemon.keys()], get: async (title: string) => (daemon.get(title) as never) ?? null },
  };

  it("P1 RED: every lit face's daemon personal and draft documents, and every private binding the daemon records", async () => {
    const docs = await crossFacePrivateDocs(deps as never);
    for (const id of ["mounted-personal", "mounted-draft", "worn-personal", "sib-personal", "sib-draft", "garden-personal", "garden-draft"]) expect(docs.has(id), id).toBe(true);
  });

  it("P2 RED: working, canon and other kinds stay out; a torn url names nothing", async () => {
    const docs = await crossFacePrivateDocs(deps as never);
    for (const id of ["mounted-working", "sib-working", "garden-working", "not a url"]) expect(docs.has(id), id).toBe(false);
  });
});
