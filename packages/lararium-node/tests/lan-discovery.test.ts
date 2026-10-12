import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  createLanAnnouncement, createLanAnnouncer, createLanListener, encodeLanResponse, encodePtrQuestion,
  decodeLanPacket, candidatePin, type LanSocket,
} from "../src/lan-discovery.js";
import { parseMeshPeer, knockPath, knockSegment } from "@lararium/mesh";

type Receiver = (bytes: Uint8Array, from: { address: string }) => void;
class Bus {
  readonly parties: Party[] = [];
  party(address: string): Party {
    const p = new Party(this, address);
    this.parties.push(p);
    return p;
  }
  deliver(sender: Party, bytes: Uint8Array): void {
    for (const p of this.parties) if (p !== sender && !p.closed) p.inject(bytes, sender.address);
  }
}
class Party implements LanSocket {
  readonly receivers: Receiver[] = [];
  closed = false;
  constructor(private readonly bus: Bus, readonly address: string) {}
  send(bytes: Uint8Array): void { this.bus.deliver(this, bytes); }
  onMessage(cb: Receiver): void { this.receivers.push(cb); }
  close(): void { this.closed = true; }
  inject(bytes: Uint8Array, from: string): void { for (const receiver of this.receivers) receiver(bytes, { address: from }); }
}

function hostileHeader(bytes: number[]): Uint8Array { return Uint8Array.from(bytes); }
function positiveScanner(source: string): boolean { return /setTimeout|setInterval|Date\.now|performance\.now/.test(source); }

