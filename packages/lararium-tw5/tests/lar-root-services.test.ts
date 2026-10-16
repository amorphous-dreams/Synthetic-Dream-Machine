/**
 * lar-root-services — the island's root `tm-*` services (dreamdom#/host-services, open ruling 9 as the house reads it).
 *
 * The house plugin's `lar-root-services` startup module registers the root-widget listeners a worker island
 * otherwise lacks (stock TW5 binds them under `platforms: ["browser"]` alone), split in two:
 *
 *   - PURE WIKI LOGIC the island runs itself: `tm-rename-tiddler`, `tm-relink-tiddler`, `tm-home`, `tm-modal`,
 *     `tm-show-switcher`, `tm-notify`; `tm-scroll` and `tm-focus-selector` ride as HINTS the frame carries
 *     (`data-lar-scroll-to` / `data-lar-focus` beside a rising `data-lar-hint`, in the root layer of the
 *     `lar:surface` key), so the page scrolls and focuses and the island never measures.
 *   - HOST DOORS the surface opens: `tm-copy-to-clipboard`, `tm-download-file`, `tm-open-window`,
 *     `tm-open-external-window`, `tm-print`, `tm-full-screen` post `lar:service{requestId, kind, args,
 *     userActivation: true}` through `ctx.post`, gated at once by the manifest the surface opened with
 *     (`lar:resend{manifest}`; absent one, `LAR_SURFACE_DEFAULT_SERVICES`). A kind outside it answers the act
 *     `refused: page-action-unavailable` and raises `$:/temp/lares/alert/refused/<kind>`; no ask crosses.
 *   - `tm-http-request` refuses by name under the Web3-only law: `$:/temp/lares/alert/refused/http-request`.
 *
 * `lar:service-result` correlates by `requestId`: `ok` runs the asking message's success leg (the clipboard's
 * notification), a named refusal raises the kind's alert, and an id the island never minted answers
 * `refused: unknown-request`.
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_SERVICE, mkLarResend, readLarService,
  type LarMsg_Service, type LarServiceKind,
} from "@lararium/mesh";
import { dispatchLarControlEvent, resendLarCamera } from "../src/tw5-projection.js";
import { htmlOf, mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const T = (n: string): string => `lar:///t/services/${n}`;
const asks = (s: Surface): LarMsg_Service[] => s.others.map(readLarService).filter((m): m is LarMsg_Service => m !== null);
const alert = (s: Surface, kind: string): Record<string, unknown> | undefined => s.wiki.getTiddler(`$:/temp/lares/alert/refused/${kind}`)?.fields;

/** Open the surface with a manifest, the way a page opens: a resend carrying the kinds it carries. */
async function open(s: Surface, services: readonly LarServiceKind[]): Promise<void> {
  resendLarCamera(mkLarResend(LAR_CAMERA_STORY, { services }), s.ctx.wikiUri);
  await s.flush();
}
const click = (s: Surface, cls: string) => dispatchLarControlEvent(s.event(cls, { kind: "lar:act", action: "lar:click" }));
const answer = (s: Surface, requestId: string, status: string) => dispatchLarControlEvent(s.event("", {
  kind: "lar:service-result", action: "lar:service-result", controlId: "lar:document", requestId, status: status as "ok",
}));

/** A button whose actions send one message, with `$param` and the named parameters a stock caller passes. */
const send = (cls: string, message: string, params: Record<string, string> = {}): string =>
  `<$button class="${cls}" actions="""<$action-sendmessage $message="${message}" ${Object.entries(params).map(([k, v]) => `${k}="${v}"`).join(" ")}/>""">${cls}</$button>`;

const BUTTONS = [
  `<$button class="copy" message="tm-copy-to-clipboard" param="copy me">copy</$button>`,
  `<$button class="dl" message="tm-download-file" param="${T("text")}">download</$button>`,
  `<$button class="print" message="tm-print">print</$button>`,
  `<$button class="full" message="tm-full-screen" param="enter">full</$button>`,
  `<$button class="win" message="tm-open-window" param="${T("text")}">window</$button>`,
  `<$button class="ext" message="tm-open-external-window" param="https://example.org/">external</$button>`,
  send("http", "tm-http-request", { url: "https://example.org/" }),
].join("");
const WORLD = [{ title: T("text"), text: "copy me" }];

