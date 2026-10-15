/**
 * device-admit names the hearth's canon documents — the per-relation pointer a joinee mounts by.
 *
 * A leaf opens its hearth's wiki. The documents that wiki reads (`@lares`, `@lararium`) ride the carried admit
 * by name, beside the gate key, so the joinee's gate widens by exactly those documents and the hearth's
 * oracle plane never crosses to it. The oracle names far more than canon — this vessel's catalog, its daemon
 * doc, its faces' planes — and none of that rides the admit.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/device-admit
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { Repo, generateAutomergeUrl } from "@automerge/automerge-repo";
import {
  LARES_DOC_URI, LARARIUM_DOC_URI, CATALOG_DOC_URI, DAEMON_BAG_ID,
  materializeSharedLarDoc, mutableLarRecord, oracleGenesisDocUrl,
} from "@lararium/mesh";
import { admitCanonDocs } from "../src/commands/device-admit.js";

async function oracleNaming(pointers: Record<string, string>): Promise<Repo> {
  const repo = new Repo({ sharePolicy: async () => false });
  const oracle = await materializeSharedLarDoc(repo, oracleGenesisDocUrl(), "oracle");
  oracle.change((doc) => {
    for (const [title, text] of Object.entries(pointers)) doc.tiddlers[title] = mutableLarRecord(title, { text }, "test");
  });
  return repo;
}

describe("admitCanonDocs — the canon documents the carried admit names", () => {
  test("names `@lares` and `@lararium` as the vessel's oracle holds them, and nothing else the oracle names", async () => {
    const lares = generateAutomergeUrl(), lararium = generateAutomergeUrl();
    const repo = await oracleNaming({
      [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: lararium,
      [CATALOG_DOC_URI]: generateAutomergeUrl(), [DAEMON_BAG_ID]: generateAutomergeUrl(),
    });
    expect(await admitCanonDocs(repo)).toEqual({ [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: lararium });
  });

  test("a canon pointer the oracle does not hold, or holds torn, goes unnamed", async () => {
    const lares = generateAutomergeUrl();
    const repo = await oracleNaming({ [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: "not-a-document" });
    expect(await admitCanonDocs(repo)).toEqual({ [LARES_DOC_URI]: lares });
  });

  test("★ the door carries the named canon beside the gate key, outside the signed payload ★", () => {
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const carried = src.slice(src.indexOf("const carried: CarriedAdmitPayload = {"));
    expect(carried.slice(0, carried.indexOf("};")), "the carried admit names no canon documents").toMatch(/hearthCanonDocs:\s*await admitCanonDocs\(repo\)/);
  });
});
