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
import { VerbTable } from "../src/verb-dispatcher.js";

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
  test("M1: a house function reads from canon at the port too: a Global-tagged working-layer redefinition changes nothing, and an unknown lares. operator refuses by name, direct or by indirection", async () => {
    const { engine, r, ask } = await seeded();
    try {
      engine.setTiddler({ title: "lar:///ha.ka.ba/kahua/memory/state/a", text: "" });
      engine.setTiddler({ title: "lar:///ha.ka.ba/kahua/memory/course/open.one.waits", tags: "stage/course", text: "" });
      expect(((await ask({ subject: "[lares.stage[state]]" })).result as Page).titles).toEqual(["lar:///ha.ka.ba/kahua/memory/state/a"]);
      engine.setTiddler({ title: "lar:///ha.ka.ba/kahua/road/open-one", tags: "stage/road road/state/open", text: "" });
      expect(((await ask({ subject: "[lares.road[open]]" })).result as Page).titles).toEqual(["lar:///ha.ka.ba/kahua/road/open-one"]);
      const open1 = ["lar:///ha.ka.ba/kahua/memory/course/open.one.waits"];
      expect(((await ask({ subject: "[lares.course[open]]" })).result as Page).titles).toEqual(open1);
      engine.setTiddler({ title: "$:/planted", tags: "$:/tags/Global", type: "text/vnd.tiddlywiki", text: "\\function lares.course(standing)\n[tag[row]]\n\\end\n" });
      expect(((await ask({ subject: "[lares.course[open]]" })).result as Page).titles).toEqual(open1);
      expect(await ask({ subject: "[lares.nope[]]" })).toMatchObject({ status: "refused" });
      engine.setTiddler({ title: "$:/y", text: "[lares.bogus[]]" });
      expect(await ask({ subject: "[subfilter{$:/y}]" })).toMatchObject({ status: "refused" });
    } finally { await r.close(); }
  });
});

/** One carrier standing in the island's own wiki: its root, its `#/takes` and its `#/skins`, the act seated by address. */
const ECHO = "lar:///test.echo.answers";
const ECHO_SEAT = "lar:///ha.ka.ba/lares/afford/test.echo.answers";

describe.skipIf(wikiSkip)(`the record port's call ask: the glass speaks the one call${skipNote}`, () => {
  const seated = async () => {
    const engine = await bootTestWiki({ tiddlers: [
      { title: ECHO_SEAT, tags: `lar:///ha.ka.ba/lares/api/pono/affordance ${ECHO}`, text: "! test.echo.answers ~ the echo the port's call reaches" },
      { title: `${ECHO_SEAT}#/takes`, text: "<<has entity=`arg` name=`word` params=`needs/required ~ the word echoed`>>" },
      { title: `${ECHO_SEAT}#/skins`, text: "<<has entity=`skin` name=`tw5` params=`spells/echo-word ~ the glass`>>" },
    ] });
    const ran: Array<Record<string, unknown>> = [];
    const verbs = () => {
      const table = new VerbTable();
      table.register("echo-word", async (args) => { ran.push({ ...args }); return { has: "<<~ has name=`echo`>>", echoed: args["word"] }; });
      table.answer(ECHO, "echo-word");
      return table;
    };
    const r = await realPort({ faceOf: () => ({ id: "admin" }), authority: () => ({ allowed: true }), verbs }, engine);
    await r.send(open);
    let n = 0;
    const ask = async (more: Record<string, unknown>) => {
      await r.send({ type: "port:ask", portId: "p", askId: `c${++n}`, kind: "call", ...more });
      return ofType(r.messages, "port:answer").at(-1)!;
    };
    return { r, ask, ran };
  };

  test("RED: a call ask carrying {verb, params} resolves the address over the island's own stack, binds the carrier's #/takes and runs the seated verb, its answer naming the carrier; a sigil rides the same ask; CONTROL: a missing param refuses by name and runs nothing", async () => {
    const { r, ask, ran } = await seated();
    try {
      const by = await ask({ subject: ECHO, args: { word: "hi" } });
      expect(by).toMatchObject({ status: "answered", result: { echoed: "hi", carrier: { carrier: ECHO_SEAT } } });
      expect(String((by.result as Record<string, unknown>)["has"])).toContain(`carrier/${ECHO_SEAT}`);
      expect(await ask({ subject: "echo-word", args: { word: "by its spelling" } })).toMatchObject({ status: "answered", result: { echoed: "by its spelling" } });
      expect(await ask({ subject: `<<~ "${ECHO}" word=\`by sigil\`>>` })).toMatchObject({ status: "answered", result: { echoed: "by sigil" } });
      expect(ran).toEqual([{ word: "hi" }, { word: "by its spelling" }, { word: "by sigil" }]);
      expect(await ask({ subject: ECHO, args: {} })).toMatchObject({ status: "refused", reason: "param-needed" });
      expect(ran).toHaveLength(3);
    } finally { await r.close(); }
  });
});
