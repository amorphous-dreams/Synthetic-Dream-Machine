/**
 * wiki-mount-private-alias — A CATALOG POINTER NEVER RESOLVES A WIKI ONTO A VESSEL'S PRIVATE DOCUMENT (lane `ralias`; the
 * train's Sol read, cross-lane lead porch5 × ralias).
 *
 * The cold-wiki mount (W27's fenced mount and every activation on reference) resolves the wiki's canon document through the
 * catalog row `wikiBagUri(slug)` alone (`vessel-residency-wiring.ts` resolveWikiSpec). The island it teaches stands inside
 * the house, and the house's own islands never reach the share guard (`self-slot-share.ts`), so a catalog row that aliases
 * a cold wiki onto another face's plane, the daemon document or the catalog would hand that document to the island as the
 * wiki's canon, and its tiddlers would materialize there.
 *
 *   M0  MEASURE: with no refusal seated, an aliased cold wiki teaches the pool a spec whose wiki canon reads face B's plane.
 *   M1  RED: with the vessel's refusal seated (`wikiDocRefused`), the resolution refuses `no-read-grant` and teaches nothing.
 *   M1c CONTROL: an ordinary wiki canon still resolves and teaches its spec.
 */
import { describe, expect, test } from "vitest";
import { deterministicDocUrl, storedLarRecord, wikiBagUri, type LarDoc } from "@lararium/mesh";
import { makeVesselResidency } from "../src/vessel-residency-wiring.js";

let n = 0;
const generateAutomergeUrl = (): string => deterministicDocUrl(`ralias-mount-${n++}`);
const PLANE_B = generateAutomergeUrl();                        // face B's circles plane, classed vessel-private
const ORDINARY = generateAutomergeUrl();                       // an ordinary wiki canon
const idOf = (url: string): string => url.replace(/^automerge:/, "");

function rig(refused: ((wikiUrl: string) => string | null) | undefined) {
  const catalog = { tiddlers: {
    [wikiBagUri("borrowed")]: storedLarRecord(wikiBagUri("borrowed"), { text: PLANE_B }, "alias"),
    [wikiBagUri("ordinary")]: storedLarRecord(wikiBagUri("ordinary"), { text: ORDINARY }, "lararium-seed"),
  } } as unknown as LarDoc;
  const taught: Array<{ wikiId: string; wikiUrl: unknown }> = [];
  const pool = {
    has: () => false, knowsSpec: () => false,
    registerSpec: (wikiId: string, spec: { grants?: { wikiUrl?: string } }) => { taught.push({ wikiId, wikiUrl: spec.grants?.wikiUrl }); },
    ensureWiki: async () => {}, unmountWiki: async () => {}, placeWikiVerb: async () => ({}),
  };
  const daemon = {
    resolveBinding: async () => ({ personalUrl: generateAutomergeUrl(), draftUrl: generateAutomergeUrl(), workingUrl: generateAutomergeUrl() }),
    onEvictRequest: () => {}, onResidencyOp: () => {}, onWikiAlert: () => {}, daemonHandle: {},
  };
  const { wireToPool } = makeVesselResidency(
    () => pool as never,
    { wikiActivationCap: 4, wikiPinBudget: 3, ...(refused ? { wikiDocRefused: refused } : {}) } as never,
    { onUndeliverableAlert: () => {} },
  );
  const cap = wireToPool({ daemon: daemon as never, pool: pool as never, coreHash: "c0", islandUrl: generateAutomergeUrl(), catalogHandle: { doc: () => catalog, url: generateAutomergeUrl() } as never });
  return { cap, taught };
}
const classed = (wikiUrl: string): string | null => (idOf(wikiUrl) === idOf(PLANE_B) ? "vessel-private" : null);

describe("a catalog pointer never resolves a wiki onto a vessel-private document", () => {
  test("M0 — MEASURE: with no refusal seated, the aliased cold wiki teaches the pool face B's plane as its canon", async () => {
    const { cap, taught } = rig(undefined);
    await cap.ensureActive("borrowed").catch(() => undefined);
    expect(taught.map((t) => t.wikiUrl)).toContain(PLANE_B);
  });

  test("M1/M1c — RED: the refusal seated, the aliased wiki refuses and teaches nothing; an ordinary wiki still resolves", async () => {
    const { cap, taught } = rig(classed);
    const res = await cap.ensureActive("borrowed").catch((e: unknown) => ({ ok: false, cause: String(e), detail: "" }));
    expect(taught.map((t) => t.wikiUrl), "M1: no spec names the private document").not.toContain(PLANE_B);
    expect(res).toMatchObject({ ok: false, cause: "no-read-grant" });
    await cap.ensureActive("ordinary").catch(() => undefined);
    expect(taught.map((t) => t.wikiUrl), "M1c: the ordinary canon resolves").toContain(ORDINARY);
  });
});
