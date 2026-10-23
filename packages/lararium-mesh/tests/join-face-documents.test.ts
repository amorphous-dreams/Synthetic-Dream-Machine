/** join-face-documents — the device's own entry joins the shared documents on the first boot that holds them. Control: it does join once held; red: an unheld document is left alone and never awaited; an existing entry is never overwritten. */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { emptyIdentitiesDoc, emptyCirclesDoc } from "../src/lar-uris.js";
import * as A from "@automerge/automerge";
import { joinFaceDocuments, joinFaceDocumentsOnArrival } from "../src/join-face-documents.js";
import { buildCeremonyTiddlers, didKeyFromVerifyingKey } from "../src/cold-boot-ceremony.js";
import { circleTiddlerUri } from "../src/lar-uris.js";

const KEY = "ab".repeat(32);

describe("joinFaceDocuments", () => {
  test("RED: a document the replica does not hold takes no write and no wait; CONTROL: once held, this device's entry joins, once", () => {
    const repo = new Repo({});
    const identities = repo.create(emptyIdentitiesDoc()), circles = repo.create(emptyCirclesDoc());
    const unheld = { identities: generateAutomergeUrl(), circles: generateAutomergeUrl() };
    expect(joinFaceDocuments(repo, unheld, KEY, "device")).toEqual({ identities: false, circles: false });
    const held = { identities: identities.url, circles: circles.url };
    const first = joinFaceDocuments(repo, held, KEY, "device");
    expect(first.identities).toBe(true);
    const keys = Object.keys(identities.doc()!.tiddlers);
    expect(keys.some((k) => k.includes(didKeyFromVerifyingKey(KEY)))).toBe(true);
    expect(joinFaceDocuments(repo, held, KEY, "device"), "an entry standing is never written again").toEqual({ identities: false, circles: false });
    expect(Object.keys(identities.doc()!.tiddlers)).toEqual(keys);
  });

  test("RED: the entry appears once the replica receives the identities doc, with no reboot and no timer; CONTROL: a stopped wait writes nothing", async () => {
    const origin = new Repo({});
    const identities = origin.create(emptyIdentitiesDoc()), circles = origin.create(emptyCirclesDoc());
    const urls = { identities: identities.url, circles: circles.url };
    const joinee = new Repo({});
    const arrival = joinFaceDocumentsOnArrival(joinee, urls, KEY, "device");
    const stopped = joinFaceDocumentsOnArrival(joinee, { identities: generateAutomergeUrl(), circles: generateAutomergeUrl() }, KEY, "device");
    stopped.stop();
    joinee.import(A.save(identities.doc()!), { docId: identities.documentId });
    joinee.import(A.save(circles.doc()!), { docId: circles.documentId });
    await Promise.resolve();
    const got = joinee.handles[identities.documentId]!.doc()!;
    expect(Object.keys(got.tiddlers).some((k) => k.includes(didKeyFromVerifyingKey(KEY)))).toBe(true);
  });

  test("RED: the joinee's membership dot lands in the founder's occupied `operators` circle, add-only; CONTROL: the founder's dot stays and a second join adds nothing", () => {
    const repo = new Repo({});
    const founderKey = "cd".repeat(32);
    const circles = repo.create(emptyCirclesDoc()), identities = repo.create(emptyIdentitiesDoc());
    circles.change((doc) => {
      for (const t of buildCeremonyTiddlers(founderKey, "founder")) if (t.title === circleTiddlerUri("operators")) (doc.tiddlers as Record<string, unknown>)[t.title] = { tiddler: { title: t.title, ...t.fields }, meta: { authority: t.authority } };
    });
    const urls = { identities: identities.url, circles: circles.url };
    const dotsOf = () => Object.keys((circles.doc()!.tiddlers[circleTiddlerUri("operators")] as unknown as { tiddler: Record<string, unknown> }).tiddler).filter((k) => k.startsWith("mbr+:"));
    expect(dotsOf()).toHaveLength(1);
    expect(joinFaceDocuments(repo, urls, KEY, "device").circles).toBe(true);
    expect(dotsOf(), "the founder's dot and the joinee's").toHaveLength(2);
    expect(dotsOf().some((k) => k.includes(didKeyFromVerifyingKey(founderKey)))).toBe(true);
    expect(dotsOf().some((k) => k.includes(didKeyFromVerifyingKey(KEY)))).toBe(true);
    expect(joinFaceDocuments(repo, urls, KEY, "device").circles, "a second join adds nothing").toBe(false);
  });
});
