/**
 * routed-cap-realm-join.test — a hand asking to keep a realm-carried book asks from its own vessel.
 *
 * `nexus realm-bag <book> --join` seals a request under the asking vessel's worn face and lands it on the realm doc,
 * where the standing stewards' consent decides. The book is the realm's, and the asking vessel holds no registry of
 * it, so the worker's routed gate asks admin over the vessel's own daemon bag for a join. Every other routed act on
 * a named bag still asks admin over that bag.
 */
import { describe, expect, test } from "vitest";
import { DAEMON_BAG_ID, type Verb } from "@lararium/mesh";
import { deriveRoutedCap } from "../src/verb-local-dispatch.js";

const BOOK = "lar:///ha.ka.ba/bags/meme-witness-book";
const verb = (action: string, args: Record<string, unknown>): Verb => ({ action, args, requestedBy: "0xabc", requestId: "r1" } as unknown as Verb);

describe("the routed gate for a realm-bag join", () => {
  test("a join asks admin over the asking vessel's own daemon bag", () => {
    expect(deriveRoutedCap(verb("realm-bag", { bag: BOOK, join: true, cosign: false }))).toEqual({ access: "admin", bagUrl: DAEMON_BAG_ID });
  });

  test("CONTROL: a registration and a co-sign ask admin over the book itself", () => {
    expect(deriveRoutedCap(verb("realm-bag", { bag: BOOK, join: false, cosign: false }))).toEqual({ access: "admin", bagUrl: BOOK });
    expect(deriveRoutedCap(verb("realm-bag", { bag: BOOK, join: false, cosign: true }))).toEqual({ access: "admin", bagUrl: BOOK });
  });
});
