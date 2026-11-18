/**
 * executable-class — the one list that names what a TiddlyWiki record runs (state/decisions "Five floors walked" (2); backlog-awakens
 * "The executable-record lei").
 *
 * The list stands once, in the mesh, and both its readers share it: the seat wall (#260's `seat-startup-offer`) and the
 * executable-record lei's scope. It FAILS CLOSED: a `$:/tags/*` tag the list does not name as inert reads as executable, so a tag
 * TW5 grows tomorrow (or a plugin's own) never slips through as data. Every red pairs with a CONTROL.
 */
import { describe, expect, test } from "vitest";
import { EXECUTABLE_CLASSES, INERT_SYSTEM_TAGS, executableClassOf, isExecutableRecord } from "../src/executable-class.js";

describe("executable-class — one list, failing closed", () => {
  test("RED: each named class reads executable by its own class; an unlisted system tag reads executable too (fail closed)", () => {
    const planted: [Record<string, unknown>, string][] = [
      [{ "module-type": "startup" }, "module"],
      [{ "plugin-type": "plugin" }, "plugin"],
      [{ type: "application/javascript" }, "script"],
      [{ type: "text/javascript" }, "script"],
      [{ tags: "$:/tags/StartupAction" }, "startup-action"],
      [{ tags: ["$:/tags/StartupAction/Browser"] }, "startup-action"],
      [{ tags: "[[$:/tags/StartupAction/PostRender]]" }, "startup-action"],
      [{ tags: "$:/tags/Macro" }, "macro"],
      [{ tags: "$:/tags/Macro/View/Body" }, "macro"],
      [{ tags: "$:/tags/ViewTemplate" }, "view-template"],
      [{ tags: "$:/tags/Global" }, "global"],
      [{ tags: "$:/tags/Global/View" }, "global"],
      [{ tags: "$:/tags/RawMarkup" }, "raw-markup"],
      [{ tags: "$:/tags/KeyboardShortcut" }, "keyboard-shortcut"],
      [{ tags: "$:/tags/BackgroundAction" }, "background-action"],
      [{ tags: "$:/tags/PageTemplate" }, "page-template"],
      [{ tags: "memory $:/tags/NeverHeardOfIt" }, "system-tag"],
      [{ tags: "[[$:/tags/lares/Landing]]" }, "system-tag"],
    ];
    for (const [fields, cls] of planted) {
      expect(executableClassOf(fields)?.class, JSON.stringify(fields)).toBe(cls);
      expect(isExecutableRecord(fields), JSON.stringify(fields)).toBe(true);
    }
    // Every class the planted set names stands in the one list.
    for (const [, cls] of planted) expect(EXECUTABLE_CLASSES.map((c) => c.class)).toContain(cls);
  });

  test("CONTROL: plain records, user tags, plain `$:/config` `$:/state` `$:/temp` records and the named inert system tags read as data", () => {
    const inert: Record<string, unknown>[] = [
      {}, { text: "plain" }, { tags: "memory [[two words]]" }, { title: "$:/config/x", text: "y" }, { title: "$:/state/x" }, { title: "$:/temp/x" },
      { type: "text/vnd.tiddlywiki" }, { type: "application/json" }, { tags: "$:/tagsX" }, { tags: "tags/StartupAction" },
      ...INERT_SYSTEM_TAGS.map((tag) => ({ tags: [tag] })),
    ];
    for (const fields of inert) {
      expect(executableClassOf(fields), JSON.stringify(fields)).toBeNull();
      expect(isExecutableRecord(fields)).toBe(false);
    }
    expect(INERT_SYSTEM_TAGS).toContain("$:/tags/Palette");
    expect(INERT_SYSTEM_TAGS).not.toContain("$:/tags/ViewTemplate");
  });
});
