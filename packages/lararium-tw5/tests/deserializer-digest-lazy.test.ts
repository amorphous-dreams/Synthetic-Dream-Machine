/**
 * THE DESERIALIZER READS THE FRAME'S SHAPE, AND TAKES ITS DIGEST ONLY WHERE A FENCE LANDS.
 *
 * The deserializer needs the frame's shape to hold a torn carrier and to know a frame stands at all;
 * the digest answers one further question — did the check match the ARRIVING body, so a fence must
 * re-stamp it? — and only a fence asks it. So the digest runs where a fence lands and nowhere else, and
 * where it runs it decides the same as before: a matching check re-stamps over the fenced body; a stale
 * check stays stale (a fence never launders an edit into a match); a CRLF carrier whose check matches
 * its folded bytes re-stamps (the deserializer reads the folded bytes).
 *
 * CONTROLS: an eager digest turns the clean-carrier count red; a fence that never re-stamps turns the
 * match case red.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

const calls = { verdict: 0, verdictOf: 0 };
vi.mock("@lararium/memetic-frame", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/memetic-frame")>();
  return {
    ...real,
    verdict: (text: string) => { calls.verdict++; return real.verdict(text); },
    verdictOf: (text: string, shape: Parameters<typeof real.verdictOf>[1]) => { calls.verdictOf++; return real.verdictOf(text, shape); },
  };
});

const { stampCarrier, verdict } = await import("@lararium/memetic-frame");
const { deserializeCarrier } = await import("../src/deserializer.js");

const URI = "lar:///t/digest-lazy";
const carrier = (body: string): string => stampCarrier(
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${URI.slice(7)}"\n\`\`\`\n\n` +
  `${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`);
const SOUND = carrier("<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>");
const ORPHAN = carrier("<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nstray prose\n\n<<~/ahu>>");
const STALE = ORPHAN.replace(/ni:\/\/\/sha-256;[A-Za-z0-9_-]+/, "ni:///sha-256;0000000000000000000000000000000000000000000");

describe("★ the deserializer's digest runs only where a fence lands ★", () => {
  beforeEach(() => { calls.verdict = 0; calls.verdictOf = 0; });

  test("a carrier that decomposes is read without a digest", () => {
    const { floor } = deserializeCarrier(SOUND, { title: URI });
    expect(floor).toBeNull();
    expect(calls).toEqual({ verdict: 0, verdictOf: 0 });
  });

  test("a fence over a matching check re-stamps it, through one digest", () => {
    const { floor } = deserializeCarrier(ORPHAN, { title: URI });
    expect(floor).not.toBeNull();
    expect(calls).toEqual({ verdict: 0, verdictOf: 1 });
    expect(verdict(floor!.text).kind).toBe("match");
  });

  test("a fence over a stale check leaves it stale — a fence never launders an edit", () => {
    const { floor } = deserializeCarrier(STALE, { title: URI });
    expect(floor).not.toBeNull();
    expect(verdict(floor!.text).kind).toBe("stale");
  });

  test("a CRLF carrier whose check matches its folded bytes re-stamps over the fence", () => {
    const crlf = ORPHAN.replace(/\n/g, "\r\n");
    expect(verdict(crlf).kind).toBe("stale");
    const { floor } = deserializeCarrier(crlf, { title: URI });
    expect(floor).not.toBeNull();
    expect(verdict(floor!.text).kind).toBe("match");
  });
});
