import { describe, expect, it, vi } from "vitest";
import { RecordingDocument } from "../src/recording-document.js";

describe("recording document", () => {
  it("records stable ids across parent and child mutations", () => {
    const doc = new RecordingDocument();
    const first = doc.createElement("div"); const second = doc.createElement("div");
    const child = doc.createTextNode("hello"); const id = child.nodeId;
    first.appendChild(child);
    second.appendChild(child);
    expect(first.childNodes).toEqual([]);
    expect(second.childNodes).toEqual([child]);
    expect(child.nodeId).toBe(id);
    expect(child.parentNode).toBe(second);
    second.removeChild(child);
    expect(child.parentNode).toBeNull();
  });
  it("records attributes, text and capture/bubble listeners", () => {
    const doc = new RecordingDocument(); const node = doc.createElement("a");
    const callback = vi.fn();
    node.setAttribute("href", "Title"); node.className = "link";
    node.appendChild(doc.createTextNode("label"));
    node.addEventListener("click", callback, true);
    node.addEventListener("click", callback, false);
    expect(node.getAttribute("href")).toBe("Title");
    expect(node.textContent).toBe("label");
    expect(node.listeners.map(listener => listener.capture)).toEqual([true, false]);
    node.removeEventListener("click", callback, true);
    expect(node.listeners.map(listener => listener.capture)).toEqual([false]);
  });
  it("carries a select's chosen options and a toggle's state through a recorded change", () => {
    const doc = new RecordingDocument();
    const select = doc.createElement("select");
    const a = doc.createElement("option"); a.value = "a";
    const b = doc.createElement("option"); b.value = "b";
    select.appendChild(a); select.appendChild(b);
    select.value = "b";
    expect(select.value).toBe("b");
    expect(select.options.map(option => option.selected)).toEqual([false, true]);
    const input = doc.createElement("input");
    input.setAttribute("checked", "true");
    input.checked = false;
    expect(input.checked).toBe(false);
  });
  it("lends a click its measured rectangle to the TW5 listener", () => {
    const node = new RecordingDocument().createElement("button");
    node.offsetTop = 40; node.offsetLeft = 10; node.offsetWidth = 50; node.offsetHeight = 20;
    expect(node.getBoundingClientRect()).toEqual({ top: 40, left: 10, right: 60, bottom: 60, width: 50, height: 20 });
  });
});
