/**
 * lan-discovery — find CANDIDATE addresses for vessels on one LAN, over multicast DNS, with `node:dgram` alone.
 *
 * AN ANNOUNCEMENT CARRIES A BARE SERVICE AND A PORT. Its bytes hold the service name `_lararium._tcp.local`, a
 * per-boot random 8-hex instance label and the listen port: no key, no catalog or document address, no Nexus name,
 * no host or persona name, no version. Anyone on the link reads an announcement, so it holds nothing worth reading.
 *
 * A CANDIDATE GRANTS NOTHING. The listener builds `http://<datagram source address>:<SRV port>` and never trusts a
 * name or address inside the packet. The gate at that URL answers only a dialer holding its pinned key, and that
 * key reaches a device through an admission a human carried (`candidatePin`).
 *
 * NO CLOCK DECIDES. The module holds no timer and reads no time: nothing expires a candidate. A caller that stops
 * waiting closes the listener.
 *
 * Three parts: a pure codec for the DNS subset (every datagram treated as hostile), two actors over an injected
 * `LanSocket`, and `dgramLanSocket`, the one real socket.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/harbor#/lan-discovery
 */
import { randomBytes } from "node:crypto";
import { isIPv4 } from "node:net";
import { createSocket, type Socket } from "node:dgram";

const SERVICE = "_lararium._tcp.local";
const MAX_PACKET = 9000;
const MAX_LABELS = 127;
const MAX_POINTER_HOPS = 16;
const MAX_CANDIDATES = 64;
const TYPE_PTR = 12;
const TYPE_TXT = 16;
const TYPE_SRV = 33;

export interface LanAnnouncement {
  readonly instance: string;
  readonly port: number;
}

export interface LanCandidate {
  readonly url: string;
  readonly instance: string;
}

export interface LanSocket {
  send(bytes: Uint8Array): void;
  onMessage(cb: (bytes: Uint8Array, from: { address: string }) => void): void;
  close(): void;
}

export interface LanDatagramSocket extends LanSocket {
  onError(cb: (error: Error) => void): void;
}

export type LanRecord =
  | { readonly type: "PTR"; readonly name: string; readonly target: string }
  | { readonly type: "SRV"; readonly name: string; readonly priority: number; readonly weight: number; readonly port: number; readonly target: string }
  | { readonly type: "TXT"; readonly name: string; readonly strings: readonly string[] };

export type LanPacket =
  | { readonly kind: "query" }
  | { readonly kind: "response"; readonly announcement: LanAnnouncement; readonly records: readonly LanRecord[] };

function validAnnouncement(value: LanAnnouncement): boolean {
  if (value === null || typeof value !== "object") return false;
  const keys = Object.keys(value as object).sort();
  return keys.length === 2 && keys[0] === "instance" && keys[1] === "port" &&
    typeof value.instance === "string" && /^[0-9a-f]{8}$/.test(value.instance) &&
    Number.isInteger(value.port) && value.port >= 1 && value.port <= 65535;
}

function assertAnnouncement(value: LanAnnouncement): void {
  if (!validAnnouncement(value)) throw new TypeError("LAN announcement requires exactly an 8-hex instance and a port from 1 to 65535");
}

/** Make one per-boot instance label from an injected source, defaulting to eight cryptographic hex digits. */
export function createLanAnnouncement(port: number, randomLabel: () => string = () => randomBytes(4).toString("hex")): LanAnnouncement {
  const announcement = { instance: randomLabel(), port };
  assertAnnouncement(announcement);
  return announcement;
}

