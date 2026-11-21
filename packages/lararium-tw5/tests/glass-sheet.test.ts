/** glass-sheet — a whole-document theme sheet read inside the mirror's shadow root (`src/glass-sheet.ts`). */
import { expect, test } from "vitest";
import { GLASS_FRAME_SHEET, shadowSheet } from "../src/glass-sheet.js";

test("html reads as the host and body as the mirror's container, at the head of each selector alone", () => {
  const out = shadowSheet(`html, body {\n\tfont-family: x;\n}\nbody.tc-body {\n\tbackground: #1d2021;\n}\nhtml body.tc-body .tc-btn-boxed svg { fill: red; }\nhtml button { color: blue; }\nhtml[dir="rtl"] .tc-sidebar-scrollable { left: auto; }\n.tc-tiddler-body > iframe { border: 0; }\n.tc-modal-body { color: red; }`);
  expect(out).toContain(":host, .lar-mirror {");
  expect(out).toContain(".lar-mirror.tc-body {");
  expect(out).toContain(".lar-mirror.tc-body .tc-btn-boxed svg {");
  expect(out).toContain(":host button {");
  expect(out).toContain(':host([dir="rtl"]) .tc-sidebar-scrollable {');
  // CONTROL: a class that merely carries the letters `body` keeps its name.
  expect(out).toContain(".tc-tiddler-body > iframe {");
  expect(out).toContain(".tc-modal-body {");
});

test("a width-only media query reads the host's width as a container query; CONTROL: print and other media keep their own", () => {
  const out = shadowSheet(`@media (min-width: 960px) {\n\t.tc-sidebar-scrollable { position: fixed; }\n}\n@media (max-width: 959px) and (min-width: 30em) { .a { b: c; } }\n@media print {\n\tbody.tc-body { background-color: transparent; }\n}\n@media (prefers-color-scheme: dark) { .x { y: z; } }`);
  expect(out).toContain("@container (min-width: 960px) {");
  expect(out).toContain("@container (max-width: 959px) and (min-width: 30em) {");
  expect(out).toContain("@media print {");
  expect(out).toContain(".lar-mirror.tc-body { background-color: transparent; }");
  expect(out).toContain("@media (prefers-color-scheme: dark) {");
  expect(out).not.toContain("@media (min-width");
});

test("the frame closes the sheet, so the host's containment holds the last word over any theme's html rule", () => {
  const out = shadowSheet("html { height: auto; }");
  expect(out.endsWith(GLASS_FRAME_SHEET)).toBe(true);
  expect(GLASS_FRAME_SHEET).toMatch(/:host \{[^}]*container-type: inline-size[^}]*contain: layout paint/);
});
