/**
 * meme-realm-write.test — THE STEWARD WRITE PATH: `meme put --bag <x>` for a bag the REALM carries.
 *
 * The ruling (realm-bag-brief #/what-a-relation-bag-needs, item 5): the read cap is CONTRACT — the whole
 * contracted cabal — and the write cap is the NAMED STEWARDS' SET. The daemon island mounts no layer for a
 * relation-carried bag (it is nobody's mounted layer; the read reaches it by access), so today EVERY put to
 * it refuses. A put now resolves the realm doc's OWN store first, for a caller whose nym stands in the
 * standing registration's `keptBy`, and falls through unchanged for every other hand.
 *
 * Proven:
 *   · a steward's put lands on the REALM doc — the ford's one book,
 *   · a hand outside `keptBy` draws `holds no writable layer` BYTE-IDENTICAL to the refusal it draws with no
 *     realm at all (the CONTROL that pins the refusal's bytes),
 *   · a bag the realm carries nothing for falls through untouched,
 *   · the READ path is unmoved — a get still reaches the realm doc by access.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore, bagUri, type LarTiddlerStore } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeMemePutReactor, makeMemeGetReactor, type MemeVerbOptions } from "../src/meme-verbs.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URI = "lar:///t/ford";
const LARES = bagUri("lares");
const meme = (slot: string): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n<<~ ahu #${slot}>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

const ctx = (): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "r1" } as VerbContext["invocation"],
  cap: async () => ({ ok: true }),
});

/** B's island: her own writable DAEMON layer and no layer at all for the relation-carried bag, plus a realm
 *  that carries `bags/lares` kept by `keptBy`. `caller` is the nym this vessel pinned when its hand signed. */
function rig(keptBy: readonly string[], caller: string | null) {
  const realmDoc = new MemoryTiddlerStore(LARES);
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    reach: async (key): Promise<LarTiddlerStore | null> => (key === LARES ? realmDoc : null),
    realmWritable: async (bag): Promise<LarTiddlerStore | null> =>
      bag === LARES && caller !== null && keptBy.includes(caller) ? realmDoc : null,
  };
  return { opts, composite, realmDoc };
}

const refusalOf = async (opts: MemeVerbOptions, bag = "lares"): Promise<string> => {
  try { await makeMemePutReactor(opts)({ uri: URI, bag, text: meme("/x") }, ctx()); return "(landed)"; }
  catch (e) { return e instanceof Error ? e.message : String(e); }
};

describe("meme-put --bag — a bag the realm carries", () => {
  test("a STEWARD's put lands on the REALM doc — B writes the ford's one book", async () => {
    const r = rig(["nym-a", "nym-b"], "nym-b");
    const receipt = await makeMemePutReactor(r.opts)({ uri: URI, bag: "lares", text: meme("/b") }, ctx());
    expect(receipt["decision"]).toBe("ingest");
    expect(await r.realmDoc.get(URI)).not.toBeNull();
  });

  test("CONTROL: a hand outside keptBy draws `holds no writable layer`, byte-identical to no-realm-at-all", async () => {
    const outside = rig(["nym-a"], "nym-c");
    const noRealm = rig([], null);
    delete (noRealm.opts as { realmWritable?: unknown }).realmWritable;
    const said = await refusalOf(outside.opts);
    expect(said).toContain("holds no writable layer");
    expect(said).toBe(await refusalOf(noRealm.opts));
    expect(await outside.realmDoc.get(URI)).toBeNull();
  });

  test("CONTROL: a bag the realm carries nothing for falls through untouched", async () => {
    const r = rig(["nym-a"], "nym-a");
    expect(await refusalOf(r.opts, "garden")).toContain("holds no writable layer");
  });

  test("CONTROL: the READ path is unmoved — a get still reaches the realm doc by access", async () => {
    const r = rig(["nym-a"], "nym-a");
    await makeMemePutReactor(r.opts)({ uri: URI, bag: "lares", text: meme("/a") }, ctx());
    const got = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "lares" }, ctx());
    expect((got["meme"] as { text: string } | null)?.text).toContain("#/a");
  });
});
