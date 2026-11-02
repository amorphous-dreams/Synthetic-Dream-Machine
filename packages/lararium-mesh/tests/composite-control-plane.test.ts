/**
 * composite-control-plane — a daemon title routes to the control plane and never lands in a default writable.
 *
 * The daemon stays the control plane, CRDT only, never projected (operator, 2026-11-01). A verb outcome, a flow record or
 * any other `bags/daemon/**` title that a writer puts with no bag would otherwise land in the default writable (the kahua
 * wiki's working top, which projects as flat files). Reds: a bagless put and a family write of a daemon title land in the
 * daemon layer; with no daemon layer mounted they refuse by name. CONTROL: an ordinary title still lands in the default
 * writable, and a daemon title seen through a read-only daemon layer never copies up.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "../src/composite-store.js";
import { DAEMON_BAG_ID } from "../src/lar-uris.js";
import { OUTCOME_URI_PREFIX } from "../src/verb-tiddler.js";
import { wikiSlotUri } from "../src/wiki-recipe.js";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import type { ChangeOrigin } from "../src/tiddler-store.js";

const WORKING = wikiSlotUri("daemon", "working");
const origin: ChangeOrigin = { kind: "tw-local", instanceId: "kahua:1" };
const rec = (title: string) => ({ tiddler: { title, text: `body of ${title}` }, meta: {} });
const OUTCOME = `${OUTCOME_URI_PREFIX}req-0001`;
const FLOW = `${DAEMON_BAG_ID}/flows/couple`;

function stack(daemon: "writable" | "read-only" | "absent") {
  const composite = new CompositeStore();
  const working = new MemoryTiddlerStore(WORKING);
  const control = new MemoryTiddlerStore(DAEMON_BAG_ID);
  if (daemon !== "absent") composite.addLayer({ bagId: DAEMON_BAG_ID, store: control, writable: daemon === "writable", defaultWritable: false });
  composite.addLayer({ bagId: WORKING, store: working, writable: true, defaultWritable: true });
  return { composite, working, control };
}

describe("a daemon title routes to the control plane", () => {
  test("RED: a bagless put of a verb outcome or a flow record lands in the daemon layer, never the working top", async () => {
    const { composite, working, control } = stack("writable");
    await composite.put(rec(OUTCOME), origin);
    await composite.put(rec(FLOW), origin);
    expect(await working.get(OUTCOME)).toBeNull();
    expect(await working.get(FLOW)).toBeNull();
    expect((await control.get(OUTCOME))?.tiddler.text).toBe(`body of ${OUTCOME}`);
    expect((await control.get(FLOW))?.tiddler.text).toBe(`body of ${FLOW}`);
  });

  test("RED: a bagless family write of a daemon title lands in the daemon layer", async () => {
    const { composite, working, control } = stack("writable");
    await composite.writeFamily([rec(OUTCOME)], [], origin);
    expect(await working.get(OUTCOME)).toBeNull();
    expect(await control.get(OUTCOME)).not.toBeNull();
  });

  test("RED: with no daemon layer mounted, a daemon title refuses by name and the working top stays empty", async () => {
    const { composite, working } = stack("absent");
    await expect(composite.put(rec(OUTCOME), origin)).rejects.toThrow(/control-plane-title/);
    expect(await working.get(OUTCOME)).toBeNull();
  });

  test("CONTROL: a daemon title seen through a read-only daemon layer never copies up into the working top", async () => {
    const { composite, working } = stack("read-only");
    await expect(composite.put(rec(FLOW), origin, { bag: DAEMON_BAG_ID })).rejects.toThrow(/control-plane-title/);
    expect(await working.get(FLOW)).toBeNull();
  });

  test("CONTROL: an ordinary title still lands in the working top", async () => {
    const { composite, working, control } = stack("writable");
    await composite.put(rec("Plain Note"), origin);
    await composite.put(rec("lar:///ha.ka.ba/t/kahua/note"), origin);
    expect(await working.get("Plain Note")).not.toBeNull();
    expect(await working.get("lar:///ha.ka.ba/t/kahua/note")).not.toBeNull();
    expect(await control.get("Plain Note")).toBeNull();
  });
});
