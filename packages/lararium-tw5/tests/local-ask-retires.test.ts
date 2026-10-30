/**
 * Locality follows the invocation, never a reusable id (Sol's read). An ask the vessel's channel or a surface leg placed
 * reads local while its invocation stands; once its verb tiddler leaves the VM (the verb concluded), the id reads local
 * no more, so a later summons reusing that id is the synced claim it is.
 */
import { expect, test } from "vitest";
import { VERB_URI_PREFIX } from "@lararium/mesh";
import { makeLocalAskBook } from "../src/daemon-behavior.js";

test("RED: a local ask's id retires when its verb concludes; CONTROL: an id still standing reads local, and another verb's removal retires nothing", () => {
  const book = makeLocalAskBook();
  const ask = (requestId: string, args: Record<string, unknown> = {}) => ({ requestId, action: "probe", args, requestedBy: "0xabc" });
  book.add(ask("r-1"));
  book.add(ask("r-2"));
  expect(book.has(ask("r-1"))).toBe(true);
  book.onWikiChange({ [`${VERB_URI_PREFIX}r-1`]: { deleted: true } });
  expect(book.has(ask("r-1"))).toBe(false);
  expect(book.has(ask("r-2"))).toBe(true);
  book.onWikiChange({ [`${VERB_URI_PREFIX}r-2`]: {} });                 // a write, not a removal
  book.onWikiChange({ "lar:///elsewhere/r-2": { deleted: true } });
  expect(book.has(ask("r-2"))).toBe(true);
});

test("RED (Sol's delta read): a local id lends nothing to another invocation under it: other args, verb or claim read non-local; CONTROL: the placed one reads local", () => {
  const book = makeLocalAskBook();
  book.add({ requestId: "r-9", action: "probe", args: { x: 1 }, requestedBy: "0xabc" });
  expect(book.has({ requestId: "r-9", action: "probe", args: { x: 1 }, requestedBy: "0xabc" })).toBe(true);
  expect(book.has({ requestId: "r-9", action: "probe", args: { x: 2 }, requestedBy: "0xabc" })).toBe(false);
  expect(book.has({ requestId: "r-9", action: "other", args: { x: 1 }, requestedBy: "0xabc" })).toBe(false);
  expect(book.has({ requestId: "r-9", action: "probe", args: { x: 1 }, requestedBy: "0xdef" })).toBe(false);
});
