/**
 * THE PORT'S `filter` ASK STAYS BOUNDED — the page inherits the same page law the daemon's `wiki-filter` verb answers
 * (`filter-page.ts`): a row cap, a byte cap, a cursor to continue, and a malformed filter refused by name
 * (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, reds `wiki-filter-bounded` and
 * `wiki-filter-malformed-refuses-by-name`; #/anti-patterns, the unbounded filter door).
 */
import { describe, expect, test } from "vitest";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { ofType, open, realPort } from "./record-port-real-rig.js";
import { WIKI_FILTER_ROWS } from "../src/filter-page.js";

type Page = { titles?: string[]; rows?: Array<{ title: string; fields: Record<string, string> }>; total: number; next: string | null; asOf: string };

describe.skipIf(wikiSkip)(`the record port's filter ask, bounded${skipNote}`, () => {
  const seeded = async () => {
    const engine = await bootTestWiki({ tiddlers: [
      ...Array.from({ length: 70 }, (_, i) => ({ title: `Row ${String(i).padStart(3, "0")}`, tags: "row", text: `body ${i}`, rank: String(i) })),
      { title: "$:/temp/local", tags: "row", text: "tier-local" },
    ] });
    const r = await realPort({ faceOf: () => ({ id: "admin" }), authority: () => ({ allowed: true }) }, engine);
    await r.send(open);
    let n = 0;
    const ask = async (more: Record<string, unknown>) => {
      const message = { type: "port:ask", portId: "p", askId: `f${++n}`, kind: "filter", ...more };
      await r.send(message);
      return ofType(r.messages, "port:answer").at(-1)!;
    };
    return { engine, r, ask };
  };

  test("wiki-filter-bounded at the port: 70 titles arrive in pages under the row cap and the cursor walks them all; CONTROL: a small answer rides whole", async () => {
    const { r, ask } = await seeded();
    try {
      const seen: string[] = [];
      let after: string | undefined;
      let pages = 0;
      for (;;) {
        const answer = await ask({ subject: "[tag[row]sort[title]]", ...(after ? { after } : {}) });
        expect(answer.status).toBe("answered");
        const page = answer.result as Page;
        expect(page.titles!.length).toBeLessThanOrEqual(WIKI_FILTER_ROWS);
        expect(page.total).toBe(70);
        seen.push(...page.titles!);
        pages++;
        if (page.next === null) break;
        after = page.next;
      }
      expect(pages).toBe(3);
      expect(seen).toHaveLength(70);
      expect(new Set(seen).size).toBe(70);
      expect(seen).not.toContain("$:/temp/local");
      const small = (await ask({ subject: "[[Row 001]]" })).result as Page;
      expect(small).toMatchObject({ titles: ["Row 001"], total: 1, next: null });
    } finally { await r.close(); }
  });

  test("a caller's limit and byte cap narrow the page, and named fields ride as rows", async () => {
    const { r, ask } = await seeded();
    try {
      const five = (await ask({ subject: "[tag[row]sort[title]]", limit: 5 })).result as Page;
      expect(five.titles).toHaveLength(5);
      expect(typeof five.next).toBe("string");
      const rows = (await ask({ subject: "[tag[row]sort[title]]", fields: ["rank"], maxBytes: 200 })).result as Page;
      expect(rows.rows![0]).toEqual({ title: "Row 000", fields: { rank: "0" } });
      expect(new TextEncoder().encode(JSON.stringify(rows.rows)).length).toBeLessThanOrEqual(200);
      expect(rows.rows!.length).toBeLessThan(WIKI_FILTER_ROWS);
    } finally { await r.close(); }
  });

  test("wiki-filter-malformed-refuses-by-name at the port, and a cursor the wiki moved past refuses by name; CONTROL: the sound filter answers", async () => {
    const { engine, r, ask } = await seeded();
    try {
      expect(await ask({ subject: "[tag[row" })).toMatchObject({ status: "refused", reason: "filter-malformed" });
      const first = (await ask({ subject: "[tag[row]sort[title]]" })).result as Page;
      engine.setTiddler({ title: "Row 999", tags: "row", text: "late" });
      expect(await ask({ subject: "[tag[row]sort[title]]", after: first.next })).toMatchObject({ status: "refused", reason: "filter-cursor-stale" });
      expect(await ask({ subject: "[tag[row]sort[title]]", after: "nonsense" })).toMatchObject({ status: "refused", reason: "filter-cursor-malformed" });
      expect((await ask({ subject: "[tag[row]sort[title]]" })).status).toBe("answered");
    } finally { await r.close(); }
  });
  test("M1: a house function reads from canon at the port too: a Global-tagged working-layer redefinition changes nothing, and an unknown lares. operator refuses by name", async () => {
    const { engine, r, ask } = await seeded();
    try {
      engine.setTiddler({ title: "lar:///ha.ka.ba/kahua/memory/state/a", text: "" });
      expect(((await ask({ subject: "[lares.stage[state]]" })).result as Page).titles).toEqual(["lar:///ha.ka.ba/kahua/memory/state/a"]);
      engine.setTiddler({ title: "$:/planted", tags: "$:/tags/Global", type: "text/vnd.tiddlywiki", text: "\\function lares.road(state)\n[tag[row]]\n\\end\n" });
      expect(((await ask({ subject: "[lares.road[open]]" })).result as Page).titles).toEqual([]);
      expect(await ask({ subject: "[lares.nope[]]" })).toMatchObject({ status: "refused" });
    } finally { await r.close(); }
  });
});