describe.skipIf(wikiSkip)(`the island's root services${skipNote}`, () => {
  let s: Surface | undefined;
  afterEach(() => { s?.stop(); s = undefined; });

  test("RED: a copy button asks lar:service clipboard with its text under a person's activation, and the act applies — CONTROL: no ask crosses before the click", async () => {
    s = await mountSurface(BUTTONS, WORLD);
    expect(asks(s), "nothing asks a door before a person acts").toEqual([]);
    expect(click(s, "copy")).toMatchObject({ status: "applied" });
    const [ask] = asks(s);
    expect(ask).toMatchObject({ type: LAR_SERVICE, wikiUri: s.ctx.wikiUri, kind: "clipboard", args: { text: "copy me" }, userActivation: true });
    expect(ask!.requestId).toMatch(/\S/);
  }, 120_000);

  test("RED: print outside the default manifest refuses at once — page-action-unavailable on the act, the alert raised, no ask — CONTROL: download and clipboard, inside it, ask", async () => {
    s = await mountSurface(BUTTONS, WORLD);
    expect(click(s, "print")).toMatchObject({ status: "refused", reason: "page-action-unavailable" });
    await s.flush();
    expect(asks(s), "a refused door asks nothing").toEqual([]);
    expect(alert(s, "print")).toMatchObject({ tags: ["$:/tags/Alert"] });
    for (const cls of ["full", "ext"]) expect(click(s, cls), `${cls} stands outside the default manifest`).toMatchObject({ status: "refused", reason: "page-action-unavailable" });
    expect(click(s, "dl")).toMatchObject({ status: "applied" });
    expect(asks(s).map((a) => a.kind)).toEqual(["download"]);
    expect(asks(s)[0]!.args).toMatchObject({ filename: T("text"), text: "copy me", type: "text/plain" });
  }, 120_000);

  test("RED: the manifest the surface opened with gates the doors — CONTROL: a manifest naming print, fullscreen, open-surface and open-external asks each, and one lacking clipboard refuses it", async () => {
    s = await mountSurface(BUTTONS, WORLD);
    await open(s, ["print", "fullscreen", "open-surface", "open-external"]);
    for (const cls of ["print", "full", "win", "ext"]) expect(click(s, cls), cls).toMatchObject({ status: "applied" });
    expect(asks(s).map((a) => [a.kind, a.args])).toEqual([
      ["print", {}],
      ["fullscreen", { mode: "enter" }],
      ["open-surface", { title: T("text") }],
      ["open-external", { url: "https://example.org/" }],
    ]);
    expect(click(s, "copy")).toMatchObject({ status: "refused", reason: "page-action-unavailable" });
    await s.flush();
    expect(alert(s, "clipboard")).toBeDefined();
  }, 120_000);

  test("RED: service-result ok correlates by requestId and paints the clipboard's success notification — CONTROL: a refusal raises the kind's alert, an unknown id refuses unknown-request", async () => {
    s = await mountSurface(BUTTONS, WORLD);
    click(s, "copy");
    const first = asks(s)[0]!;
    expect(answer(s, first.requestId, "ok")).toMatchObject({ status: "applied" });
    await s.flush();
    expect(htmlOf(s.last())).toContain("Copied to clipboard!");
    expect(alert(s, "clipboard"), "an ok raises no alert").toBeUndefined();
    expect(answer(s, first.requestId, "ok"), "an answered request leaves the ledger").toMatchObject({ status: "refused", reason: "unknown-request" });
    click(s, "copy");
    const second = asks(s)[1]!;
    expect(answer(s, second.requestId, "page-action-unavailable")).toMatchObject({ status: "applied" });
    await s.flush();
    expect(alert(s, "clipboard")).toMatchObject({ tags: ["$:/tags/Alert"] });
    expect(htmlOf(s.last())).toContain("Failed to copy to clipboard!");
    expect(answer(s, "lar:service:never-minted", "ok")).toMatchObject({ status: "refused", reason: "unknown-request" });
  }, 120_000);

  test("RED: tm-http-request refuses by name under the Web3-only law — the alert names it, no ask crosses — CONTROL: the alert stands only after the click", async () => {
    s = await mountSurface(BUTTONS, WORLD);
    expect(alert(s, "http-request")).toBeUndefined();
    click(s, "http");
    await s.flush();
    expect(alert(s, "http-request")).toMatchObject({ tags: ["$:/tags/Alert"] });
    expect(String(alert(s, "http-request")!["text"])).toMatch(/tm-http-request/);
    expect(asks(s)).toEqual([]);
    expect(s.others, "nothing but frames and answers crossed").toEqual([]);
  }, 120_000);

  test("RED: rename, relink and home run as wiki logic on the island — CONTROL: the untouched tiddler stands", async () => {
    s = await mountSurface([
      send("ren", "tm-rename-tiddler", { from: T("a"), to: T("b") }),
      send("rel", "tm-relink-tiddler", { from: T("c"), to: T("d") }),
      `<$button class="home" message="tm-home">home</$button>`,
    ].join(""), [{ title: T("a"), text: "A" }, { title: T("c"), text: "C" }, { title: T("tagged"), text: "", tags: `[[${T("c")}]]` }, { title: T("keep"), text: "K" },
      { title: "$:/DefaultTiddlers", text: `[[${T("keep")}]]` }, { title: "$:/StoryList", list: [T("a")] }]);
    click(s, "ren"); click(s, "rel"); click(s, "home");
    await s.flush();
    expect(s.wiki.getTiddler(T("a"))).toBeUndefined();
    expect(s.wiki.getTiddler(T("b"))?.fields["text"]).toBe("A");
    expect(s.wiki.getTiddler(T("tagged"))?.fields["tags"]).toEqual([T("d")]);
    expect(s.wiki.getTiddler("$:/StoryList")?.fields["list"]).toEqual([T("keep")]);
    expect(s.wiki.getTiddler(T("keep"))?.fields["text"]).toBe("K");
  }, 120_000);

  test("RED: tm-modal and tm-show-switcher paint an aria-modal dialog in the frame's root layer; its close button closes it — CONTROL: the frame carries no modal before", async () => {
    s = await mountSurface(send("modal", "tm-modal", { $param: T("dialog"), who: "Ana" }),
      [{ title: T("dialog"), subtitle: "Ask", text: "Hello <<who>>" }]);
    expect(htmlOf(s.last())).not.toContain('aria-modal="true"');
    click(s, "modal");
    await s.flush();
    const html = htmlOf(s.last());
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Hello Ana");
    expect(html).toContain("Ask");
    expect(click(s, "lar-modal-close")).toMatchObject({ status: "applied" });
    await s.flush();
    expect(htmlOf(s.last())).not.toContain('aria-modal="true"');
  }, 120_000);

  test("RED: tm-scroll and tm-focus-selector ride as hints the frame carries, each under a rising hint number — CONTROL: no hint before the act", async () => {
    s = await mountSurface([
      send("scroll", "tm-scroll", { selector: ".target" }),
      send("focus", "tm-focus-selector", { $param: ".field" }),
      `<div class="target">t</div>`,
    ].join(""));
    expect(htmlOf(s.last())).not.toMatch(/data-lar-(scroll-to|focus)=/);
    click(s, "scroll");
    await s.flush();
    const scroll = /data-lar-scroll-to="([^"]*)"[^>]*data-lar-hint="(\d+)"|data-lar-hint="(\d+)"[^>]*data-lar-scroll-to="([^"]*)"/.exec(htmlOf(s.last()));
    expect(scroll, "the scroll hint rides the frame").not.toBeNull();
    expect(scroll![1] ?? scroll![4]).toBe(".target");
    click(s, "focus");
    await s.flush();
    const html = htmlOf(s.last());
    expect(html).toMatch(/data-lar-focus="\.field"/);
    const hints = [...html.matchAll(/data-lar-hint="(\d+)"/g)].map((m) => Number(m[1]));
    expect(new Set(hints).size, "each hint carries its own number").toBe(hints.length);
  }, 120_000);
});
