/**
 * glass-skin-attestation — the mirror admits a house skin by CONTENT IDENTITY. A URI names; it proves no bytes. A skin plugin boots
 * only when its blob's bytes hash to the CID the attested genesis names for that skin (`skinCids`, read off the island's blob rows).
 * Bytes that moved without a matching attestation refuse by name, with the cure; the seal never lifts that refusal.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { LARES_LARARIUM_PLUGIN_URI, LARES_MEMETIC_WIKITEXT_PLUGIN_URI } from "@lararium/mesh/lar-uris";
import { censusPreloads } from "../src/glass-mirror.js";
import { makeBootHandoff } from "../src/glass-handoff.js";

const cidOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const blob = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const skin = (title: string, text = "{\"tiddlers\":{}}") => ({ title, "plugin-type": "plugin", type: "application/json", text });
const GRAMMAR = LARES_MEMETIC_WIKITEXT_PLUGIN_URI, HOUSE = LARES_LARARIUM_PLUGIN_URI;

test("RED: the URI alone no longer admits a skin; the seal never lifts that refusal; CONTROL: an attested title admits", () => {
  const plugins = [skin(GRAMMAR), skin(HOUSE)];
  const attestedSet = new WeakSet<object>(plugins);
  for (const sealed of [false, true]) {
    const bare = censusPreloads(plugins, sealed);
    expect(bare.accepted).toEqual([]);
    expect(bare.refused).toEqual([{ title: GRAMMAR, kind: "skin-unattested" }, { title: HOUSE, kind: "skin-unattested" }]);
  }
  const attested = censusPreloads(plugins, false, attestedSet);
  expect(attested.accepted.map(p => p.title)).toEqual([GRAMMAR, HOUSE]);
  expect(attested.refused).toEqual([]);
  // One attested skin never carries its sibling.
  expect(censusPreloads(plugins, false, new WeakSet<object>([plugins[0]!])).refused).toEqual([{ title: HOUSE, kind: "skin-unattested" }]);
});

const chunk = (cid: string, bytes: Uint8Array, member: number) => ({ type: "port:boot", portId: "p", cid, role: "plugin", member, members: 3, i: 1, n: 1,
  bytesBase64: Buffer.from(bytes).toString("base64") }) as never;
const snapshot = { type: "port:snapshot", portId: "p", snapshotId: "s", baseCursor: "b", i: 1, n: 1, records: [] } as never;
const engine = blob({ engine: true });
const grammar = blob(skin(GRAMMAR, "{\"tiddlers\":{\"$:/x\":{\"title\":\"$:/x\",\"text\":\"true\"}}}"));
const house = blob(skin(HOUSE));
const handed = (names: { skinCids?: Record<string, string> }, members: [string, Uint8Array][]) => {
  const hand = makeBootHandoff({ coreCid: cidOf(engine), pluginCids: members.map(([cid]) => cid), ...names }, "p", cidOf);
  hand.take(chunk(cidOf(engine), engine, 1));
  members.forEach(([cid, bytes], i) => hand.take(chunk(cid, bytes, i + 2)));
  hand.take(snapshot);
  return hand.inputs();
};

test("a rebuilt attested skin admits: bytes hashing to the attested CID mark the title attested", () => {
  const skinCids = { [GRAMMAR]: cidOf(grammar), [HOUSE]: cidOf(house) };
  const inputs = handed({ skinCids }, [[cidOf(grammar), grammar], [cidOf(house), house]]);
  expect(inputs.preloadedTiddlers.filter(p => inputs.attestedSkins!.has(p)).map(p => p["title"]).sort()).toEqual([GRAMMAR, HOUSE].sort());
  expect(censusPreloads(inputs.preloadedTiddlers, false, inputs.attestedSkins!).refused).toEqual([]);
});

test("RED: a tampered skin byte refuses: the blob is named and hashes true, yet its hash is not the CID the genesis attests for the skin", () => {
  const tampered = blob(skin(GRAMMAR, "{\"tiddlers\":{\"$:/x\":{\"title\":\"$:/x\",\"text\":\"false\"}}}"));
  const skinCids = { [GRAMMAR]: cidOf(grammar), [HOUSE]: cidOf(house) };
  const inputs = handed({ skinCids }, [[cidOf(tampered), tampered], [cidOf(house), house]]);
  expect(inputs.preloadedTiddlers.filter(p => inputs.attestedSkins!.has(p)).map(p => p["title"])).toEqual([HOUSE]);
  const census = censusPreloads(inputs.preloadedTiddlers, true, inputs.attestedSkins!);
  expect(census.accepted.map(p => p.title)).toEqual([HOUSE]);
  expect(census.refused).toEqual([{ title: GRAMMAR, kind: "skin-unattested" }]);
});

test("RED: a vessel that names no skin CID attests nothing, so no skin admits on its title", () => {
  const inputs = handed({}, [[cidOf(grammar), grammar], [cidOf(house), house]]);
  expect(inputs.preloadedTiddlers.filter(p => inputs.attestedSkins!.has(p))).toEqual([]);
});

test("the plugin build's own attestation names the shipped skin bytes: each skin admits through the CID its attestation.json writes, and moved bytes refuse", () => {
  const PLUGINS = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "plugins");
  const shipped = [["lares-memetic-wikitext", GRAMMAR], ["lares-lararium", HOUSE]] as const;
  const skinCids: Record<string, string> = {};
  const members: [string, Uint8Array][] = [];
  for (const [stem, title] of shipped) {
    const bytes = new Uint8Array(readFileSync(path.join(PLUGINS, `${stem}.json`)));
    const attested = (JSON.parse(readFileSync(path.join(PLUGINS, "standalone", `${stem}.attestation.json`), "utf8")) as { pluginJsonSha256: string }).pluginJsonSha256;
    expect(cidOf(bytes)).toBe(attested);
    skinCids[title] = attested; members.push([attested, bytes]);
  }
  { const i = handed({ skinCids }, members); expect(i.preloadedTiddlers.filter(p => i.attestedSkins!.has(p)).map(p => p["title"]).sort()).toEqual([GRAMMAR, HOUSE].sort()); }
  const moved = blob({ ...JSON.parse(new TextDecoder().decode(members[0]![1])), version: "moved-without-attestation" });
  { const i = handed({ skinCids }, [[cidOf(moved), moved], members[1]!]); expect(i.preloadedTiddlers.filter(p => i.attestedSkins!.has(p)).map(p => p["title"])).toEqual([HOUSE]); }
});

test("RED: a second blob wearing a skin's title rides no attestation: the true skin admits, the impostor refuses by name", () => {
  const impostor = blob(skin(GRAMMAR, "{\"tiddlers\":{\"$:/x\":{\"title\":\"$:/x\",\"text\":\"impostor\"}}}"));
  const skinCids = { [GRAMMAR]: cidOf(grammar), [HOUSE]: cidOf(house) };
  const inputs = handed({ skinCids }, [[cidOf(grammar), grammar], [cidOf(house), house], [cidOf(impostor), impostor]]);
  const census = censusPreloads(inputs.preloadedTiddlers, true, inputs.attestedSkins!);
  expect(census.accepted.map(p => p.title)).toEqual([GRAMMAR, HOUSE]);
  expect(census.accepted.every(p => !String(p.text).includes("impostor"))).toBe(true);
  expect(census.refused).toEqual([{ title: GRAMMAR, kind: "skin-unattested" }]);
});
