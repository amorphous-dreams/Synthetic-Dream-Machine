import type { IslandToVesselMsg } from "@lararium/mesh";

export type HolderRoute = "reply" | "camera" | "owner" | "port";

/** Every island kind declares the one binding that may receive it. */
export const HOLDER_ROUTES = {
  "wiki:verb-result": "reply",
  "daemon:worldline-compare-result": "reply",
  "daemon:worldline-trajectory-result": "reply",
  "daemon:resolve-binding-result": "reply",
  "daemon:gate-verb-result": "reply",

  // The record port streams records to the tab whose session holds its lease.
  // A reply without a lease drops by name (`no-port-lease`).
  "port:snapshot": "port",
  "port:changes": "port",
  "port:reset": "port",
  "port:written": "port",
  "port:answer": "port",
  "port:presence": "port",

  "lar:frame": "camera",
  "lar:control-result": "camera",
  "lar:service": "camera",

  "ready": "owner",
  "gate:clear": "owner",
  "gate:refused": "owner",
  "teardown:ack": "owner",
  "ea": "owner",
  "breath": "owner",
  "fault": "owner",
  "event": "owner",
  "daemon:delegate-verb": "owner",
  "daemon:evict-request": "owner",
  "daemon:face-settled": "owner",
  "daemon:residency-op": "owner",
  "daemon:wiki-alert": "owner",
  "cas:want": "owner",
  "dyad:ask": "owner",
  "doc:rest": "owner",
  "custody:write": "owner",
  // The session sign door (sealed-store#/the-store): the browser island composes no session proof until U4 moves the
  // daemon kernel into the holder (road F6, slice four), so no browser island asks one; the route stays total.
  "session:sign": "owner",
  "view:catalog": "owner",
  "view:content": "owner",
  "view:settle": "owner",
} as const satisfies Record<IslandToVesselMsg["type"], HolderRoute>;
