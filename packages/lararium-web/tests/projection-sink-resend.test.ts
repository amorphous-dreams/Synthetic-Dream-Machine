import { afterEach, describe, expect, test, vi } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, mkLarControlResult, mkLarService, type LarMsg_ControlEvent,
} from "../../lararium-mesh/src/lar-camera.js";
import { createProjectionSink, type LarSurfaceFrame } from "../src/projection-sink.js";

const html = '<input data-lar-rid="a" value=""><input data-lar-rid="b" value="">';
const frame = (rev: number, epoch = 1): LarSurfaceFrame => ({
  type: LAR_FRAME, wikiUri: "lar:///wiki/test", cameraId: LAR_CAMERA_STORY, mountEpoch: epoch,
  surface: "test", keys: [{ key: LAR_KEY_SURFACE, rev, html }], sensedRevision: {},
});

function mount() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const sink = createProjectionSink(host, { doors: { clipboard: () => undefined } });
  const sent: LarMsg_ControlEvent[] = [];
  const sendControlEvent = vi.fn((_surface: string, ev: LarMsg_ControlEvent) => { sent.push(ev); });
  sink.arm({ sendControlEvent });
  sink.apply(frame(1));
  const act = (id = "a") => {
    const field = host.shadowRoot!.querySelector<HTMLInputElement>(`[data-lar-rid="${id}"]`)!;
    field.value = id;
    field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return sent.at(-1)!;
  };
  const answer = (ev: LarMsg_ControlEvent) => sink.applyResult(mkLarControlResult({
    eventId: ev.eventId, cameraId: ev.cameraId, mountEpoch: ev.mountEpoch, renderId: ev.renderId!, status: "applied",
  }));
  const reason = () => host.shadowRoot!.querySelector<HTMLOutputElement>("output[data-lar-reason]")?.dataset["larReason"];
  return { host, sink, sent, sendControlEvent, act, answer, reason,
    done: () => { sink.dispose(); host.remove(); } };
}

const mounts: Array<ReturnType<typeof mount>> = [];
const setup = () => { const m = mount(); mounts.push(m); return m; };
afterEach(() => { for (const m of mounts.splice(0)) m.done(); vi.restoreAllMocks(); });

describe("same-id page resend", () => {
  test("a-dropped-answer-resends-the-same-id-at-the-next-frame; CONTROL: an answered act stays quiet", () => {
    const m = setup();
    const first = m.act();
    expect(m.sink.pendingActs()).toBe(1);
    m.sink.apply(frame(2));
    expect(m.sent).toHaveLength(2);
    expect(m.sent[1]).toBe(first);
    expect(m.answer(first)).toBe("cleared");
    expect(m.sink.pendingActs()).toBe(0);
    m.sink.apply(frame(3));
    expect(m.sent).toHaveLength(2);

    const control = setup();
    const answered = control.act();
    expect(control.answer(answered)).toBe("cleared");
    control.sink.apply(frame(2));
    expect(control.sent).toEqual([answered]);
  });

  test("a-resend-is-bounded-by-attempts; CONTROL: an answer before exhaustion clears without refusal", () => {
    const m = setup();
    m.act();
    m.sink.apply(frame(2));
    m.sink.apply(frame(3));
    expect(m.sent).toHaveLength(3);
    expect(m.sink.pendingActs()).toBe(1);
    m.sink.apply(frame(4));
    expect(m.sent).toHaveLength(3);
    expect(m.reason()).toBe("binding-unavailable");
    expect(m.sink.pendingActs()).toBe(0);
    m.sink.apply(frame(5));
    expect(m.sent).toHaveLength(3);

    const control = setup();
    const ev = control.act();
    control.sink.apply(frame(2));
    control.answer(ev);
    control.sink.apply(frame(3));
    expect(control.sent).toHaveLength(2);
    expect(control.reason()).toBeUndefined();
  });

  test("an-epoch-change-ends-the-loop; CONTROL: a same-epoch frame resends", () => {
    const m = setup();
    m.act();
    m.sink.apply(frame(1, 2));
    expect(m.sent).toHaveLength(1);
    expect(m.reason()).toBe("stale-target");
    expect(m.sink.pendingActs()).toBe(0);
    const control = setup();
    control.act();
    control.sink.apply(frame(2));
    expect(control.sent).toHaveLength(2);
  });

  test("the-next-act-resends-first-in-order; CONTROL: an answered A sends only B", () => {
    const m = setup();
    const a = m.act("a");
    const b = m.act("b");
    expect(m.sent).toEqual([a, a, b]);
    expect(b.eventId).not.toBe(a.eventId);
    const control = setup();
    const done = control.act("a");
    control.answer(done);
    const next = control.act("b");
    expect(control.sent).toEqual([done, next]);
  });

  test("a sense neither enters pending nor triggers a resend; CONTROL: the next act does", () => {
    const m = setup();
    const a = m.act("a");
    const field = m.host.shadowRoot!.querySelector<HTMLInputElement>('[data-lar-rid="b"]')!;
    field.value = "typed";
    field.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    expect(m.sent).toHaveLength(2);
    expect(m.sent[1]?.kind).toBe("lar:sense");
    expect(m.sink.pendingActs()).toBe(1);
    const b = m.act("b");
    expect(m.sent.slice(2)).toEqual([a, b]);
  });

  test("rearming resends the same id; CONTROL: an answered act does not resend", () => {
    const m = setup();
    const a = m.act();
    m.sink.arm({ sendControlEvent: m.sendControlEvent });
    expect(m.sent).toEqual([a, a]);
    m.answer(a);
    m.sink.arm({ sendControlEvent: m.sendControlEvent });
    expect(m.sent).toEqual([a, a]);
  });

  test("a document service result resends under the same law; CONTROL: its answer clears pending", async () => {
    const m = setup();
    m.act();
    const ask = { ...mkLarService({ wikiUri: "lar:///wiki/test", requestId: "q1", kind: "clipboard", args: { text: "x" } }), surface: "test" };
    expect(await m.sink.applyService(ask)).toBe("opened");
    const result = m.sent.find((ev) => ev.kind === "lar:service-result")!;
    expect(result.controlId).toBe("lar:document");
    m.sink.apply(frame(2));
    expect(m.sent.filter((ev) => ev === result)).toHaveLength(2);
    expect(m.sink.applyResult(mkLarControlResult({
      eventId: result.eventId, cameraId: result.cameraId, mountEpoch: result.mountEpoch,
      controlId: "lar:document", status: "applied",
    }))).toBe("cleared");
    m.sink.apply(frame(3));
    expect(m.sent.filter((ev) => ev === result)).toHaveLength(2);
  });

  test("resend boundaries read no clock; CONTROL: the initial event still carries a valid epoch", () => {
    const m = setup();
    const a = m.act("a");
    expect(a.mountEpoch).toBe(1);
    // The next person's act reads the separate host-door activation window once.
    const now = vi.spyOn(performance, "now").mockReturnValue(1);
    const date = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("clock read"); });
    const timer = vi.spyOn(globalThis, "setTimeout").mockImplementation(() => { throw new Error("clock read"); });
    try {
      m.sink.apply(frame(2));
      expect(now).not.toHaveBeenCalled();
      m.act("b");
      expect(now).toHaveBeenCalledTimes(1);
      m.sink.apply(frame(1, 2));
      expect(now).toHaveBeenCalledTimes(1);
      expect(m.sent[1]).toBe(a);
      expect(m.sink.pendingActs()).toBe(0);
    } finally { now.mockRestore(); date.mockRestore(); timer.mockRestore(); }
  });
});
