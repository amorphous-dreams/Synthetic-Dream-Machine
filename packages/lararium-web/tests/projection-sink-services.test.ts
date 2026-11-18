/**
 * projection-sink-services.test — THE PAGE OPENS A HOST DOOR ONLY UNDER A PERSON'S ACT AND ITS OWN MANIFEST
 * (dreamdom#/host-services, page-controls#/refusals).
 *
 * An island asks `lar:service{requestId, kind, args, userActivation: true}`; the sink checks the activation
 * against the person's last act on the page (or the browser's own transient activation), checks the kind
 * against the `services` the surface opened with (default clipboard, download, route), runs the door, and
 * answers `lar:service-result` on the armed return leg, addressed to the document leg. A refused door paints
 * its words beside the control the person acted on. Each vector stands beside a control that reads the other way.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_CAMERA_STORY, LAR_FRAME, LAR_KEY_SURFACE, mkLarService,
  type LarMsg_ControlEvent, type LarServiceKind,
} from "../../lararium-mesh/src/lar-camera.js";
import { LAR_REFUSAL_WORDS, createProjectionSink, type LarSurfaceFrame, type LarSurfaceService, type ProjectionSinkOptions } from "../src/projection-sink.js";

function mount(opts: ProjectionSinkOptions = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const opened: Array<{ kind: string; args: unknown }> = [];
  const record = (kind: LarServiceKind) => (args: unknown): void => { opened.push({ kind, args }); };
  const sink = createProjectionSink(host, {
    doors: { clipboard: record("clipboard"), download: record("download"), route: record("route"), print: record("print") },
    ...opts,
  });
  const sent: Array<{ surface: string; ev: LarMsg_ControlEvent }> = [];
  sink.arm({ sendControlEvent: (surface, ev) => { if (!sent.some((prior) => prior.ev.eventId === ev.eventId)) sent.push({ surface, ev }); } });
  const root = host.shadowRoot!;
  const frame: LarSurfaceFrame = {
    type: LAR_FRAME, wikiUri: "lar:///wiki/w", cameraId: LAR_CAMERA_STORY, mountEpoch: 7, surface: "w", sensedRevision: {},
    keys: [{ key: LAR_KEY_SURFACE, rev: 1, html: `<button class="go" data-lar-rid="r1" data-lar-on="click" data-lar-cancel="click" data-lar-bubble="no">go</button>` }],
  };
  expect(sink.apply(frame)).toBe("painted");
  const click = (): void => root.querySelector<HTMLButtonElement>("button.go")!.click();
  const ask = (kind: LarServiceKind, args: Record<string, string> = {}, requestId = `q-${kind}`): LarSurfaceService =>
    ({ ...mkLarService({ wikiUri: "lar:///wiki/w", requestId, kind, args }), surface: "w" });
  const answers = () => sent.filter((s) => s.ev.kind === "lar:service-result").map((s) => [s.ev.requestId, s.ev.status]);
  const words = () => [...root.querySelectorAll<HTMLOutputElement>('output[role="status"]')].map((o) => [o.dataset["larFor"], o.textContent]);
  return { sink, sent, opened, click, ask, answers, words, done: () => host.remove() };
}

describe("★ a host door opens under a person's act and the surface's manifest ★", () => {
  test("RED: an ask with no act before it refuses activation-required and opens nothing — CONTROL: the same ask after a click opens the door and answers ok", async () => {
    const m = mount();
    expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }, "q1"))).toBe("refused");
    expect(m.opened).toEqual([]);
    expect(m.answers()).toEqual([["q1", "activation-required"]]);
    m.click();
    expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }, "q2"))).toBe("opened");
    expect(m.opened).toEqual([{ kind: "clipboard", args: { text: "x" } }]);
    expect(m.answers()).toEqual([["q1", "activation-required"], ["q2", "ok"]]);
    const answer = m.sent.at(-1)!;
    expect(answer).toMatchObject({ surface: "w", ev: { kind: "lar:service-result", controlId: "lar:document", mountEpoch: 7, action: "lar:service-result" } });
    m.done();
  });

  test("RED: one act opens one door — CONTROL: a second ask on the same act refuses activation-required", async () => {
    const m = mount();
    m.click();
    expect(await m.sink.applyService(m.ask("download", { filename: "f", text: "t" }, "q1"))).toBe("opened");
    expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }, "q2"))).toBe("refused");
    expect(m.answers()).toEqual([["q1", "ok"], ["q2", "activation-required"]]);
    m.done();
  });

  test("RED: a kind outside the default manifest refuses page-action-unavailable beside the acted control, even with a door at hand — CONTROL: clipboard, download and route open", async () => {
    const m = mount();
    m.click();
    expect(await m.sink.applyService(m.ask("print", {}, "q1"))).toBe("refused");
    expect(m.opened, "the manifest gates before any door runs").toEqual([]);
    expect(m.answers()).toEqual([["q1", "page-action-unavailable"]]);
    expect(m.words()).toEqual([["r1", LAR_REFUSAL_WORDS["page-action-unavailable"]]]);
    expect(m.sink.manifest()).toEqual({ services: ["clipboard", "download", "route"] });
    for (const kind of ["clipboard", "download", "route"] as const) {
      m.click();
      expect(await m.sink.applyService(m.ask(kind, {}, `ok-${kind}`)), kind).toBe("opened");
    }
    m.done();
  });

  test("RED: a manifest the surface opened with names its doors — CONTROL: print listed opens, clipboard unlisted refuses", async () => {
    const m = mount({ services: ["print"] });
    expect(m.sink.manifest()).toEqual({ services: ["print"] });
    m.click();
    expect(await m.sink.applyService(m.ask("print"))).toBe("opened");
    m.click();
    expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }))).toBe("refused");
    expect(m.answers()).toEqual([["q-print", "ok"], ["q-clipboard", "page-action-unavailable"]]);
    m.done();
  });

  test("RED: a listed kind with no door at hand refuses page-action-unavailable — CONTROL: a door that throws refuses the same way, and a malformed ask answers nothing", async () => {
    const m = mount({ services: ["open-surface", "clipboard"], doors: { clipboard: () => { throw new Error("denied"); } } });
    m.click();
    expect(await m.sink.applyService(m.ask("open-surface", { title: "t" }))).toBe("refused");
    m.click();
    expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }))).toBe("refused");
    expect(m.answers()).toEqual([["q-open-surface", "page-action-unavailable"], ["q-clipboard", "page-action-unavailable"]]);
    expect(await m.sink.applyService({ ...m.ask("clipboard"), userActivation: false } as unknown as LarSurfaceService)).toBe("malformed");
    expect(m.answers()).toHaveLength(2);
    m.done();
  });

  test("RED: the default clipboard door writes through navigator.clipboard — CONTROL: its failure refuses", async () => {
    const m = mount({ doors: {} });
    const written: string[] = [];
    const clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { written.push(t); } } });
    try {
      m.click();
      expect(await m.sink.applyService(m.ask("clipboard", { text: "copy me" }, "q1"))).toBe("opened");
      expect(written).toEqual(["copy me"]);
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } });
      m.click();
      expect(await m.sink.applyService(m.ask("clipboard", { text: "x" }, "q2"))).toBe("refused");
    } finally {
      delete (navigator as unknown as Record<string, unknown>)["clipboard"];
      if (clipboard) Object.defineProperty(Navigator.prototype, "clipboard", clipboard);
    }
    m.done();
  });
});
