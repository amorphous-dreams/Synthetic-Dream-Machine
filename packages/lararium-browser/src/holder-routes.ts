import type { IslandToVesselMsg, VesselToIslandMsg } from "@lararium/mesh";

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
  "receipt:request": "owner",
  "receipt:asks-done": "owner",
  // V2: an island's rest ask reaches the vessel whose sealed rest answers it.
  "rest:ask": "owner",
  "custody:write": "owner",
  // The record asks reach the owner, the vessel that holds the island's capability record (`browser-island-caps.ts`),
  // which answers each through the member of its name; a session sign answers there or refuses `signer-unavailable`.
  "session:sign": "owner",
  "view:catalog": "owner",
  "view:content": "owner",
  "view:settle": "owner",
  // The document store's door answers the vessel that holds the island's capability record, as its other asks do.
  "docstore:sealed": "owner",
  "docstore:opened": "owner",
  "docstore:live": "owner",
  "docstore:slot": "owner",
} as const satisfies Record<IslandToVesselMsg["type"], HolderRoute>;

/** Who may send an island-bound kind through the holder: any admitted session, or only the house's owner (its vessel). */
export type HolderSender = "any" | "owner";

/**
 * EVERY VESSEL-TO-ISLAND KIND DECLARES ITS SENDER, read off island-protocol's own union (`VesselToIslandMsg`), so a kind
 * the protocol grows fails the build until it is placed here. A session's tab sends its verbs, its camera events and its
 * record-port traffic (the port door leases that); the island's lifecycle, its capability answers and the daemon's own
 * answers belong to the owner alone, and the holder refuses them from any other tab by name (`owner-only-kind`). A kind
 * outside this table (a sensorium signal) reads owner-only: the holder fails closed.
 */
export const HOLDER_SENDERS = {
  "manifest": "owner",
  "wiki:request-drain": "owner",
  "hooanu": "owner",
  "teardown": "owner",
  "daemon:place-verb": "any",
  "telemetry:place-verb": "owner",
  "structurepalace:kapae": "owner",
  "daemon:worldline-compare-request": "any",
  "daemon:worldline-trajectory-request": "any",
  "daemon:verb-result": "owner",
  "daemon:face-lit": "owner",
  "daemon:face-drop": "owner",
  "daemon:face-bags": "owner",
  "daemon:resolve-binding-request": "any",
  "daemon:gate-verb-request": "any",
  "daemon:evict-result": "owner",
  "daemon:residency-op-result": "owner",
  "wiki:place-verb": "any",
  "lar:control-event": "any",
  "lar:resend": "any",
  "port:open": "any",
  "port:write": "any",
  "port:ask": "any",
  "port:presence": "any",
  "port:close": "any",
  "port:ack": "any",
  "port:widen": "any",
  "port:lease": "any",
  "port:gone": "any",
  "cas:block": "owner",
  "dyad:read": "owner",
  "receipt:issued": "owner",
  "receipt:close": "owner",
  "rest:answer": "owner",
  "custody:written": "owner",
  "session:signed": "owner",
  "view:catalog-result": "owner",
  "view:content-result": "owner",
  "view:settled": "owner",
} as const satisfies Record<Exclude<VesselToIslandMsg["type"], `sensorium:${string}`>, HolderSender>;

/** True when only the house's owner may send this island-bound kind (unknown kinds included). */
export function ownerOnlyKind(type: string): boolean {
  return (HOLDER_SENDERS as Readonly<Record<string, HolderSender>>)[type] !== "any";
}

/** The island-bound kinds only the owner may send, read off the table (the forging census walks these). */
export const OWNER_ONLY_KINDS: readonly string[] = Object.entries(HOLDER_SENDERS).filter(([, sender]) => sender === "owner").map(([type]) => type);
