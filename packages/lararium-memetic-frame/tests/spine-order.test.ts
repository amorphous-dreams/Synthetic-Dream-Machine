/**
 * THE SPINE HOLDS ITS ORDER — a mark standing out of spine order tears the frame.
 *
 * memetic-wikitext-framing #/carrier-spine: a carrier opens on its heading (SOH), enters its text (STX),
 * ends its text (ETX) and releases (EOT), "in this order"; #/conformance: "where the marks stand, spine
 * order MUST hold". A live release standing before the text closes, or a second live heading standing
 * inside the first carrier's frame, leaves a frame no reader divides without choosing: one reader closes
 * at the early release and drops checked bytes, another opens a carrier nobody wrote. Each is torn, its
 * fault named (#/the-touchstone: a second live mark is a fault, never a choice).
 */
import { describe, test, expect } from "vitest";
import { frameCarrier, readFrame, stampCarrier, verdict, META_OPEN_CANON } from "../src/index.js";

const URI = "lar:///t/spine";
const HEAD = (uri: string) => `<<^ code="&#x0001;" from="?" -> to="${uri}">>`;
const STX = '<<^ code="&#x0002;">>';
const EOT = '<<^ code="&#x0004;" -> to="?">>';
const carrier = frameCarrier({ head: { uri: URI }, body: `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse.` });
const kinds = (text: string): string[] => readFrame(text).faults.map((f) => f.kind);
const tornBy = (text: string): string[] => {
  const v = verdict(text);
  return v.kind === "torn" ? v.faults.map((f) => f.kind) : [`not torn: ${v.kind}`];
};

describe("★ spine order — an out-of-order release or heading tears the frame ★", () => {
  test("a release standing inside the text tears, even under a check that matches the span", () => {
    const text = stampCarrier(carrier.replace("Prose.", `Prose.\n\n${EOT}\n\nMore prose the check covers.`));
    expect(tornBy(text)).toContain("eot-out-of-order");
  });

  test("a release standing between the heading and STX tears", () => {
    const text = stampCarrier(carrier.replace(`${STX}`, `${EOT}\n${STX}`));
    expect(tornBy(text)).toContain("eot-out-of-order");
  });

  test("a release standing before STX tears where no ETX stands either", () => {
    expect(kinds(`${HEAD(URI)}\n${EOT}\n${STX}\n\nbody\n`)).toContain("eot-out-of-order");
  });

  test("a second heading standing inside the text tears — it never opens a carrier of its own", () => {
    const text = stampCarrier(carrier.replace("Prose.", `Prose.\n\n${HEAD("lar:///t/second")}\n`));
    expect(tornBy(text)).toContain("soh-inside-frame");
  });

  test("a second heading standing before STX tears", () => {
    const text = stampCarrier(carrier.replace(`${HEAD(URI)}`, `${HEAD(URI)}\n${HEAD("lar:///t/second")}`));
    expect(tornBy(text)).toContain("soh-inside-frame");
  });

  test("a heading standing ahead of the carrier's own heading tears", () => {
    expect(tornBy(stampCarrier(`${HEAD("lar:///t/second")}\n${carrier}`))).toContain("soh-inside-frame");
  });

  // CONTROL — the spine in order reads clean, and a QUOTED mark frames nothing (the fence mask).
  test("CONTROL — a carrier in spine order carries no spine fault, and quoted marks stay inert", () => {
    expect(kinds(carrier)).toEqual([]);
    expect(verdict(carrier).kind).toBe("match");
    const quoted = stampCarrier(carrier.replace("Prose.", `Prose.\n\n\`\`\`\n${EOT}\n${HEAD("lar:///t/q")}\n\`\`\`\n`));
    expect(kinds(quoted)).toEqual([]);
    expect(verdict(quoted).kind).toBe("match");
  });

  test("CONTROL — a head-only carrier released by its EOT reads absent, never torn", () => {
    expect(verdict(`${HEAD(URI)}\n\nprose\n\n${EOT}\n`)).toEqual({ kind: "absent" });
  });
});
