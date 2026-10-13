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
const DEFAULT_REALM = "default-realm";
const REALM_B = "b".repeat(64);
const meme = (slot: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/ford"\n\`\`\`\n\n<<~ ahu #${slot}>>\n\n! ${slot}\n\n<<~/ahu>>\n\n` +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

const ctx = (): VerbContext => ({
  daemon: {} as CompositeStore,
  invocation: { requestId: "r1" } as VerbContext["invocation"],
  cap: async () => ({ ok: true }),
});

/** B's island: her own writable DAEMON layer and no layer at all for the relation-carried bag, plus a realm
 *  that carries `bags/lares` kept by `keptBy`. `caller` is the nym this vessel pinned when its hand signed. */
function rig(keptBy: readonly string[], caller: string | null) {
  const realmDocs = new Map([[DEFAULT_REALM, new MemoryTiddlerStore(LARES)], [REALM_B, new MemoryTiddlerStore(LARES)]]);
  const realmDoc = realmDocs.get(DEFAULT_REALM)!;
  const composite = new CompositeStore();
  composite.addLayer({ bagId: bagUri("daemon"), store: new MemoryTiddlerStore(bagUri("daemon")), writable: true });
  const opts: MemeVerbOptions = {
    composite,
    tw5: { $tw: { wiki: { getTiddlerText: () => "" } } } as unknown as MemeVerbOptions["tw5"],
    reach: async (key, _bag, realm): Promise<LarTiddlerStore | null> =>
      key === LARES ? realmDocs.get(realm ?? DEFAULT_REALM) ?? null : null,
    realmWritable: async (bag, realm): Promise<LarTiddlerStore | null> => {
      const realmId = realm ?? DEFAULT_REALM;
      const steward = realmId === DEFAULT_REALM ? caller === "nym-a" || caller === "nym-b" || caller === "nym-c" : caller === "nym-b";
      return bag === LARES && steward && keptBy.includes(caller!) ? realmDocs.get(realmId) ?? null : null;
    },
  };
  return { opts, composite, realmDoc, realmDocs };
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

  test("two realms on one vessel keep the same bag name on separate docs", async () => {
    const r = rig(["nym-a", "nym-b"], "nym-b");
    await makeMemePutReactor(r.opts)({ uri: URI, bag: "lares", text: meme("/realm-a") }, ctx());
    await makeMemePutReactor(r.opts)({ uri: URI, bag: "lares", realm: REALM_B, text: meme("/realm-b") }, ctx());
    const defaultGet = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "lares" }, ctx());
    const realmGet = await makeMemeGetReactor(r.opts)({ uri: URI, bag: "lares", realm: REALM_B }, ctx());
    expect((defaultGet["meme"] as { text: string }).text).toContain("#/realm-a");
    expect((realmGet["meme"] as { text: string }).text).toContain("#/realm-b");
    // THE RED: a write to realm B never appears in the default realm's doc, and the default's never in B's.
    const textIn = async (realm: string): Promise<string> => JSON.stringify(await r.realmDocs.get(realm)!.get(URI));
    expect(await textIn(REALM_B)).toContain("#/realm-b");
    expect(await textIn(REALM_B)).not.toContain("#/realm-a");
    expect(await textIn(DEFAULT_REALM)).toContain("#/realm-a");
    expect(await textIn(DEFAULT_REALM)).not.toContain("#/realm-b");
  });

  test("named realm refuses an unkept hand and recipe container", async () => {
    const r = rig(["nym-a"], "nym-a");
    await expect(makeMemePutReactor(r.opts)({ uri: URI, bag: "lares", realm: REALM_B, text: meme("/no") }, ctx()))
      .rejects.toThrow(`meme: bag "${LARES}" holds no steward's write in realm ${REALM_B}`);
    expect(await r.realmDocs.get(REALM_B)!.get(URI)).toBeNull();
    // CONTROL: the same hand, a steward of the DEFAULT realm, lands its put where no realm gets named.
    expect(await refusalOf(r.opts)).toBe("(landed)");
    await expect(makeMemeGetReactor(r.opts)({ uri: URI, recipe: "lares", realm: REALM_B }, ctx()))
      .rejects.toThrow(/^no-container: /);
  });

  test("a realm with no folded standing plane reads not-found", async () => {
    const r = rig(["nym-a"], "nym-a");
    await expect(makeMemeGetReactor(r.opts)({ uri: URI, bag: "lares", realm: "c".repeat(64) }, ctx()))
      .rejects.toThrow("holds no layer in this island and nothing reaches it by access in realm");
  });
  test("a wiki slot reads in no realm; control: the same slot with no realm named draws another answer", async () => {
    const r = rig(["nym-a"], "nym-a"), slot = "lar:///ha.ka.ba/wikis/lares/working";
    await expect(makeMemeGetReactor(r.opts)({ uri: URI, bag: slot, realm: REALM_B }, ctx())).rejects.toThrow(/^no-container: .*a wiki slot lives in no realm/);
    await expect(makeMemeGetReactor(r.opts)({ uri: URI, bag: slot }, ctx())).rejects.not.toThrow(/lives in no realm/);
  });
});
