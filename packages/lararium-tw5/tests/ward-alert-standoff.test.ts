/** Keyed standoffs surface once, clear on resolution, and leave no control rows. */
import { memoryControlStore } from "./control-store-fixture.js";
import { describe, expect, test } from "vitest";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { DAEMON_BAG_ID } from "@lararium/mesh/lar-uris";
import { wikiSlotUri } from "@lararium/mesh/wiki-recipe";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWardAlertReactor, HOME_WIKI_TITLE } from "../src/index.js";
import type { DaemonMsg_WikiAlert } from "../src/index.js";
import { placeSystemAlert, systemAlertTitle } from "../src/wiki-behavior.js";
import { fileWardRefusal } from "../src/worker-data-verbs.js";

async function daemon(): Promise<CompositeStore> {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  await composite.put({ tiddler: { title: HOME_WIKI_TITLE, text: "[[elyncia]]" } }, { kind: "lares-verb", requestId: "seed" });
  return composite;
}
const rows = async (store: CompositeStore): Promise<string[]> => (await store.listVisible()).filter((t) => t.includes("/ledger/ward/"));
const conflict = (standoff: string, uri = "lar:///ha.ka.ba/probe/carrier") =>
  ({ bagId: "lares", uri, reason: "the disk and the records both moved", wardKind: "projection-conflict", standoff });

describe("the ward rail keys a standoff", () => {
  test("ten reports of one standoff post one alert; two standoffs post two alerts under two keys", async () => {
    const composite = await daemon();
    const control = memoryControlStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, control, (m) => posted.push(m));
    for (let i = 0; i < 10; i++) await react(conflict("aaaa1111aaaa1111"));
    expect(await rows(control)).toEqual([]);
    expect(posted).toHaveLength(1);

    await react(conflict("bbbb2222bbbb2222", "lar:///ha.ka.ba/probe/other"));
    expect(await rows(control)).toEqual([]);
    expect(posted).toHaveLength(2);
    expect(new Set(posted.map((m) => m.key))).toEqual(new Set(["aaaa1111aaaa1111", "bbbb2222bbbb2222"]));
    expect(posted.every((m) => m.kind === "disk-ward" && m.clear !== true && m.wikiSlug === "elyncia")).toBe(true);
    expect(await rows(composite), "an audit row reached the daemon wiki").toEqual([]);
  });

  test("a resolution posts the standoff's key with clear, and files no row", async () => {
    const composite = await daemon();
    const control = memoryControlStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, control, (m) => posted.push(m));
    await react(conflict("cccc3333cccc3333"));
    const before = await rows(control);
    await react({ ...conflict("cccc3333cccc3333"), resolved: true });
    expect(await rows(control)).toEqual(before);
    expect(posted.at(-1)).toMatchObject({ kind: "disk-ward", key: "cccc3333cccc3333", clear: true, wikiSlug: "elyncia" });
    await react(conflict("cccc3333cccc3333"));
    expect(posted).toHaveLength(3);
    expect(posted.at(-1)?.clear).not.toBe(true);
  });

  test("a stand-off the person's own collapse rule settled raises no alert or record", async () => {
    const composite = await daemon();
    const control = memoryControlStore();
    const posted: Array<Record<string, unknown>> = [];
    await fileWardRefusal(composite, control, (m) => posted.push(m as unknown as Record<string, unknown>), { ...conflict("dddd4444dddd4444"), wardKind: "standoff-collapsed", auditOnly: true, rule: "slot-disjoint", reason: "slot-disjoint collapsed the stand-off" });
    expect(posted, "nothing awaits anyone").toEqual([]);
    expect(await rows(control)).toEqual([]);
  });

  test("CONTROL: a refusal that names no standoff posts an unkeyed alert", async () => {
    const composite = await daemon();
    const control = memoryControlStore();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, control, (m) => posted.push(m));
    for (let i = 0; i < 3; i++) await react({ bagId: "lares", uri: "lar:///x", reason: "escapes the mirror root" });
    expect(await rows(control)).toEqual([]);
    expect(posted).toHaveLength(3);
    expect(posted.every((m) => m.key === undefined && m.clear === undefined)).toBe(true);
  });
});

describe("the wiki places a keyed alert at its own title and clears it", () => {
  test("two keys stand as two alerts; a clear removes one and leaves the other; an unkeyed alert keeps its title", async () => {
    const temp = wikiSlotUri("elyncia", "temp");
    const composite = new CompositeStore();
    composite.addLayer({ bagId: temp, store: new MemoryTiddlerStore(temp), writable: true });
    const a = systemAlertTitle("disk-ward", "aaaa1111aaaa1111");
    const b = systemAlertTitle("disk-ward", "bbbb2222bbbb2222");
    expect(a).not.toBe(b);
    expect(systemAlertTitle("disk-ward")).toBe("$:/temp/lares/alert/disk-ward");

    await placeSystemAlert(composite, "elyncia", { message: "standoff A", kind: "disk-ward", key: "aaaa1111aaaa1111" });
    await placeSystemAlert(composite, "elyncia", { message: "standoff A updated", kind: "disk-ward", key: "aaaa1111aaaa1111" });
    await placeSystemAlert(composite, "elyncia", { message: "standoff B", kind: "disk-ward", key: "bbbb2222bbbb2222" });
    expect(await composite.listVisible()).toHaveLength(2);
    expect((await composite.getLive(a))?.tiddler.text).toBe("standoff A updated");
    expect((await composite.getLive(b))?.tiddler.text).toBe("standoff B");

    await placeSystemAlert(composite, "elyncia", { kind: "disk-ward", key: "aaaa1111aaaa1111", clear: true });
    expect(await composite.getLive(a)).toBeNull();
    expect((await composite.getLive(b))?.tiddler.text, "CONTROL: the other standoff's alert stands").toBe("standoff B");

    await placeSystemAlert(composite, "elyncia", { message: "ward refused", kind: "disk-ward" });
    expect((await composite.getLive("$:/temp/lares/alert/disk-ward"))?.tiddler.text).toBe("ward refused");
  });
});
