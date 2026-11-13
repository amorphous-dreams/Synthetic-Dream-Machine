/**
 * projection-sink-unload-hold.test — THE PAGE HOLDS ITS UNLOAD while a relayed act still waits for its result
 * (dreamdom#/what-a-sink-keeps, "the edit that unloads before it rests").
 *
 * A confirmed edit answers `applied` only once its document rests; a page that leaves before the answer arrives
 * would lose the edit. The sink asks the browser to hold the leave while an act is pending and lets it go the moment
 * the last answer lands. Real Chromium; the leave is a `beforeunload` event read for its `defaultPrevented`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, mkLarControlResult, type LarMsg_ControlEvent } from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type ProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

const teardowns: Array<() => void> = [];
afterEach(() => { for (const t of teardowns.splice(0)) t(); });

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink: ProjectionSink = createProjectionSink(host);
  const sent: LarMsg_ControlEvent[] = [];
  sink.arm({ sendControlEvent: (_surface, ev) => { if (!sent.some((prior) => prior.eventId === ev.eventId)) sent.push(ev); } });
  const frame: LarSurfaceFrame = {
    type: LAR_FRAME, wikiUri: "lar:///wiki/lares", cameraId: LAR_CAMERA_STORY, mountEpoch: 1,
    keys: [{ key: LAR_KEY_SURFACE, rev: 1, html: `<button class="go" data-lar-rid="5" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">go</button>` }],
    sensedRevision: {}, surface: "lares",
  };
  expect(sink.apply(frame)).toBe("painted");
  teardowns.push(() => { sink.dispose(); host.remove(); });
  const click = (): void => { host.shadowRoot!.querySelector<HTMLElement>(".go")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, button: 0 })); };
  /** Whether the page asks the browser to hold a leave right now. */
  const holds = (): boolean => {
    const leave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(leave);
    return leave.defaultPrevented;
  };
  return { sink, sent, click, holds };
}

describe("★ the page holds its unload while an act waits for its result ★", () => {
  test("RED: a relayed act holds the leave until its result lands; CONTROL: a page with no act pending holds nothing", () => {
    const m = mount();
    expect(m.holds()).toBe(false);                                   // CONTROL: nothing pending, nothing held
    m.click();
    expect(m.sink.pendingActs()).toBe(1);
    expect(m.holds()).toBe(true);                                    // an act waits for its result
    const ev = m.sent[0]!;
    m.sink.applyResult(mkLarControlResult({ eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch, renderId: "5", status: "applied" }));
    expect(m.sink.pendingActs()).toBe(0);
    expect(m.holds()).toBe(false);                                   // the answer lands: the leave goes free
  });

  test("a disposed sink holds nothing", () => {
    const m = mount();
    m.click();
    m.sink.dispose();
    expect(m.holds()).toBe(false);
  });
});
