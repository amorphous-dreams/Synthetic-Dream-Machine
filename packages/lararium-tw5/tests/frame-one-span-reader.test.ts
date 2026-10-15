/**
 * ONE SPAN READER — every instrument that divides a carrier into its checked span reads ONE rule.
 *
 * The block check, the gradient, the deserializer and the writer each answer "where does the text
 * frame open and close?". When two of them answer differently, a carrier can verify over bytes the
 * deserializer never read, or lose bytes the check covered, and every instrument reads green.
 *
 * The canon (memetic-wikitext-framing #/control-set, #/frame-security): the span runs from the STX
 * sigil through the ETX sigil inclusive, read THROUGH THE FENCE MASK, and the check covers the FIRST
 * STX..ETX span only. A second live ETX is a malformed frame the reader SURFACES — never a choice it
 * makes quietly between the first and the last.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { bccOfSpan, frameStanding, verdict, verifyBcc } from "@lararium/memetic-frame";
import { expandMemeRefs, memeticWikitextDeserializer, type TiddlerFields } from "../src/deserializer.js";
import { memeticIngestOps } from "../src/ingest-gate.js";
import { readCarrierShape } from "../src/carrier-shape.js";

const URI = "lar:///tests/root-meta-body";
const FIXTURE = readFileSync(new URL("./fixtures/root-meta-body.mem", import.meta.url).pathname, "utf8");

function recordsOf(text: string): Map<string, TiddlerFields> {
  return new Map(memeticWikitextDeserializer(text, { title: URI }).map((r) => [String(r.title), r]));
}

/** A writer-minted carrier whose root body carries `extra` after its authored prose. */
function mintedWith(extra: string): string {
  const map = recordsOf(FIXTURE);
  const root = map.get(URI)!;
  root.text = `${String(root.text)}\n\n${extra}`;
  return expandMemeRefs((t) => map.get(t), URI)!;
}

/** The teaching document: a fenced STX..ETX example in the prologue, above the declaration. */
const TEACHING = [
  "A frame reads like this:",
  "",
  "```",
  '<<^ code="&#x0002;">>',
  "example body",
  '<<^ code="&#x0003;">>',
  "```",
  "",
  FIXTURE,
].join("\n");

describe("★ one span reader — the teaching document ★", () => {
  test("a fenced example above the frame never opens the checked span", () => {
    const st = frameStanding(TEACHING);
    expect(st.kind).toBe("framed");
    if (st.kind !== "framed") return;
    const span = TEACHING.slice(st.start, st.end);
    expect(span.startsWith('<<^ code="&#x0002;">>\n\n```toml meta')).toBe(true);
    expect(span).not.toContain("example body");
  });

  test("the check the writer minted verifies through the one reader, prologue example and all", () => {
    expect(verifyBcc(FIXTURE)).toBe("ok");
    expect(verifyBcc(TEACHING)).toBe("ok");
  });

  test("the deserializer's body is exactly the reader's body", () => {
    const st = frameStanding(TEACHING);
    if (st.kind !== "framed") throw new Error("fixture lost its frame");
    const body = TEACHING.slice(st.bodyStart, st.bodyEnd);
    const root = recordsOf(TEACHING).get(URI)!;
    expect(body).toContain(String(root.text).split("\n")[0]!);
    expect(st.faults).toEqual([]);
  });
});

describe("★ one span reader — a second live ETX is a fault, never a silent choice ★", () => {
  const stray = mintedWith('<<^ code="&#x0003;">>\n\nAFTER-STRAY prose');

  test("the reader names the second ETX", () => {
    const st = frameStanding(stray);
    expect(st.kind).toBe("framed");
    if (st.kind !== "framed") return;
    expect(st.faults.map((f) => f.kind)).toEqual(["second-etx"]);
    // THE CANON'S SPAN: first STX through the FIRST ETX after it.
    expect(stray.slice(st.start, st.end).endsWith('<<^ code="&#x0003;">>')).toBe(true);
    expect(stray.slice(st.end)).toMatch(/^\n\nAFTER-STRAY prose/);
  });

  test("the gradient surfaces the malformed frame", () => {
    expect(readCarrierShape(stray).faults.join("\n")).toMatch(/ETX/);
  });

  test("no byte between two ETX marks vanishes in silence — the deserializer raises an error", () => {
    const { records, diagnostics } = memeticIngestOps.deserialize(URI, stray, verdict(stray));
    const survives = records.some((r) => String(r.text ?? "").includes("AFTER-STRAY"));
    const surfaced = diagnostics.some((d) => d.severity === "error");
    expect(survives || surfaced).toBe(true);
    expect(surfaced).toBe(true);
  });

  test("CONTROL — the same carrier without the stray mark reads clean everywhere", () => {
    const clean = mintedWith("AFTER-STRAY prose");
    const st = frameStanding(clean);
    expect(st.kind === "framed" && st.faults.length === 0).toBe(true);
    expect(verifyBcc(clean)).toBe("ok");
    expect(memeticIngestOps.deserialize(URI, clean, verdict(clean)).diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(readCarrierShape(clean).faults).toEqual([]);
    expect(bccOfSpan("x")).toMatch(/^ni:\/\/\/sha-256;/);
  });
});
