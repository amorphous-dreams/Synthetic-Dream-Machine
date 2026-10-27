import { expect, test } from "vitest";
import { makePortTransport } from "../src/port-transport.js";

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
