import { expect, test } from "vitest";
import { makePortDelivery, makePortTransport } from "../src/port-transport.js";

test("a refused placement reaches the caller and the listeners", () => {
  const placed: unknown[] = [];
  const transport = makePortTransport({
    doors: { place: (_surface, _binding, msg) => { placed.push(msg); return { ok: false, reason: "port-not-granted" }; }, close() {} },
    surface: () => "wiki", mint: () => "page-a",
  });
  const events: unknown[] = [];
  transport.onMessage((msg) => events.push(msg));
  expect(transport.open({ type: "port:open" })).toEqual({ ok: false, reason: "port-not-granted" });
  expect(events).toEqual([{ type: "transport:refused", reason: "port-not-granted" }]);
  expect(placed).toHaveLength(1);
});

test("a delivered reply reaches listeners once and another binding stays outside", () => {
  const transport = makePortTransport({ doors: { place: () => ({ ok: true }), close() {} }, surface: () => "wiki", mint: () => "page-a" });
  const events: unknown[] = [];
  transport.onMessage((msg) => events.push(msg));
  transport.deliver({ type: "port:snapshot", binding: "page-b" });
  transport.deliver({ type: "port:snapshot", binding: "page-a" });
  expect(events).toEqual([{ type: "port:snapshot", binding: "page-a" }]);
  expect(transport.send({ type: "port:ack" })).toEqual({ ok: true }); // control
});

test("close releases its binding once", () => {
  const closes: string[] = [];
  const transport = makePortTransport({ doors: { place: () => ({ ok: true }), close: (binding) => closes.push(binding) }, surface: () => "wiki", mint: () => "page-a" });
  transport.close(); transport.close();
  expect(closes).toEqual(["page-a"]);
  expect(transport.send({ type: "port:ack" })).toEqual({ ok: false, reason: "transport-closed" });
});

const deliveryDoors = { place: () => ({ ok: true as const }), close: () => {} };
test("a reply for the transport's own binding reaches its listeners once; CONTROL: another binding's reply and a reply before attach reach nobody", () => {
    const delivery = makePortDelivery();
    const heard: unknown[] = [];
    delivery.onPortMessage("early", "wiki", { type: "port:changes", portId: "p" });
    const transport = makePortTransport({ doors: deliveryDoors, surface: () => "wiki", mint: () => "page-binding" });
    transport.onMessage((m) => heard.push(m));
    delivery.attach(transport);
    delivery.onPortMessage("page-binding", "wiki", { type: "port:snapshot", portId: "p" });
    delivery.onPortMessage("someone-else", "wiki", { type: "port:changes", portId: "p" });
    expect(heard).toEqual([{ type: "port:snapshot", portId: "p" }]);
});

test("standPagePort stands one transport over the doors and the module's delivery reaches it for its own binding", async () => {
  const module = await import("../src/page-port.js");
  const { pagePortDelivery, standPagePort } = module;
  // The ambient getter burned: the root hands the binding it holds to the mirror explicitly.
  expect("pagePort" in module).toBe(false);
  const placed: unknown[] = [];
  const transport = standPagePort({ place: (_s, b, m) => { placed.push([b, m]); return { ok: true }; }, close() {} }, () => "wiki");
  const heard: unknown[] = [];
  transport.onMessage((m) => heard.push(m));
  pagePortDelivery.onPortMessage(transport.binding, "wiki", { type: "port:reset", portId: "p" });
  pagePortDelivery.onPortMessage("other", "wiki", { type: "port:reset", portId: "q" });
  expect(heard).toEqual([{ type: "port:reset", portId: "p" }]);
  expect(transport.send({ type: "port:close", portId: "p" })).toEqual({ ok: true });
  expect(placed).toEqual([[transport.binding, { type: "port:close", portId: "p" }]]);
});
