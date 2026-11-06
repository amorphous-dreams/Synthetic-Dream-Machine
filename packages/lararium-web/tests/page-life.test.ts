import { expect, test, vi } from "vitest";
import { pageLifeOf, paintRest } from "../src/page-life.js";

test("the page's life feed: hidden and pagehide reach the vessel's listener; visible and an unsubscribed feed do not", () => {
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const listener = vi.fn();
  const stop = pageLifeOf(page, doc)(listener);
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(listener).not.toHaveBeenCalled();
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  page.dispatchEvent(new Event("pagehide"));
  expect(listener.mock.calls).toEqual([["hidden"], ["pagehide"]]);
  stop();
  page.dispatchEvent(new Event("pagehide"));
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(listener).toHaveBeenCalledTimes(2);
});

test("the vessel's rest reading paints onto the document root as data-lar-rest", () => {
  const doc = { documentElement: { dataset: {} as DOMStringMap } };
  paintRest(doc, { asked: 3, rested: 2, stalled: 1 });
  expect(doc.documentElement.dataset["larRest"]).toBe("3/2/1");
});
