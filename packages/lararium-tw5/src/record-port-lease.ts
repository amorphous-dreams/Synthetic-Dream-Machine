import { readPortVesselMsg, type PortGrant } from "@lararium/mesh/record-port";
import type { IslandCap } from "./island-caps.js";
import { hasRecordPort, type RecordPortOptions } from "./record-port-handler.js";

/** The island trusts a lease because only the vessel may post one; the page placement door refuses it. */
export function hasPortLease(inner: RecordPortOptions = {}): IslandCap {
  const grants = new Map<string, PortGrant>();
  const lends: RecordPortOptions = {
    faceOf: portId => {
      const grant = grants.get(portId);
      return grant ? Object.freeze({ id: grant.faceId, portId }) : undefined;
    },
    actorOf: portId => grants.get(portId)?.actor,
    mayEdit: (portId, actor) => {
      const grant = grants.get(portId);
      return grant?.edits === true && grant.actor === actor;
    },
    bagGrant: (portId, actor, bag) => {
      const grant = grants.get(portId);
      return grant?.actor === actor && grant.bags.includes(bag);
    },
    verbCap: (_face, portId) => async (access, bag) => {
      const grant = grants.get(portId);
      return { ok: Boolean(grant?.bags.includes(bag) && (access === "read" || grant.admin)), reason: "bag-not-granted" };
    },
    casTierOf: (cid, portId) => grants.get(portId)?.casTier?.[cid],
    kahuReach: portId => () => grants.get(portId)?.kahu ?? null,
    authority: req => {
      const portId = req.provenFace && "portId" in req.provenFace ? req.provenFace.portId : undefined;
      const grant = typeof portId === "string" ? grants.get(portId) : undefined;
      return grant?.admin === true ? { allowed: true } : { allowed: false, reason: "not-admin" };
    },
    ...inner,
  };
  const port = hasRecordPort(lends);
  return {
    name: "record-port-lease",
    onEa: ctx => port.onEa?.(ctx),
    onHooAnu: ctx => port.onHooAnu?.(ctx),
    onSignal(type, raw, ctx) {
      if (type === "port:lease" || type === "port:gone") {
        const msg = readPortVesselMsg(raw);
        if (!msg || msg.type !== type) return false;
        if (msg.type === "port:lease") grants.set(msg.portId, msg.grant);
        else if (msg.type === "port:gone") { port.transportGone(msg.portId); grants.delete(msg.portId); }
        return true;
      }
      const handled = port.onSignal?.(type, raw, ctx) ?? false;
      // A closed port's grant leaves with it; a reopen under the same id meets a fresh lease from the vessel.
      if (type === "port:close") { const msg = readPortVesselMsg(raw); if (msg) grants.delete(msg.portId); }
      return handled;
    },
  };
}
