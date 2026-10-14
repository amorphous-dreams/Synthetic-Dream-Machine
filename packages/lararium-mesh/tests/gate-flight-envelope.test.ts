/**
 * The browser's first flight, as it crosses an upgrade: the fixed protocol name, then Noise IK message one as
 * one unpadded base64url token, in `Sec-WebSocket-Protocol`. The gate's 101 selects the fixed name alone.
 *
 * Measured (Chromium 156, Firefox 157, WebKit 27.2, direct and behind the household terminator's nginx 1.30;
 * lar:///ha.ka.ba/lares/api/pono/face-proof#/the-browser-envelope):
 *   · each browser sends the list in the order given, joined by ", ";
 *   · Chromium and Firefox refuse `=`, `/`, space and the other separators at construction; base64url passes;
 *   · Chromium fails a 101 that selects no protocol, Firefox and WebKit open it with protocol "": the dialer
 *     itself must check the selection;
 *   · a foreign selection fails in all three.
 */
import { describe, expect, test } from "vitest";
import {
  GATE_FLIGHT_BYTES, GATE_FLIGHT_HEADER_BYTES, GATE_FLIGHT_REFUSALS, GATE_FLIGHT_TOKEN_CHARS, GATE_PROTOCOL,
  gateFlightProtocols, gateProtocolSelected, readGateFlightHeader,
} from "../src/gate-exchange.js";
import { MIN_MESSAGE1_BYTES, noiseInitiate, noiseKeyPair, noiseRespond } from "../src/noise-ik.js";

const prologue = new TextEncoder().encode("gate-flight-envelope.synthetic");
const gate = noiseKeyPair(new Uint8Array(32).fill(7));
const dialer = noiseKeyPair(new Uint8Array(32).fill(9));
const flight = (): Uint8Array => noiseInitiate({ prologue, s: dialer, rs: gate.publicKey }).message1;
const header = (protocols: readonly string[]): string => protocols.join(", ");
const refusal = (value: unknown): string | null => {
  const read = readGateFlightHeader(value as string);
  return read.ok ? null : read.refusal;
};