function dnsName(name: string): Uint8Array {
  const labels = name.split(".");
  if (labels.length > MAX_LABELS || labels.some((label) => !label || new TextEncoder().encode(label).length > 63)) {
    throw new TypeError("DNS name has an invalid label");
  }
  const encoded = labels.map((label) => {
    const bytes = new TextEncoder().encode(label);
    return Uint8Array.from([bytes.length, ...bytes]);
  });
  return concat(...encoded, Uint8Array.of(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function u16(value: number): Uint8Array { return Uint8Array.of((value >>> 8) & 255, value & 255); }

/** Encode the one PTR question all LAN listeners ask. */
export function encodePtrQuestion(): Uint8Array {
  return concat(Uint8Array.of(0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0), dnsName(SERVICE), u16(TYPE_PTR), u16(1));
}

function rr(name: string, type: number, data: Uint8Array): Uint8Array {
  return concat(dnsName(name), u16(type), u16(1), Uint8Array.of(0, 0, 0, 120), u16(data.length), data);
}

/** Encode the PTR, SRV and required empty TXT announcement. No other fields enter the packet. */
export function encodeLanResponse(announcement: LanAnnouncement): Uint8Array {
  assertAnnouncement(announcement);
  const instanceService = `${announcement.instance}._lararium._tcp.local`;
  const records = [
    rr(SERVICE, TYPE_PTR, dnsName(instanceService)),
    rr(instanceService, TYPE_SRV, concat(u16(0), u16(0), u16(announcement.port), dnsName(`${announcement.instance}.local`))),
    rr(instanceService, TYPE_TXT, Uint8Array.of(0)),
  ];
  return concat(Uint8Array.of(0, 0, 0x84, 0, 0, 0, 0, 3, 0, 0, 0, 0), ...records);
}

function readName(bytes: Uint8Array, start: number): { name: string; next: number } | null {
  const labels: string[] = [];
  let cursor = start;
  let next = -1;
  let hops = 0;
  let wireLength = 1;
  const visited = new Set<number>();
  while (true) {
    if (cursor >= bytes.length) return null;
    const size = bytes[cursor]!;
    if ((size & 0xc0) === 0xc0) {
      if (cursor + 1 >= bytes.length || ++hops > MAX_POINTER_HOPS) return null;
      const pointer = ((size & 0x3f) << 8) | bytes[cursor + 1]!;
      if (pointer >= cursor || visited.has(pointer)) return null;
      visited.add(pointer);
      if (next < 0) next = cursor + 2;
      cursor = pointer;
      continue;
    }
    if ((size & 0xc0) !== 0 || size > 63) return null;
    cursor++;
    if (size === 0) {
      if (next < 0) next = cursor;
      return { name: labels.join("."), next };
    }
    if (labels.length >= MAX_LABELS || cursor + size > bytes.length) return null;
    wireLength += size + 1;
    if (wireLength > 255) return null;
    const labelBytes = bytes.subarray(cursor, cursor + size);
    for (const b of labelBytes) if (b < 0x21 || b > 0x7e || b === 0x2e) return null;
    labels.push(new TextDecoder("ascii", { fatal: true }).decode(labelBytes));
    cursor += size;
  }
}

function readU16(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

/** Decode the supported DNS-SD subset. Any malformed, unrelated or incomplete packet returns null. */
export function decodeLanPacket(input: Uint8Array): LanPacket | null {
  try {
    if (!(input instanceof Uint8Array) || input.length < 12 || input.length > MAX_PACKET) return null;
    const bytes = input;
    const flags = readU16(bytes, 2)!;
    const qd = readU16(bytes, 4)!;
    const an = readU16(bytes, 6)!;
    const ns = readU16(bytes, 8)!;
    const ar = readU16(bytes, 10)!;
    if ((flags & 0x8000) === 0) {
      if ((flags & 0x7800) !== 0 || qd !== 1 || an !== 0 || ns !== 0 || ar !== 0) return null;
      const qname = readName(bytes, 12);
      if (!qname || qname.name.toLowerCase() !== SERVICE) return null;
      const type = readU16(bytes, qname.next);
      const klass = readU16(bytes, qname.next + 2);
      return type === TYPE_PTR && klass !== null && (klass & 0x7fff) === 1 && qname.next + 4 === bytes.length ? { kind: "query" } : null;
    }
    if ((flags & 0x7800) !== 0 || (flags & 0x000f) !== 0 || qd !== 0 || an + ns + ar > 64) return null;
    const records: LanRecord[] = [];
    let cursor = 12;
    for (let i = 0; i < an + ns + ar; i++) {
      const owner = readName(bytes, cursor);
      if (!owner) return null;
      cursor = owner.next;
      const type = readU16(bytes, cursor), klass = readU16(bytes, cursor + 2), ttlHi = readU16(bytes, cursor + 4), rdlen = readU16(bytes, cursor + 8);
      if (type === null || klass === null || ttlHi === null || rdlen === null || cursor + 10 + rdlen > bytes.length) return null;
      const dataStart = cursor + 10, dataEnd = dataStart + rdlen;
      if (klass !== 1) { cursor = dataEnd; continue; }
      if (type === TYPE_PTR) {
        const target = readName(bytes, dataStart);
        if (!target || target.next !== dataEnd) return null;
        records.push({ type: "PTR", name: owner.name, target: target.name });
      } else if (type === TYPE_SRV) {
        if (rdlen < 7) return null;
        const priority = readU16(bytes, dataStart)!, weight = readU16(bytes, dataStart + 2)!, port = readU16(bytes, dataStart + 4)!;
        const target = readName(bytes, dataStart + 6);
        if (!target || target.next !== dataEnd) return null;
        records.push({ type: "SRV", name: owner.name, priority, weight, port, target: target.name });
      } else if (type === TYPE_TXT) {
        const strings: string[] = [];
        let p = dataStart;
        while (p < dataEnd) {
          const length = bytes[p++]!;
          if (p + length > dataEnd) return null;
          strings.push(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(p, p + length)));
          p += length;
        }
        records.push({ type: "TXT", name: owner.name, strings });
      }
      cursor = dataEnd;
    }
    if (cursor !== bytes.length) return null;
    const ptrs = records.filter((r): r is Extract<LanRecord, { type: "PTR" }> => r.type === "PTR");
    const srvs = records.filter((r): r is Extract<LanRecord, { type: "SRV" }> => r.type === "SRV");
    const txts = records.filter((r): r is Extract<LanRecord, { type: "TXT" }> => r.type === "TXT");
    // The bare announcement holds exactly these three records. A response carrying anything more, or an SRV
    // target other than the instance's own `.local` name, holds bytes this format never emits and yields nothing.
    if (records.length !== 3 || an + ns + ar !== 3) return null;
    if (ptrs.length !== 1 || srvs.length !== 1 || txts.length !== 1) return null;
    const ptr = ptrs[0]!, srv = srvs[0]!, txt = txts[0]!;
    const match = /^([0-9a-f]{8})\._lararium\._tcp\.local$/.exec(ptr.target);
    if (!match || ptr.name.toLowerCase() !== SERVICE || srv.name.toLowerCase() !== ptr.target.toLowerCase() ||
        txt.name.toLowerCase() !== ptr.target.toLowerCase() || srv.priority !== 0 || srv.weight !== 0 ||
        srv.port < 1 || srv.port > 65535 || srv.target.toLowerCase() !== `${match[1]!.toLowerCase()}.local` ||
        txt.strings.length !== 1 || txt.strings[0] !== "") return null;
    const instance = match[1]!.toLowerCase();
    return { kind: "response", announcement: { instance, port: srv.port }, records };
  } catch {
    return null;
  }
}

export function createLanAnnouncer(opts: { socket: LanSocket; announcement: LanAnnouncement }): { announce(): void; close(): void } {
  assertAnnouncement(opts.announcement);
  const response = encodeLanResponse(opts.announcement);
  let closed = false;
  opts.socket.onMessage((bytes) => {
    if (closed) return;
    if (decodeLanPacket(bytes)?.kind === "query") opts.socket.send(response);
  });
  return {
    announce() { if (!closed) opts.socket.send(response); },
    close() { if (!closed) { closed = true; opts.socket.close(); } },
  };
}

export function createLanListener(opts: {
  socket: LanSocket;
  onCandidate: (candidate: LanCandidate) => void;
  ownInstance?: string;
  limit?: number;
}): { query(): void; candidates(): readonly LanCandidate[]; close(): void } {
  // A caller may lower the bound and never raise it: the module's own ceiling holds whatever a caller passes.
  const max = opts.limit === undefined ? MAX_CANDIDATES : Number.isInteger(opts.limit) ? Math.min(MAX_CANDIDATES, Math.max(0, opts.limit)) : 0;
  const found: LanCandidate[] = [];
  const urls = new Set<string>();
  let closed = false;
  opts.socket.onMessage((bytes, from) => {
    if (closed || found.length >= max) return;
    const packet = decodeLanPacket(bytes);
    if (packet?.kind !== "response" || packet.announcement.instance === opts.ownInstance || !isIPv4(from.address)) return;
    const url = `http://${from.address}:${packet.announcement.port}`;
    if (urls.has(url)) return;
    const candidate = Object.freeze({ url, instance: packet.announcement.instance });
    urls.add(url);
    found.push(candidate);
    opts.onCandidate(candidate);
  });
  return {
    query() { if (!closed) opts.socket.send(encodePtrQuestion()); },
    candidates() { return found.slice(); },
    close() { if (!closed) { closed = true; opts.socket.close(); } },
  };
}

/**
 * A discovery candidate supplies only the URL. A key comes from a human-carried admission (the gate pin a
 * `lares fleet join answer` signs); without that pinned key the candidate never becomes a peer entry.
 */
export function candidatePin(candidate: LanCandidate, gateKeyHex: string | null): string | null {
  return typeof candidate?.url === "string" && typeof gateKeyHex === "string" && /^[0-9a-fA-F]{64}$/.test(gateKeyHex)
    ? `${candidate.url}#${gateKeyHex.toLowerCase()}`
    : null;
}

/** Bind one IPv4 mDNS socket, joining the link-local group with link-only multicast and local loopback. */
export function dgramLanSocket(opts: { port?: number; group?: string; interfaceAddress?: string } = {}): LanDatagramSocket {
  const port = opts.port ?? 5353;
  const group = opts.group ?? "224.0.0.251";
  const socket: Socket = createSocket({ type: "udp4", reuseAddr: true });
  let errorHandler: (error: Error) => void = () => {};
  let ready = false;
  let closed = false;
  const pending: Uint8Array[] = [];
  socket.on("message", (bytes, rinfo) => {
    for (const handler of messageHandlers) handler(bytes, { address: rinfo.address });
  });
  socket.on("error", (error) => errorHandler(error));
  const messageHandlers: Array<(bytes: Uint8Array, from: { address: string }) => void> = [];
  socket.bind(port, () => {
    try {
      socket.addMembership(group, opts.interfaceAddress);
      socket.setMulticastTTL(1);
      socket.setMulticastLoopback(true);
      ready = true;
      for (const bytes of pending.splice(0)) socket.send(bytes, port, group);
    } catch (error) {
      errorHandler(error instanceof Error ? error : new Error(String(error)));
      closed = true;
      pending.length = 0;
      try { socket.close(); } catch { /* a failed bind may already have closed the datagram socket */ }
    }
  });
  return {
    send(bytes) {
      if (closed) return;
      if (!ready) pending.push(Uint8Array.from(bytes));
      else socket.send(bytes, port, group);
    },
    onMessage(cb) { messageHandlers.push(cb); },
    onError(cb) { errorHandler = cb; },
    close() {
      if (closed) return;
      closed = true;
      pending.length = 0;
      try { socket.close(); } catch { /* a bind failure may have closed it already */ }
    },
  };
}
