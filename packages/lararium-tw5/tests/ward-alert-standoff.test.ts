/**
 * THE WARD RAIL KEYS A STANDOFF: ONE AUDIT ROW, ONE ALERT PER STANDOFF, AND A CLEAR ON RESOLUTION.
 *
 * A projection conflict reaches the rail with its standoff key. The rail files ONE audit row for that
 * key however often it hears of it, posts the alert under that key (so two standoffs show two alerts),
 * and on resolution posts the same key with `clear`. The wiki places a keyed alert at its own title and
 * removes it on the clear.
 *
 * Control: a refusal that names no standoff (the disk ward, a seal refusal) files a row per refusal
 * and posts an unkeyed alert, as it always did.
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, DAEMON_BAG_ID, WARD_AUDIT_URI_PREFIX, wikiSlotUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeWardAlertReactor, ACTIVE_WIKI_URI } from "../src/index.js";
import type { DaemonMsg_WikiAlert } from "../src/index.js";
import { placeSystemAlert, systemAlertTitle } from "../src/wiki-behavior.js";

async function daemon(): Promise<CompositeStore> {
  const composite = new CompositeStore();
  composite.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
  await composite.put({ tiddler: { title: ACTIVE_WIKI_URI, text: "elyncia" } }, { kind: "lares-verb", requestId: "seed" });
  return composite;
}
const rows = async (composite: CompositeStore): Promise<string[]> => (await composite.listVisible()).filter((t) => t.startsWith(WARD_AUDIT_URI_PREFIX));
const conflict = (standoff: string, uri = "lar:///ha.ka.ba/probe/carrier") =>
  ({ bagId: "lares", uri, reason: "the disk and the records both moved", wardKind: "projection-conflict", standoff });

describe("the ward rail keys a standoff", () => {
  test("ten reports of one standoff file one audit row; two standoffs post two alerts under two keys", async () => {
    const composite = await daemon();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, (m) => posted.push(m));
    for (let i = 0; i < 10; i++) await react(conflict("aaaa1111aaaa1111"));
    expect(await rows(composite)).toEqual([`${WARD_AUDIT_URI_PREFIX}aaaa1111aaaa1111`]);

    await react(conflict("bbbb2222bbbb2222", "lar:///ha.ka.ba/probe/other"));
    expect((await rows(composite)).sort()).toEqual([`${WARD_AUDIT_URI_PREFIX}aaaa1111aaaa1111`, `${WARD_AUDIT_URI_PREFIX}bbbb2222bbbb2222`]);
    expect(new Set(posted.map((m) => m.key))).toEqual(new Set(["aaaa1111aaaa1111", "bbbb2222bbbb2222"]));
    expect(posted.every((m) => m.kind === "disk-ward" && m.clear !== true && m.wikiSlug === "elyncia")).toBe(true);
    const row = (await composite.get(`${WARD_AUDIT_URI_PREFIX}aaaa1111aaaa1111`))!.tiddler as Record<string, unknown>;
    expect(row["alert-kind"]).toBe("projection-conflict");
    expect(row["standoff"]).toBe("aaaa1111aaaa1111");
    expect(row["disk-projection"]).toBe("no");
  });

  test("a resolution posts the standoff's key with clear, and files no row", async () => {
    const composite = await daemon();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, (m) => posted.push(m));
    await react(conflict("cccc3333cccc3333"));
    const before = await rows(composite);
    await react({ ...conflict("cccc3333cccc3333"), resolved: true });
    expect(await rows(composite)).toEqual(before);
    expect(posted.at(-1)).toMatchObject({ kind: "disk-ward", key: "cccc3333cccc3333", clear: true, wikiSlug: "elyncia" });
  });

  test("CONTROL: a refusal that names no standoff files a row each time and posts an unkeyed alert", async () => {
    const composite = await daemon();
    const posted: DaemonMsg_WikiAlert[] = [];
    const react = makeWardAlertReactor(composite, (m) => posted.push(m));
    for (let i = 0; i < 3; i++) await react({ bagId: "lares", uri: "lar:///x", reason: "escapes the mirror root" });
    expect(await rows(composite)).toHaveLength(3);
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
    await placeSystemAlert(composite, "elyncia", { message: "standoff B", kind: "disk-ward", key: "bbbb2222bbbb2222" });
    expect((await composite.getLive(a))?.tiddler.text).toBe("standoff A");
    expect((await composite.getLive(b))?.tiddler.text).toBe("standoff B");

    await placeSystemAlert(composite, "elyncia", { kind: "disk-ward", key: "aaaa1111aaaa1111", clear: true });
    expect(await composite.getLive(a)).toBeNull();
    expect((await composite.getLive(b))?.tiddler.text, "CONTROL: the other standoff's alert stands").toBe("standoff B");

    await placeSystemAlert(composite, "elyncia", { message: "ward refused", kind: "disk-ward" });
    expect((await composite.getLive("$:/temp/lares/alert/disk-ward"))?.tiddler.text).toBe("ward refused");
  });
});
