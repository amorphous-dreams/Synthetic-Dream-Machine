/**
 * Web surface DOM witness. The browser package emits only the frame; this
 * test keeps the real DOM sink's stale-frame and epoch controls on the web
 * shore.
 */

import { describe, test, expect } from "vitest";
import { mountCoherenceIndicator } from "../src/wiki-coherence-sink.js";
import type { CoherenceFrameWithRev } from "@lararium/browser";

function frame(over: Partial<CoherenceFrameWithRev>): CoherenceFrameWithRev {
  return {
    status: "coherent", radius: 0, glues: true, vacuous: false,
    obstructing: [], lociTotal: 0, label: "the wiki coheres", rev: 1, ...over,
  };
}

describe("mountCoherenceIndicator — the web DOM coherence sink", () => {
  test("a coherent frame reads on the host", () => {
    const host = document.createElement("div");
    mountCoherenceIndicator(host).apply(frame({ label: "the wiki coheres" }));
    expect(host.getAttribute("data-coherence")).toBe("coherent");
    expect(host.getAttribute("data-radius")).toBe("0");
    expect(host.textContent).toBe("the wiki coheres");
    expect(host.hasAttribute("title")).toBe(false);
  });

  test("an obstruction names its tiddler", () => {
    const host = document.createElement("div");
    mountCoherenceIndicator(host).apply(frame({
      status: "obstructed", radius: 1, glues: false,
      obstructing: ["ornate-novel"], label: "the planes fracture (radius 1) at: ornate-novel",
    }));
    expect(host.getAttribute("data-coherence")).toBe("obstructed");
    expect(host.getAttribute("title")).toBe("ornate-novel");
    expect(host.textContent).toContain("ornate-novel");
  });

  test("stale frames drop and a new epoch re-arms", () => {
    const host = document.createElement("div");
    const sink = mountCoherenceIndicator(host);
    sink.apply(frame({ status: "obstructed", label: "newer", rev: 5 }));
    sink.apply(frame({ label: "older", rev: 3 }));
    expect(host.textContent).toBe("newer");
    sink.apply(frame({ label: "new epoch", rev: 1 }));
    sink.apply(frame({ label: "epoch newer", rev: 3 }));
    sink.apply(frame({ label: "epoch stale", rev: 2 }));
    expect(host.textContent).toBe("epoch newer");
  });
});
