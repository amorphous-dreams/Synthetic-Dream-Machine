import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { PORT_BOOT_CHUNK_BYTES } from "@lararium/mesh/record-port";
import { realPort, ofType, open, pump } from "./record-port-real-rig.js";
import { makeBootHandoff } from "../src/glass-handoff.js";

const origin = { kind: "tw-local", instanceId: "foreign" } as const;
const cidOf = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const blob = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
// An engine blob wider than one chunk, and two plugin blobs: one tiddler, and an array of tiddlers.
const engine = new Uint8Array(PORT_BOOT_CHUNK_BYTES * 2 + 17).map((_, i) => i % 251);
const plugin = blob({ title: "$:/plugins/test/one", "plugin-type": "plugin", text: "{\"tiddlers\":{}}" });
const shadows = blob([{ title: "$:/palette", text: "p" }, { title: "$:/theme", text: "t" }]);
const cas = new Map([engine, plugin, shadows].map(bytes => [cidOf(bytes), bytes]));
const bootSet = { engineCid: cidOf(engine), pluginCids: [cidOf(plugin), cidOf(shadows)] };

/** The island hashes each member off-thread before it sends; the snapshot follows the last member, so its arrival ends the wait. */
const handed = async (r: { messages: { type: string }[] }): Promise<void> => {
  for (let turn = 0; turn < 200 && !r.messages.some(m => m.type === "port:snapshot"); turn++) await pump();
};
async function island(extra: Record<string, unknown> = {}) {
  const r = await realPort({}, undefined, { bootSet, resolveByCid: async (cid: string) => cas.get(cid) ?? null, ...extra });
  await r.composite.put({ tiddler: { title: "Ordinary", text: "body" } }, origin);
  return r;
}

describe("port:boot ~ the island hands a booting projection its boot set ahead of the snapshot", () => {
  test("port-boot-hands-the-set-whole: every member, in boot order, chunked, verbatim, before the first snapshot chunk", async () => {
    const r = await island();
    await r.send({ ...open, boot: true }); await handed(r);
    const types = r.messages.map(m => m.type).filter(type => type === "port:boot" || type === "port:snapshot");
    expect(types.lastIndexOf("port:boot")).toBeLessThan(types.indexOf("port:snapshot"));
    const boots = ofType(r.messages, "port:boot" as never) as any[];
    expect(boots.map(m => [m.member, m.i, m.n, m.role])).toEqual([[1, 1, 3, "engine"], [1, 2, 3, "engine"], [1, 3, 3, "engine"], [2, 1, 1, "plugin"], [3, 1, 1, "plugin"]]);
    expect(boots.every(m => m.members === 3 && m.portId === "p")).toBe(true);
    // The page's reader joins the chunks, hashes each member against the name the vessel gave, and reads the tiddlers.
    const hand = makeBootHandoff({ coreCid: bootSet.engineCid, pluginCids: bootSet.pluginCids }, "p", cidOf);
    let whole = false;
    for (const message of r.messages) whole = hand.take(message as never) || whole;
    expect(whole).toBe(true);
    const inputs = hand.inputs();
    expect(inputs.coreCid).toBe(bootSet.engineCid);
    expect(cidOf(inputs.coreBytes)).toBe(bootSet.engineCid);
    expect(inputs.preloadedTiddlers.map(t => t["title"])).toEqual(["$:/plugins/test/one", "$:/palette", "$:/theme"]);
    expect(hand.records().map(record => record.title)).toEqual(["Ordinary"]);
    await r.close();
  });
  test("CONTROL: an open that asks no boot receives the snapshot alone", async () => {
    const r = await island();
    await r.send({ ...open });
    expect(r.messages.some(m => (m.type as string) === "port:boot")).toBe(false);
    expect(ofType(r.messages, "port:snapshot")).toHaveLength(1);
    await r.close();
  });
  test("port-boot-corrupt-member-never-leaves: bytes that hash to another value send nothing, and the reader names the member it never received", async () => {
    const bent = new Uint8Array(plugin); bent[0] = bent[0]! ^ 1;
    const r = await island({ resolveByCid: async (cid: string) => (cid === bootSet.pluginCids[0] ? bent : cas.get(cid) ?? null) });
    await r.send({ ...open, boot: true }); await handed(r);
    const hand = makeBootHandoff({ coreCid: bootSet.engineCid, pluginCids: bootSet.pluginCids }, "p", cidOf);
    for (const message of r.messages) hand.take(message as never);
    expect(() => hand.inputs()).toThrow(`mirror-boot-member-missing:${bootSet.pluginCids[0]}`);
    await r.close();
  });
});

describe("the boot handoff's reader ~ two speakers, one check", () => {
  const chunk = (cid: string, bytes: Uint8Array, member = 1) => ({ type: "port:boot", portId: "p", cid, role: "plugin", member, members: 2, i: 1, n: 1,
    bytesBase64: Buffer.from(bytes).toString("base64") }) as never;
  const snapshot = { type: "port:snapshot", portId: "p", snapshotId: "s", baseCursor: "b", i: 1, n: 1, records: [] } as never;
  const names = { coreCid: cidOf(plugin), pluginCids: [cidOf(shadows)] };
  test("a member whose bytes hash to another value refuses by name", () => {
    const hand = makeBootHandoff(names, "p", cidOf);
    hand.take(chunk(names.coreCid, shadows)); hand.take(chunk(names.pluginCids[0]!, shadows, 2)); hand.take(snapshot);
    expect(() => hand.inputs()).toThrow(`mirror-boot-member-mismatch:${names.coreCid}`);
  });
  test("a member the vessel never named refuses by name", () => {
    const hand = makeBootHandoff(names, "p", cidOf);
    hand.take(chunk(names.coreCid, plugin)); hand.take(chunk(names.pluginCids[0]!, shadows, 2)); hand.take(chunk(cidOf(engine), engine, 2)); hand.take(snapshot);
    expect(() => hand.inputs()).toThrow(`mirror-boot-member-unnamed:${cidOf(engine)}`);
  });
  test("what arrives after the snapshot waits, in order, for the adaptor; another port's message never enters", () => {
    const hand = makeBootHandoff(names, "p", cidOf);
    expect(hand.take(snapshot)).toBe(true);
    const change = { type: "port:changes", portId: "p", cursor: "c", entries: [] } as never;
    hand.take(change); hand.take({ type: "port:changes", portId: "other", cursor: "c", entries: [] } as never);
    expect(hand.later()).toEqual([change]);
    expect(hand.later()).toEqual([]);
  });
  test("CONTROL: a whole, true set reads", () => {
    const hand = makeBootHandoff(names, "p", cidOf);
    hand.take(chunk(names.coreCid, plugin)); hand.take(chunk(names.pluginCids[0]!, shadows, 2)); hand.take(snapshot);
    expect(hand.inputs().preloadedTiddlers).toHaveLength(2);
  });
});
