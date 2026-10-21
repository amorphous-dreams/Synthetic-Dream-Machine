import type { IslandToVesselMsg } from "@lararium/mesh";

export type HolderRoute = "reply" | "camera" | "owner";

/** Every island kind declares the one binding that may receive it. */
export const HOLDER_ROUTES = {
  "wiki:verb-result": "reply",
  "daemon:derive-skeleton-result": "reply",
  "daemon:worldline-compare-result": "reply",
  "daemon:worldline-trajectory-result": "reply",
  "daemon:resolve-binding-result": "reply",

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
  "daemon:residency-op": "owner",
  "daemon:wiki-alert": "owner",
  "cas:want": "owner",
  "dyad:ask": "owner",
  "doc:rest": "owner",
  "custody:write": "owner",
  "view:catalog": "owner",
  "view:content": "owner",
  "view:settle": "owner",
} as const satisfies Record<IslandToVesselMsg["type"], HolderRoute>;
