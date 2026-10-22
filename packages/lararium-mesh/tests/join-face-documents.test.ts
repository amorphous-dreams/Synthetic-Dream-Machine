/** join-face-documents — the device's own entry joins the shared documents on the first boot that holds them. Control: it does join once held; red: an unheld document is left alone and never awaited; an existing entry is never overwritten. */
import { describe, expect, test } from "vitest";
import { generateAutomergeUrl, Repo } from "@automerge/automerge-repo";
import { emptyIdentitiesDoc, emptyCirclesDoc } from "../src/lar-uris.js";
import { joinFaceDocuments } from "../src/join-face-documents.js";
import { didKeyFromVerifyingKey } from "../src/cold-boot-ceremony.js";

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
});
