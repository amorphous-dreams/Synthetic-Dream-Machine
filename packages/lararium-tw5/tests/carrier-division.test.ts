/**
 * ONE FILE, ONE CARRIER, DIVIDED BY THE ONE SPAN READER.
 *
 * The frame frames records (memetic-wikitext-framing #/frame-security: "a carrier travels whole"); a
 * stream of carriers belongs to the SYN-framed profile, never to this one. So the deserializer reads
 * ONE carrier per text: the live heading opens it, and the span reader (`readFrame`, under one fence
 * mask over the whole text) says where it closes — at the first live ETX after the first live STX
 * (#/control-set: "closes on the first unmasked ETX AFTER it"), at the release where no text frame
 * stands. Bytes above the heading ride as the prologue; bytes past the release as the postamble; the
 * slot between ETX and EOT carries the check alone.
 *
 * Each fixture pins the GRAMMAR's answer, cited, never a reader's habit: no ahu sigil, quoted mark, or
 * mark spelled outside the control head moves a close.
 */
import { describe, test, expect } from "vitest";
import { CARRIER_DECLARATION } from "@lararium/memetic-frame";
import { carrierText, deserializeCarrier } from "../src/deserializer.js";

const URI = "lar:///t/division";
const HEAD = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
const STX = '<<^ code="&#x0002;">>';
const ETX = '<<^ code="&#x0003;">>';
const EOT = '<<^ code="&#x0004;" -> to="?">>';
const META = '```toml meta\nuri-path = "t/division"\n```';
const framed = (body: string): string => `${HEAD}\n${STX}\n\n${META}\n\n${body}\n\n${ETX}\n\n${EOT}\n`;
/** The carrier's own bytes: heading through the mark that closes it. */
const divided = (text: string): string | undefined => carrierText(text, URI)?.text;

describe("★ the one carrier a text carries — heading to close, through the span reader ★", () => {
  test("a framed carrier runs from its heading through its ETX (#/carrier-spine)", () => {
    const text = `${CARRIER_DECLARATION}\n\n${framed("body")}`;
    expect(divided(text)).toBe(`${HEAD}\n${STX}\n\n${META}\n\nbody\n\n${ETX}`);
    expect(carrierText(text, "lar:///t/base")?.uri).toBe(URI);
  });

  test("an ahu opener with no closer never moves the close — the text closes at its first ETX (#/control-set)", () => {
    const text = framed("<<~ ahu #/a>>\nopened, never closed");
    expect(divided(text)).toBe(`${HEAD}\n${STX}\n\n${META}\n\n<<~ ahu #/a>>\nopened, never closed\n\n${ETX}`);
  });

  test("ahu sigils of every spelling leave the close where the span reader puts it", () => {
    const body = "<<~ ahu #/c -> lar:///x/y>>\nc\n<<~ / ahu>>\n<<fragment #/f>>\nf";
    expect(divided(framed(body))!.endsWith(`${body}\n\n${ETX}`)).toBe(true);
  });

  test("with no STX, the text closes at the ETX the span reader finds (span.ts `readFrame`)", () => {
    const text = `${HEAD}\nprose\n\n${ETX}\n\n${EOT}\n`;
    expect(divided(text)).toBe(`${HEAD}\nprose\n\n${ETX}`);
  });

  test("a heading-only carrier closes at its release (#/carrier-spine: absent marks read at their gradient)", () => {
    const text = `${HEAD}\n\nprose\n\n${EOT}\ntrailing\n`;
    expect(divided(text)).toBe(`${HEAD}\n\nprose\n\n${EOT}`);
  });

  test("a quoted mark frames nothing — the fence mask (#/the-touchstone)", () => {
    const body = "```\n" + `${ETX}\n${EOT}` + "\n```\n\nafter the lesson";
    expect(divided(framed(body))!.endsWith(`after the lesson\n\n${ETX}`)).toBe(true);
  });

  test("an EOT or ETX spelled outside the control head is no mark, and closes nothing (#/frame-head-lock)", () => {
    for (const notAMark of ['<<~ -> "?">>', '<<~ code="&#x0004;" -> "?">>', '<<^ code="&#x0014;" -> to="?">>']) {
      const text = `${HEAD}\n${STX}\n\nbody\n${notAMark}\nstill body\n\n${ETX}\n\n${EOT}\n`;
      expect(divided(text)!.endsWith(`still body\n\n${ETX}`)).toBe(true);
    }
  });

  test("the prologue rides above the heading and the postamble past the release; the declaration is the frame's", () => {
    const text = `${CARRIER_DECLARATION}\n\nabove\n\n${framed("body")}below\n`;
    const titles = deserializeCarrier(text, { title: URI }).records.map((r) => String(r.title));
    expect(titles).toEqual(expect.arrayContaining([URI, `${URI}#/$prologue`, `${URI}#/$postamble`]));
  });

  test("a text with no heading is one body under the title it arrives with", () => {
    expect(carrierText("bare prose\n", "lar:///t/base")).toEqual({ uri: "lar:///t/base", text: "bare prose\n" });
    expect(carrierText("  \n", "lar:///t/base")).toBeNull();
  });
});