describe("LAN candidate discovery", () => {
  test("two listeners learn only the other vessel's source-address candidate", () => {
    const bus = new Bus();
    const a = bus.party("192.168.1.10"), b = bus.party("192.168.1.20");
    const la = createLanListener({ socket: a, ownInstance: "00000001", onCandidate: () => {} });
    const lb = createLanListener({ socket: b, ownInstance: "00000002", onCandidate: () => {} });
    const aa = createLanAnnouncer({ socket: a, announcement: { instance: "00000001", port: 8081 } });
    const ab = createLanAnnouncer({ socket: b, announcement: { instance: "00000002", port: 8082 } });
    la.query(); lb.query();
    expect(la.candidates()).toEqual([{ url: "http://192.168.1.20:8082", instance: "00000002" }]);
    expect(lb.candidates()).toEqual([{ url: "http://192.168.1.10:8081", instance: "00000001" }]);
    aa.announce(); ab.announce();
    expect(la.candidates()).toEqual([{ url: "http://192.168.1.20:8082", instance: "00000002" }]);
    expect(lb.candidates()).toEqual([{ url: "http://192.168.1.10:8081", instance: "00000001" }]);
    la.close(); lb.close(); aa.close(); ab.close();
  });

  test("the response carries exactly the bare service PTR, SRV port, and empty TXT", () => {
    const bytes = encodeLanResponse({ instance: "a1b2c3d4", port: 4321 });
    const packet = decodeLanPacket(bytes);
    expect(packet).toEqual({
      kind: "response", announcement: { instance: "a1b2c3d4", port: 4321 },
      records: [
        { type: "PTR", name: "_lararium._tcp.local", target: "a1b2c3d4._lararium._tcp.local" },
        { type: "SRV", name: "a1b2c3d4._lararium._tcp.local", priority: 0, weight: 0, port: 4321, target: "a1b2c3d4.local" },
        { type: "TXT", name: "a1b2c3d4._lararium._tcp.local", strings: [""] },
      ],
    });
    const raw = new TextDecoder().decode(bytes);
    expect(raw).not.toContain("automerge:");
    expect(raw).not.toMatch(/[0-9a-f]{64}/);
    expect(raw).not.toContain("lar:");
    expect(decodeLanPacket(encodePtrQuestion()).kind).toBe("query");
    expect(createLanAnnouncement(9000, () => "01020304")).toEqual({ instance: "01020304", port: 9000 });
    expect(() => encodeLanResponse({ instance: "A1B2C3D4", port: 80 })).toThrow();
    expect(() => encodeLanResponse({ instance: "a1b2c3d4", port: 0 })).toThrow();
    expect(() => encodeLanResponse({ instance: "a1b2c3d4", port: 80, key: "f".repeat(64) } as never)).toThrow();
  });

  test("candidate host comes from datagram source even when packet target names another host", () => {
    const socket = new Party(new Bus(), "listener");
    const listener = createLanListener({ socket, onCandidate: () => {} });
    const response = encodeLanResponse({ instance: "a1b2c3d4", port: 8080 });
    const anotherHost = Uint8Array.from(response);
    const targetMarker = [8, ...new TextEncoder().encode("a1b2c3d4"), 5, ...new TextEncoder().encode("local"), 0];
    let targetAt = -1;
    for (let i = 0; i <= anotherHost.length - targetMarker.length; i++) {
      if (targetMarker.every((b, j) => anotherHost[i + j] === b)) { targetAt = i; break; }
    }
    expect(targetAt).toBeGreaterThan(0);
    anotherHost.set(new TextEncoder().encode("evilhost"), targetAt + 1);
    socket.inject(anotherHost, "10.4.5.6");
    expect(listener.candidates()).toEqual([{ url: "http://10.4.5.6:8080", instance: "a1b2c3d4" }]);
    listener.close();
  });

  test("hostile, irrelevant, and invalid-port datagrams yield no candidate and never throw", () => {
    const socket = new Party(new Bus(), "listener");
    const listener = createLanListener({ socket, onCandidate: () => {} });
    const anotherService = Uint8Array.from(encodeLanResponse({ instance: "a1b2c3d4", port: 8080 }));
    anotherService[13] = "x".charCodeAt(0);
    const portZero = Uint8Array.from(encodeLanResponse({ instance: "a1b2c3d4", port: 8080 }));
    const srvType = portZero.findIndex((v, i) => v === 33 && portZero[i + 1] === 0 && portZero[i + 2] === 1);
    portZero[srvType + 14] = 0;
    portZero[srvType + 15] = 0;
    const frames = [
      hostileHeader([0]),
      hostileHeader([0,0,0,0,0,0,0,1,0,0,0,0,0xc0,0x0c,0,12,0,1,0,0,0,0,0,2,0xc0,0x0c]),
      hostileHeader([0,0,0,0,0,0,0,1,0,0,0,0,0xc0,0x0e,0,12,0,1,0,0,0,0,0,2,0xc0,0x0c]),
      hostileHeader([0,0,0,0,0,0,0,1,0,0,0,0,0x40,0x00]),
      anotherService,
      portZero,
    ];
    for (const frame of frames) expect(() => socket.inject(frame, "192.168.1.44")).not.toThrow();
    expect(listener.candidates()).toEqual([]);
    listener.close();
  });

  test("a flood stops at the configured candidate bound", () => {
    const socket = new Party(new Bus(), "listener");
    const listener = createLanListener({ socket, limit: 3, onCandidate: () => {} });
    for (let i = 1; i <= 13; i++) socket.inject(encodeLanResponse({ instance: i.toString(16).padStart(8, "0"), port: 8000 + i }), `10.0.0.${i}`);
    expect(listener.candidates()).toHaveLength(3);
    listener.close();
  });

  test("candidatePin requires a carried gate key and parseMeshPeer refuses a bare URL", () => {
    const candidate = { url: "http://192.168.1.8:8000", instance: "a1b2c3d4" };
    expect(candidatePin(candidate, null)).toBeNull();
    expect(candidatePin(candidate, "not-a-key")).toBeNull();
    const entry = candidatePin(candidate, "ab".repeat(32));
    expect(entry).toBe(`${candidate.url}#${"ab".repeat(32)}`);
    expect(parseMeshPeer(entry!)).not.toBeNull();
    expect(parseMeshPeer(candidate.url)).toBeNull();
  });

  test("the gate's wrong-key knock differs from its registered path", () => {
    const own = "11".repeat(32), wrong = "22".repeat(32);
    const registered = knockPath(own, "/ws");
    const discoveredDialPath = `/ws/${knockSegment(wrong, "/ws")}`;
    expect(discoveredDialPath).toBe(knockPath(wrong, "/ws"));
    expect(discoveredDialPath).not.toBe(registered);
  });

  test("the scanner catches a planted clock read and this module contains no timer decision", () => {
    expect(positiveScanner("setTimeout(() => {}); Date.now();")).toBe(true);
    const source = readFileSync(new URL("../src/lan-discovery.ts", import.meta.url), "utf8");
    expect(positiveScanner(source)).toBe(false);
  });
});
