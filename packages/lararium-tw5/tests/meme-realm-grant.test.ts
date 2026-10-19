/**
 * meme-realm-grant.test — a bag the REALM carries answers by the realm's grant, never by this vessel's own registry.
 *
 * A member reads a book another operator keeps through the realm that registers it; the member's Keyhive never
 * registered that book, since the book is nobody's local layer here. So `meme get --bag <book> --realm <id>` reads
 * the registration's doc on the realm's grant (its counted, steward-signed registration at the read tier), and a
 * steward's `meme put --bag <book> --realm <id>` writes on the steward check alone. A bag reached any other way
 * still asks this vessel's own cap.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/ford";
const BOOK = bagUri("ford-book");
const REALM = "c".repeat(64);
const meme = (slot: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu #${slot}>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

/** This vessel's own registry knows no realm-carried book: every cap ask refuses as the vessel's Keyhive does. */
const unregistered = (): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "r1" } as VerbContext["invocation"],
  cap: async (_access, bag) => ({ ok: false, reason: `bag not registered: ${bag}` }),
});

function rig() {
  const realmDoc = new MemoryTiddlerStore(BOOK);
  const own = new MemoryTiddlerStore(BOOK);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: BOOK, store: own, writable: true });
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    reach: async (key, _bag, realm): Promise<LarTiddlerStore | null> => (key === BOOK && realm === REALM ? realmDoc : null),
    realmWritable: async (bag, realm): Promise<LarTiddlerStore | null> => (bag === BOOK && realm === REALM ? realmDoc : null),
  };
  return { opts, realmDoc, own };
}

describe("a realm-carried bag answers by the realm's grant", () => {
  test("a member's get through the named realm reads the registration's doc with no local registration", async () => {
    const r = rig();
    const placed = await makeMemePutReactor(r.opts)({ uri: URI, bag: "ford-book", realm: REALM, text: meme("/a") }, unregistered());
    expect(placed["decision"]).toBe("ingest");
    const got = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "ford-book", realm: REALM }, unregistered());
    expect(String((got["meme"] as { text?: unknown } | undefined)?.text ?? "")).toContain("! /a");
    expect(await r.own.get(URI)).toBeNull();
  });

  test("CONTROL: the same bag reached without a realm still asks this vessel's own cap", async () => {
    const r = rig();
    const said = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "ford-book" }, unregistered()).then(() => "(read)", (e: Error) => e.message);
    expect(said).toContain("cap-denied: read on");
    const put = await makeMemePutReactor(r.opts)({ uri: URI, bag: "ford-book", text: meme("/a") }, unregistered()).then(() => "(landed)", (e: Error) => e.message);
    expect(put).toContain("cap-denied: admin on");
  });
});
