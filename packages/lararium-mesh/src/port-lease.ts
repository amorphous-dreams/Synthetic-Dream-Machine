import { mkPortGone, mkPortLease, readPortVesselMsg, type PortGrant, type PortVesselToIslandMsg } from "./record-port.js";

export type PortPlacement = { readonly ok: true } | { readonly ok: false; readonly reason: "port-kind-refused" | "port-malformed" | "port-not-granted" | "port-owned" | "port-unleased" | "no-live-island" | string };
export type PortPolicy = (binding: string, islandKey: string) => PortGrant | null;

export function makePortLeaseTable() {
  const scopes = new Map<string, Map<string, string>>();
  return {
    admit(scope: string, portId: string, binding: string): boolean {
      if (!scope || !portId || !binding) return false;
      const ports = scopes.get(scope) ?? new Map<string, string>();
      if (ports.has(portId) && ports.get(portId) !== binding) return false;
      ports.set(portId, binding);
      scopes.set(scope, ports);
      return true;
    },
    holder(scope: string, portId: string): string | undefined { return scopes.get(scope)?.get(portId); },
    release(scope: string, portId: string, binding: string): boolean {
      const ports = scopes.get(scope);
      if (!ports || ports.get(portId) !== binding) return false;
      ports.delete(portId);
      if (!ports.size) scopes.delete(scope);
      return true;
    },
    leasesOf(binding: string): Array<{ scope: string; portId: string }> {
      const found: Array<{ scope: string; portId: string }> = [];
      for (const [scope, ports] of scopes) for (const [portId, holder] of ports)
        if (holder === binding) found.push({ scope, portId });
      return found;
    },
    releaseScope(scope: string): void { scopes.delete(scope); },
  };
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, part]) => [key, stable(part)]));
  return value;
}

export function makePortDoor(opts: { readonly policy?: PortPolicy; readonly post: (scope: string, msg: PortVesselToIslandMsg) => void }) {
  const table = makePortLeaseTable();
  const digests = new Map<string, Map<string, string>>();
  const refusal = (reason: string): PortPlacement => ({ ok: false, reason });
  const policy = (binding: string, scope: string): PortGrant | null => {
    try { return opts.policy?.(binding, scope) ?? null; }
    catch { return null; }
  };
  const forget = (scope: string, portId: string): void => {
    const ports = digests.get(scope);
    ports?.delete(portId);
    if (ports?.size === 0) digests.delete(scope);
  };
  const grantAt = (scope: string, portId: string, grant: PortGrant): void => {
    const digest = JSON.stringify(stable(grant));
    const ports = digests.get(scope) ?? new Map<string, string>();
    if (ports.get(portId) !== digest) {
      opts.post(scope, mkPortLease({ portId, grant }));
      ports.set(portId, digest);
      digests.set(scope, ports);
    }
  };
  return {
    place(scope: string, binding: string, raw: unknown): PortPlacement {
      if (!binding) return refusal("port-unleased");
      if (raw && typeof raw === "object" && "type" in raw) {
        const type = (raw as { type?: unknown }).type;
        if (typeof type === "string" && type.startsWith("port:") &&
          !["port:open", "port:write", "port:ask", "port:presence", "port:close", "port:ack", "port:widen"].includes(type))
          return refusal("port-kind-refused");
      }
      const msg = readPortVesselMsg(raw);
      if (!msg) return refusal("port-malformed");
      if (msg.type === "port:lease" || msg.type === "port:gone") return refusal("port-kind-refused");
      const holder = table.holder(scope, msg.portId);
      if (holder && holder !== binding) return refusal("port-owned");
      if (msg.type === "port:open") {
        const grant = policy(binding, scope);
        if (!grant) {
          if (holder === binding) {
            opts.post(scope, mkPortGone({ portId: msg.portId }));
            table.release(scope, msg.portId, binding);
            forget(scope, msg.portId);
          }
          return refusal("port-not-granted");
        }
        if (!table.admit(scope, msg.portId, binding)) return refusal("port-owned");
        grantAt(scope, msg.portId, grant);
      } else {
        if (!holder) return refusal("port-unleased");
        const grant = policy(binding, scope);
        if (!grant) {
          opts.post(scope, mkPortGone({ portId: msg.portId }));
          table.release(scope, msg.portId, binding);
          forget(scope, msg.portId);
          return refusal("port-not-granted");
        }
        if (msg.type === "port:write" || msg.type === "port:ask") grantAt(scope, msg.portId, grant);
      }
      opts.post(scope, msg);
      if (msg.type === "port:close") { table.release(scope, msg.portId, binding); forget(scope, msg.portId); }
      return { ok: true };
    },
    closeBinding(binding: string): void {
      for (const { scope, portId } of table.leasesOf(binding)) {
        opts.post(scope, mkPortGone({ portId }));
        table.release(scope, portId, binding);
        forget(scope, portId);
      }
    },
    releaseScope(scope: string): void { table.releaseScope(scope); digests.delete(scope); },
    holderOf(scope: string, portId: string): string | undefined { return table.holder(scope, portId); },
  };
}
