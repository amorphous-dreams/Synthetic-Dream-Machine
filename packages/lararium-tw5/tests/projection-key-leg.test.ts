/** The projected keyboard leg bubbles to TW5's wrapper-bound keyboard widget. */
import { describe, test, expect, vi } from "vitest";
import { patchFakeElementForEvents, dispatchProjectedEvent } from "../src/tw5-projection.js";

class FakeEl {
  attributes: Record<string, string | undefined> = {};
  setAttribute(name: string, value: string): void { this.attributes[name] = value; }
}
const fakeDoc = { createElement: (_tag: string): FakeEl => new FakeEl() };
patchFakeElementForEvents(fakeDoc as unknown as Parameters<typeof patchFakeElementForEvents>[0]);
type NodeWithEvents = FakeEl & { parentNode?: NodeWithEvents; addEventListener(type: string, handler: (ev: any) => void): void };
function node(): NodeWithEvents { return fakeDoc.createElement("div") as NodeWithEvents; }
/** A node the page can name: TW5 binds a click on a button, which stamps its render-id. */
function button(): NodeWithEvents { const el = node(); el.addEventListener("click", () => {}); return el; }

describe("the projected key leg", () => {
  test("keydown reaches a parent wrapper — control: click remains target-only", () => {
    const child = button(), parent = node();
    child.parentNode = parent;
    let keyEvent: any;
    parent.addEventListener("keydown", (ev) => { keyEvent = ev; });
    const clicks: unknown[] = [];
    parent.addEventListener("click", (ev) => clicks.push(ev));
    dispatchProjectedEvent(child.attributes["data-lar-rid"]!, "keydown", { keyCode: 13, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false });
    expect(keyEvent).toMatchObject({ keyCode: 13, target: child, currentTarget: parent, key: "", code: "" });
    dispatchProjectedEvent(child.attributes["data-lar-rid"]!, "click", { button: 0 });
    expect(clicks).toEqual([]);
  });

  test("stopPropagation halts the climb — control: without it both ancestors fire inner first", () => {
    const child = button(), inner = node(), outer = node();
    child.parentNode = inner; inner.parentNode = outer;
    const order: string[] = [];
    let stop = true;
    inner.addEventListener("keydown", (ev) => { order.push("inner"); if (stop) ev.stopPropagation(); });
    outer.addEventListener("keydown", () => order.push("outer"));
    dispatchProjectedEvent(child.attributes["data-lar-rid"]!, "keydown", { keyCode: 65 });
    expect(order).toEqual(["inner"]);
    stop = false;
    dispatchProjectedEvent(child.attributes["data-lar-rid"]!, "keydown", { keyCode: 65 });
    expect(order.slice(1)).toEqual(["inner", "outer"]);
  });
});
