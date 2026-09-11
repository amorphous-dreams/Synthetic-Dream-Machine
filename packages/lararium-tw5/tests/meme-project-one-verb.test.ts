/**
 * ONE MEANING, ONE VERB — the submission pair (markdown body + `.md.meta` sidecar) projects through
 * `meme-project { uri, to: "md" }` and the in-VM face `$tw.lares.meme.project(uri, "md")` alone.
 *
 * The island's action table registers no second query verb for it, the node wires no second wire
 * verb, and the daemon surface's button fires the projection IN the wiki VM it stands in — the
 * `meme-project` filter the face's `md` template renders through — with no verb hop out to the host.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import { registerActionReactors } from "../src/action-handler.js";
import { VerbTable } from "../src/verb-dispatcher.js";
import { DAEMON_UI_TIDDLERS, PROJECT_ACTION, PROJECT_STATE_TITLE } from "../src/daemon-ui-tiddlers.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

const URI = "lar:///t/one-verb";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/one-verb"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe("★ the submission projection carries ONE verb ★", () => {
  test("the island's action table registers no PROJECT-MD; the residency verbs and REPACK stand (CONTROL)", () => {
    const table = new VerbTable();
    registerActionReactors(table, { composite: new CompositeStore() });
    expect(table.has("PROJECT-MD")).toBe(false);
    expect(table.has("REPACK")).toBe(true);
    expect(table.has("MOVE")).toBe(true);
  });

  test("the daemon surface's button fires the in-VM projection, never a verb hop", () => {
    const bodies = DAEMON_UI_TIDDLERS.map((t) => t["text"] ?? "").join("\n");
    expect(bodies).not.toMatch(/PROJECT-MD|verb="project-md"/);
    expect(PROJECT_ACTION).toContain("meme-project[md]");
    expect(PROJECT_ACTION).toContain("meme-project[md.meta]");
    expect(bodies).toContain(PROJECT_ACTION);
  });
});

describe.skipIf(wikiSkip)(`the button's action lands the same pair the face projects${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  beforeAll(async () => {
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  });

  test("★ the action writes the pair onto the projection state tiddler ★", async () => {
    await face.place(URI, meme(["a", "b"]));
    engine.wiki.addTiddler({ title: PROJECT_STATE_TITLE, uri: URI });
    const root = (engine.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget;
    root.invokeActionString(PROJECT_ACTION);
    const state = engine.wiki.getTiddler(PROJECT_STATE_TITLE)!.fields as Record<string, string>;
    const out = face.project(URI, "md");
    expect(state["markdown"]).toBe(out.text);
    expect(state["meta"]).toBe(out.meta);
    expect(state["markdown"]).toContain("# a");
  });
});