describe("the first flight's envelope", () => {
  test("the minimal flight weighs 96 bytes, spells 128 characters and a 138-byte header", () => {
    expect(GATE_FLIGHT_BYTES).toBe(MIN_MESSAGE1_BYTES);
    expect(GATE_FLIGHT_BYTES).toBe(96);
    expect(GATE_FLIGHT_TOKEN_CHARS).toBe(128);
    expect(GATE_PROTOCOL).toBe("lar-gate");
    expect(GATE_FLIGHT_HEADER_BYTES).toBe(GATE_PROTOCOL.length + 2 + GATE_FLIGHT_TOKEN_CHARS);
    // Stock nginx refused an 8205-byte header line and passed 8013; the envelope stays far inside both.
    expect(GATE_FLIGHT_HEADER_BYTES).toBeLessThan(1024);
  });

  test("a flight round-trips as the browsers send it, and the gate answers it", () => {
    const message1 = flight();
    const protocols = gateFlightProtocols(message1);
    expect(protocols[0]).toBe(GATE_PROTOCOL);
    expect(protocols[1]).toMatch(/^[A-Za-z0-9_-]{128}$/);
    const sent = header(protocols);
    expect(sent.length).toBe(GATE_FLIGHT_HEADER_BYTES);
    const read = readGateFlightHeader(sent);
    if (!read.ok) throw new Error(read.refusal);
    expect(Buffer.from(read.message1).equals(Buffer.from(message1))).toBe(true);
    // The read bytes answer as a flight: the reader moved no byte.
    expect(noiseRespond({ prologue, s: gate, message1: read.message1 }).payload.length).toBe(0);
  });

  test("list whitespace around the comma reads alike; the token itself has one spelling", () => {
    const protocols = gateFlightProtocols(flight());
    for (const spelled of [`${protocols[0]},${protocols[1]}`, `${protocols[0]} ,\t${protocols[1]}`, ` ${protocols[0]}, ${protocols[1]} `]) {
      expect(readGateFlightHeader(spelled).ok, JSON.stringify(spelled)).toBe(true);
    }
  });

  test("a flight that carries a payload never leaves", () => {
    const fat = noiseInitiate({ prologue, s: dialer, rs: gate.publicKey, payload: new Uint8Array([1]) }).message1;
    expect(fat.length).toBe(GATE_FLIGHT_BYTES + 1);
    expect(() => gateFlightProtocols(fat)).toThrow(RangeError);
    expect(() => gateFlightProtocols(new Uint8Array(GATE_FLIGHT_BYTES - 1))).toThrow(RangeError);
  });

  test("the refusals, each by its own name", () => {
    const [name, token] = gateFlightProtocols(flight());
    const cases: Record<string, unknown> = {
      absent: undefined, empty: "", notText: ["lar-gate", token],
      tokenAlone: token, nameAlone: name, three: header([name, token, "x"]), emptyEntry: header([name, "", token]), trailingComma: `${name}, `,
      noBreakSpace: `${name}\u00a0, ${token}`,
      tokenFirst: header([token, name]), foreignName: header(["lar-gate-v2", token]), caseName: header(["LAR-GATE", token]),
      short: header([name, token.slice(1)]), padded: header([name, token.slice(4) + "AA=="]),
      standardAlphabet: header([name, token.slice(1) + "+"]), slash: header([name, token.slice(1) + "/"]),
      nonAscii: header([name, token.slice(1) + "é"]),
      long: header([name, token + "A"]), tablet: header([name, "A".repeat(10923)]),
    };
    const got = Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, refusal(v)]));
    expect(got).toEqual({
      absent: "flight-absent", empty: "flight-absent", notText: "flight-absent",
      tokenAlone: "flight-shape", nameAlone: "flight-shape", three: "flight-shape", emptyEntry: "flight-shape", trailingComma: "flight-shape",
      noBreakSpace: "flight-protocol",
      tokenFirst: "flight-protocol", foreignName: "flight-protocol", caseName: "flight-protocol",
      short: "flight-token", padded: "flight-token", standardAlphabet: "flight-token", slash: "flight-token",
      nonAscii: "flight-token",
      long: "flight-overlong", tablet: "flight-overlong",
    });
    expect([...new Set(Object.values(got))].sort()).toEqual([...GATE_FLIGHT_REFUSALS].sort());
  });

  test("CONTROL: a header past any bound refuses before the reader splits it", () => {
    // Split first, and this value reads as a million empty entries: the bound must answer before the split.
    const huge = `${GATE_PROTOCOL},${",".repeat(1 << 20)}`;
    expect(refusal(huge)).toBe("flight-overlong");
  });

  // The gate's own vector proves a replayed flight draws silence (face-gate.test.ts, "a replayed first flight").
  test("the reader holds no memory: a replayed header reads the same bytes", () => {
    const sent = header(gateFlightProtocols(flight()));
    const first = readGateFlightHeader(sent);
    const again = readGateFlightHeader(sent);
    expect(first.ok && again.ok && Buffer.from(first.message1).equals(Buffer.from(again.message1))).toBe(true);
  });

  test("a flight under another pin's prologue reads, and decrypts nothing at the gate", () => {
    const other = noiseInitiate({ prologue: new TextEncoder().encode("another-pin"), s: dialer, rs: gate.publicKey }).message1;
    const read = readGateFlightHeader(header(gateFlightProtocols(other)));
    if (!read.ok) throw new Error(read.refusal);
    expect(() => noiseRespond({ prologue, s: gate, message1: read.message1 })).toThrow("noise-handshake-failed");
  });
});

describe("the gate's selection, as the dialer checks it", () => {
  test("the fixed name alone selects", () => {
    expect(gateProtocolSelected(GATE_PROTOCOL)).toBe(true);
  });
  test("Firefox and WebKit open a 101 that selected nothing; the dialer refuses it", () => {
    expect(gateProtocolSelected("")).toBe(false);
  });
  test("an echoed token, a list, a case variant and a non-string select nothing", () => {
    const [, token] = gateFlightProtocols(flight());
    for (const v of [token, `${GATE_PROTOCOL}, ${token}`, "LAR-GATE", ` ${GATE_PROTOCOL}`, undefined, null]) {
      expect(gateProtocolSelected(v as string), String(v)).toBe(false);
    }
  });
});
