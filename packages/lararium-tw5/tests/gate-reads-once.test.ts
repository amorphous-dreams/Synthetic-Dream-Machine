/**
 * THE GATE THREADS ITS READING — the frame is read once per decision, and the carrier once per deserialize.
 *
 * `decideIngest` reads the frame verdict and hands it to the family's `deserialize`; the deserializer's
 * reading (`CarrierReading`: the folded text, each carrier's division and ahu scan, the slot past ETX)
 * is what `checkCarrier` reads; and the structure the disk declares is read off the text the records
 * were split from — the floor `deserialize` already laid — rather than laying it a second time.
 *
 * The mask budget counts the fence-mask reads the tw5 side makes over one carrier's deserialize: a
 * second division, a second stream read, a second floor each move it.
 *
 * CONTROLS: the declared set equals `declaredStructure` over plain, fenced, CRLF and BOM disks; content
 * stranded past ETX is still reported; a torn carrier still refuses at error grade.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const calls = { verdict: 0, verdictOf: 0, fencedSpans: 0 };
vi.mock("@lararium/memetic-frame", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/memetic-frame")>();
  return {
    ...real,
    verdict: (text: string) => { calls.verdict++; return real.verdict(text); },
    verdictOf: (text: string, shape: Parameters<typeof real.verdictOf>[1]) => { calls.verdictOf++; return real.verdictOf(text, shape); },
    fencedSpans: (text: string) => { calls.fencedSpans++; return real.fencedSpans(text); },
  };
});

const { stampCarrier, verdict } = await import("@lararium/memetic-frame");
const { decideIngest, memeticIngestOps } = await import("../src/ingest-gate.js");

const URI = "lar:///t/gate-reads-once";
const carrier = (body: string): string => stampCarrier(
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${URI.slice(7)}"\n\`\`\`\n\n` +
  `${body}\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`);
const SOUND = carrier("<<~ ahu #/a>>\n\n! a\n\n<<~ ahu #/a/b>>\nb\n<<~/ahu>>\n\n<<~/ahu>>\n\nprose");
const FENCED = carrier("<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\nstray prose\n\n<<~/ahu>>");
const sha = (s: string): string => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const zero = (): void => { calls.verdict = 0; calls.verdictOf = 0; calls.fencedSpans = 0; };

/** Measured: the fence-mask reads one sound carrier's deserialize makes on the tw5 side (29 before the
 *  gate threaded its reading). A BUDGET ONLY EVER LOWERS. */
const MASK_BUDGET = 19;

describe("★ the gate threads its reading ★", () => {
  beforeEach(zero);

  test("the frame verdict is read once per decision", () => {
    decideIngest({ uri: URI, diskText: SOUND, diskHash: sha(SOUND), syncedHash: null, currentRenderHash: sha("x"), hash: sha });
    expect(calls.verdict + calls.verdictOf).toBe(1);
  });

  test("one deserialize stays inside the mask budget", () => {
    memeticIngestOps.deserialize(URI, SOUND, verdict(SOUND));
    expect(calls.fencedSpans).toBeLessThanOrEqual(MASK_BUDGET);
  });

  test("the structure the disk declares rides the deserialize, equal to declaredStructure", () => {
    for (const disk of [SOUND, FENCED, SOUND.replace(/\n/g, "\r\n"), `﻿${SOUND}`, FENCED.replace(/\n/g, "\r\n")]) {
      const { declared } = memeticIngestOps.deserialize(URI, disk, verdict(disk));
      expect([...declared].sort()).toEqual([...memeticIngestOps.declaredStructure(disk)].sort());
    }
    expect([...memeticIngestOps.deserialize(URI, SOUND, verdict(SOUND)).declared].sort()).toEqual(["#/a", "#/a/b"]);
    expect(memeticIngestOps.deserialize(URI, FENCED, verdict(FENCED)).declared.size).toBe(0);
  });

  test("CONTROL — content stranded past ETX is still reported, read off the reading", () => {
    const stranded = SOUND.replace(/(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)\n/, "$1\nstray line one\nstray line two\n");
    const codes = memeticIngestOps.deserialize(URI, stranded, verdict(stranded)).diagnostics.map((d) => d.code);
    expect(codes).toContain("postamble-content");
  });

  test("CONTROL — a torn carrier still refuses at error grade", () => {
    const torn = SOUND.replace('<<^ code="&#x0003;">>', "");
    const decision = decideIngest({ uri: URI, diskText: torn, diskHash: sha(torn), syncedHash: null, currentRenderHash: sha("x"), hash: sha });
    expect(decision.kind).toBe("refuse");
    expect(memeticIngestOps.grade(memeticIngestOps.deserialize(URI, torn, verdict(torn)).diagnostics)).toBe("error");
  });
});
