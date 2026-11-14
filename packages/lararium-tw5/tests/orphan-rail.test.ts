/**
 * THE ORPHAN RAIL (wiki-surface-scout #/meme-aware-actions) — one predicate and one alert, shared by the
 * node projector and the browser mirror. Each device raises its own flag from its own view:
 * `$:/temp/lares/alert/meme-orphan/<root>`, naming the root, the orphans and a log cursor, never a clock.
 *
 * Driven over a real wiki, the surface both halves hold.
 */
import { describe, expect, test } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { memeAlertTitle, surfaceMemeAlert, tendOrphanAlert, tendOrphanAlerts } from "../src/place-meme.js";
import { memeOrphanAlertTitle } from "@lararium/mesh/family";

const CARRIER = "text/memetic-wikitext+tiddlywiki";
const ROOT = "lar:///t/orphan-rail/root";

interface Wiki {
  addTiddler(fields: Record<string, unknown>): void;
  deleteTiddler(title: string): void;
  getTiddler(title: string): { fields: Record<string, unknown> } | undefined;
  getChangeCount(title: string): number;
  allTitles(): string[];
}

async function wikiWith(records: Array<Record<string, unknown>>): Promise<Wiki> {
  const engine = await bootTestWiki();
  const wiki = engine.$tw.wiki as unknown as Wiki;
  for (const record of records) wiki.addTiddler(record);
  return wiki;
}
const slot = (path: string, parent: string) => ({ title: `${ROOT}#${path}`, type: CARRIER, text: `body of ${path}`, "$fragment-parent": parent, "$slot": path });

describe.skipIf(wikiSkip)(`the orphan rail${skipNote}`, () => {
  test("★ slots under a dead root raise one alert naming the root, the orphans and a cursor; the root's return clears it ★", async () => {
    const wiki = await wikiWith([slot("/a", ROOT), slot("/a/deep", `${ROOT}#/a`), slot("/b", ROOT)]);
    const flag = memeOrphanAlertTitle(ROOT);
    const found = tendOrphanAlerts(wiki as never);
    expect([...found.keys()]).toEqual([ROOT]);
    const alert = wiki.getTiddler(flag)!.fields;
    expect(alert).toMatchObject({ root: ROOT, "alert-kind": "meme-orphan", orphans: `${ROOT}#/a ${ROOT}#/a/deep ${ROOT}#/b` });
    expect(alert["tags"]).toEqual(["$:/tags/Alert"]);
    expect(alert["seen-at"]).toBe(`${ROOT}@${wiki.getChangeCount(ROOT)}`);
    expect(alert["ts"]).toBeUndefined();
    // The children stay live, as the plain tiddlers they stand as.
    expect(wiki.getTiddler(`${ROOT}#/a/deep`)?.fields["text"]).toBe("body of /a/deep");

    // An unchanged finding writes nothing.
    const writes = wiki.getChangeCount(flag);
    tendOrphanAlerts(wiki as never);
    expect(wiki.getChangeCount(flag)).toBe(writes);

    wiki.addTiddler({ title: ROOT, type: CARRIER, text: "root\n\n<<~ kahea ahu slot=`#/a`>>\n" });
    expect(tendOrphanAlert(wiki as never, ROOT)).toEqual([]);
    expect(wiki.getTiddler(flag)).toBeUndefined();
  });

  test("control: a whole family raises nothing", async () => {
    const wiki = await wikiWith([{ title: ROOT, type: CARRIER, text: "root" }, slot("/a", ROOT)]);
    expect(tendOrphanAlerts(wiki as never).size).toBe(0);
    expect(wiki.getTiddler(memeOrphanAlertTitle(ROOT))).toBeUndefined();
  });

  test("the child gate's rail names a log cursor, never a wall clock", async () => {
    const wiki = await wikiWith([{ title: ROOT, type: CARRIER, text: "root" }, slot("/a", ROOT)]);
    surfaceMemeAlert(wiki as never, ROOT, { child: `${ROOT}#/a`, codes: ["torn"], why: "a test finding" });
    const alert = wiki.getTiddler(memeAlertTitle(ROOT))!.fields;
    expect(alert["seen-at"]).toBe(`${ROOT}#/a@${wiki.getChangeCount(`${ROOT}#/a`)}`);
    expect(alert["ts"]).toBeUndefined();
  });
});
