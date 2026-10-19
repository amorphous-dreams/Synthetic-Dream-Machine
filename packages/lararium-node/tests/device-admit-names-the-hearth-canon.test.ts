/**
 * device-admit names the hearth's canon documents — the per-relation pointer a joinee mounts by.
 *
 * A leaf opens its hearth's wiki. The documents that wiki reads (`@lares`, `@lararium`) ride the fleet-join answer's
 * signed carriage by name, beside the gate pin, so the joinee's gate widens by exactly those documents and the
 * hearth's catalog plane never crosses to it. The catalog names far more than canon, and none of that rides the answer.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/device-admit
 */
import { readFileSync } from "node:fs";
import { describe, test, expect } from "vitest";
import { Repo, generateAutomergeUrl } from "@automerge/automerge-repo";
import {
  LARES_DOC_URI, LARARIUM_DOC_URI, CATALOG_DOC_URI, DAEMON_BAG_ID,
  emptyLarDoc, mutableLarRecord,
} from "@lararium/mesh";
import { admitCanonDocs } from "../src/commands/device-admit.js";

async function catalogNaming(pointers: Record<string, string>): Promise<{ repo: Repo; registryUrl: string }> {
  const repo = new Repo({ sharePolicy: async () => false });
  const catalog = repo.create(emptyLarDoc());
  catalog.change((doc) => {
    for (const [title, text] of Object.entries(pointers)) doc.tiddlers[title] = mutableLarRecord(title, { text }, "test");
  });
  return { repo, registryUrl: catalog.url };
}

describe("admitCanonDocs — the canon documents the carried admit names", () => {
  test("names `@lares` and `@lararium` as the vessel's catalog holds them, and nothing else the catalog names", async () => {
    const lares = generateAutomergeUrl(), lararium = generateAutomergeUrl();
    const { repo, registryUrl } = await catalogNaming({
      [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: lararium,
      [CATALOG_DOC_URI]: generateAutomergeUrl(), [DAEMON_BAG_ID]: generateAutomergeUrl(),
    });
    expect(await admitCanonDocs(repo, registryUrl)).toEqual({ [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: lararium });
  });

  test("a canon pointer the catalog does not hold, or holds torn, goes unnamed", async () => {
    const lares = generateAutomergeUrl();
    const { repo, registryUrl } = await catalogNaming({ [LARES_DOC_URI]: lares, [LARARIUM_DOC_URI]: "not-a-document" });
    expect(await admitCanonDocs(repo, registryUrl)).toEqual({ [LARES_DOC_URI]: lares });
  });

  test("★ the door reads the named canon into the hearth reading the fleet-join answer signs ★", () => {
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const hearth = src.slice(src.indexOf("const hearth: AdmitHearthReading = {"));
    expect(hearth.slice(0, hearth.indexOf("};")), "the hearth reading names no canon documents").toMatch(/canon:\s*opts.catalogUrl \? await admitCanonDocs\(repo, opts.catalogUrl\) : \{\}/);
    expect(src, "a carried admit composes beside the signed edge").not.toMatch(/CarriedAdmitPayload\s*=/);
  });
});
