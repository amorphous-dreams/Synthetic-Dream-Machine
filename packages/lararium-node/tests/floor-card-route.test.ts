/**
 * floor-card-route — the floor card rides the real tiddler door: `tiddler-put` into a daemon wiki lands it once (`put`), a
 * second put of the same bytes answers `noop`, a new cause lands again, and the title and fields survive the round trip.
 * The title stands in the kahua state namespace, never canon's, so no offer or promote reaches it.
 *
 * Meme: lar:///ha.ka.ba/kahua/memory/research/floor-mu#/shape
 */
import { describe, expect, test } from "vitest";
import { CompositeStore, bagUri } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, type TiddlerVerbOptions } from "../../lararium-tw5/src/tiddler-verbs.js";
import type { VerbContext } from "../../lararium-tw5/src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "../../lararium-tw5/tests/test-wiki.js";
import { floorCardFor, readFloorDrifts } from "../src/floor-card.js";

const DAEMON = bagUri("daemon");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const writer = (async (access: string, bag: string) => (bag === DAEMON || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" })) as never;
const ctx = (): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: writer });

const cardFor = (count: number) => floorCardFor(readFloorDrifts({
  canon: { drift: { manifest: "f".repeat(64), count, carriers: Array.from({ length: count }, (_, i) => `lar:///ha.ka.ba/lararium/mesh/c${i}`), slugs: [], unread: [] } },
  seed: null, shadow: null, lag: undefined,
}), { vessel: "0xvessel", nexus: "aid" });

describe.skipIf(wikiSkip)(`the floor card on the real tiddler door${skipNote}`, () => {
  test("RED: put, then noop, then put on a new cause; the title and fields survive", async () => {
    const engine = await bootTestWiki({ tiddlers: [{ title: WORKING_POINTER, text: DAEMON }] });
    const composite = new CompositeStore();
    composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
    const opts: TiddlerVerbOptions = { composite, tw5: engine };
    const put = async (card: ReturnType<typeof cardFor>) =>
      makeTiddlerPutReactor(opts)({ recipe: "default", title: card.title, text: card.text, fields: card.fields }, ctx());
    const first = cardFor(1);
    expect((await put(first))["decision"]).toBe("put");
    expect((await put(first))["decision"]).toBe("noop");
    const got = await makeTiddlerGetReactor(opts)({ recipe: "default", title: first.title }, ctx());
    const fields = (got["tiddler"] as { fields: Record<string, string> }).fields;
    expect(fields["title"]).toBe(first.title);
    expect(fields["text"]).toBe(first.text);
    expect(fields["floor-cause"]).toBe(first.fields["floor-cause"]);
    expect(fields["floor-state"]).toBe("armed");
    expect(fields["tags"]).toBe("floor-card");
    expect((await put(cardFor(2)))["decision"]).toBe("put");
    expect(first.title.startsWith("lar:///ha.ka.ba/kahua/memory/state/floor-")).toBe(true);
  });
});
