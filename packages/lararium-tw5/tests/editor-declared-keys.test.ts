/**
 * The editor's own declared keys: the chords its toolbar buttons name in `data-tw-keyboard-shortcut`, the ones TW5's
 * editor intercepts before a keydown propagates (`editor/factory.js` handleKeydownEvent). An editor with no toolbar,
 * as TW5 renders it over the fake document, declares none.
 */
import { describe, expect, test } from "vitest";
import { editorDeclaredKeys, type ToolbarNode } from "../src/tw5-projection.js";

const parse = (descriptor: string) => descriptor.split(" ").filter(Boolean).map((d) => {
  const parts = d.split("-"); const key = parts.pop()!;
  return { keyCode: key.toUpperCase().charCodeAt(0), ctrlKey: parts.includes("ctrl"), altKey: parts.includes("alt"), shiftKey: parts.includes("shift"), metaKey: parts.includes("meta") };
});

describe("the editor declares the chords its toolbar names", () => {
  test("each toolbar shortcut descriptor becomes one crossing chord, deduplicated", () => {
    const toolbar: ToolbarNode = { attributes: {}, children: [
      { attributes: { "data-tw-keyboard-shortcut": "ctrl-b" } },
      { attributes: {}, children: [{ attributes: { "data-tw-keyboard-shortcut": "ctrl-i ctrl-b" } }] },
      { attributes: { "data-tw-keyboard-shortcut": "" } },
    ] };
    expect(editorDeclaredKeys(toolbar, parse).split(" ").sort()).toEqual(["ctrl-B", "ctrl-I"].sort());
  });

  test("CONTROL: an editor with no toolbar declares no keys", () => {
    expect(editorDeclaredKeys(undefined, parse)).toBe("");
    expect(editorDeclaredKeys({ attributes: {}, children: [] }, parse)).toBe("");
  });
});
