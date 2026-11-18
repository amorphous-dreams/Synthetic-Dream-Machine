import { expect, test } from "vitest";
import { paintPaneLabel } from "../src/pane-label.js";

test("the projection pane names the shown surface in the vessel card's word; CONTROL: a summon repaints it, and no surface names nothing", () => {
  const heading = document.createElement("h2");
  const label = document.createElement("span");
  const summon = document.createElement("button");
  summon.textContent = "☰ @daemon";
  heading.append("projection — ", label, summon);
  paintPaneLabel(label, "lares");
  expect(label.textContent).toBe("lares");
  expect(label.getAttribute("data-lar-pane-wiki")).toBe("lares");
  paintPaneLabel(label, "daemon");
  expect(label.getAttribute("data-lar-pane-wiki")).toBe("daemon");
  // The summon button stays the summon button: the label never writes into it.
  expect(summon.textContent).toBe("☰ @daemon");
  paintPaneLabel(label, null);
  expect(label.textContent).toBe("…");
  expect(label.getAttribute("data-lar-pane-wiki")).toBe("");
});
