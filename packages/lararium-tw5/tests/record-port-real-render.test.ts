import { describe, expect, test } from "vitest";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { ofType, open, realPort } from "./record-port-real-rig.js";

type RenderBlock = { kind: string; affordances: { id: string; kind: string }[]; children: RenderBlock[] };
const buttons = (block: RenderBlock): string[] => [
  ...(block.kind === "button" ? block.affordances.filter((affordance) => affordance.kind === "click").map((affordance) => affordance.id) : []),
  ...block.children.flatMap(buttons),
];

describe.skipIf(wikiSkip)(`real TW5 retained render${skipNote}`, () => {
  test("port-real-tw5-change-stales-render: a transcluded real button refuses after wiki refresh; CONTROL: quiet invoke fires and fresh render fires", async () => {
    const engine = await bootTestWiki({ tiddlers: [
      { title: "Screen", type: "text/vnd.tiddlywiki", text: "{{Inner}}" },
      { title: "Inner", type: "text/vnd.tiddlywiki", text: '<$button><$action-setfield $tiddler="Fire" text="once"/>Go</$button>' },
      { title: "Fire", text: "zero" },
    ] });
    const r = await realPort({ faceOf: () => ({ id: "admin" }), authority: () => ({ allowed: true }) }, engine);
    try {
      await r.send(open);
      const render = async (askId: string) => {
        await r.send({ type: "port:ask", portId: "p", askId, kind: "render", subject: "Screen", form: "blocks" });
        const answer = ofType(r.messages, "port:answer").at(-1)!;
        expect(answer.status).toBe("answered");
        const result = answer.result as { renderCursor: string; value: RenderBlock };
        const id = buttons(result.value)[0];
        expect(id).toBeDefined();
        return { cursor: result.renderCursor, id: id! };
      };
      const invoke = async (askId: string, cursor: string, affordanceId: string) => {
        await r.send({ type: "port:ask", portId: "p", askId, kind: "invoke", renderCursor: cursor, affordanceId });
        return ofType(r.messages, "port:answer").at(-1)!;
      };
      const first = await render("render-1");
      expect((await invoke("quiet", first.cursor, first.id)).status).toBe("answered");
      expect(engine.wiki.getTiddlerText("Fire")).toBe("once");
      engine.wiki.addTiddler(new engine.$tw.Tiddler({ title: "Inner", type: "text/vnd.tiddlywiki",
        text: '<$button><$action-setfield $tiddler="Fire" text="twice"/>Go again</$button>' }));
      await r.send({ type: "port:ack", portId: "p", cursor: first.cursor });
      const stale = await invoke("stale", first.cursor, first.id);
      expect(stale).toMatchObject({ status: "refused", reason: "stale-cursor" });
      expect(engine.wiki.getTiddlerText("Fire")).toBe("once");
      const fresh = await render("render-2");
      expect((await invoke("fresh", fresh.cursor, fresh.id)).status).toBe("answered");
      expect(engine.wiki.getTiddlerText("Fire")).toBe("twice");
    } finally { await r.close(); }
  });
});
