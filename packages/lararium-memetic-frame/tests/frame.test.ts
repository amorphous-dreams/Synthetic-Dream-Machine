/**
 * The frame, measured alone: the writer mints what the ONE span reader divides, the check the writer
 * stamps is the check the verifier recomputes, and a malformed frame is named rather than resolved.
 */
import { describe, test, expect } from "vitest";
import {
  FRAME_MARKS, frameAlt, markCode,
  frameCarrier, stampCarrier, headSigil, CARRIER_DECLARATION,
  frameStanding, readFrame, checkSpan, verdict,
  verifyBcc, bccOf, bccOfSpan, classifyPostamble, classifyPostEot,
  matchCarrierHead, META_OPEN_CANON,
} from "../src/index.js";

const URI = "lar:///t/frame";
const BODY = `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse inside the checked body.`;

describe("the writer", () => {
  const carrier = frameCarrier({ head: { uri: URI }, body: BODY });

  test("mints the canonical shape, byte for byte", () => {
    expect(carrier).toBe(
      `${CARRIER_DECLARATION}\n\n` +
      `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n` +
      `<<^ code="&#x0002;">>\n\n${BODY}\n\n<<^ code="&#x0003;">>${bccOf(carrier)}\n` +
      `\n<<^ code="&#x0004;" -> to="?">>\n`,
    );
  });

  test("what it stamps, the verifier reads ok; the head names the address", () => {
    expect(verifyBcc(carrier)).toBe("ok");
    expect(matchCarrierHead(carrier)?.uri).toBe(URI);
    expect(classifyPostEot(carrier)).toEqual({ kind: "empty" });
  });

  test("the reader's body is exactly the body handed in", () => {
    const st = frameStanding(carrier);
    if (st.kind !== "framed") throw new Error("unframed");
    expect(carrier.slice(st.bodyStart, st.bodyEnd)).toBe(`\n\n${BODY}\n\n`);
    expect(st.faults).toEqual([]);
  });

  test("namespace, Kapu head, prologue and postamble all land in their positions — ETB retired with $carrier-sila, no attestation slot stands", () => {
    const full = frameCarrier({
      head: { uri: URI, namespace: "⊙", kapu: true }, body: "b",
      prologue: "above\n\n", postamble: "\n\nbelow\n",
    });
    expect(full.startsWith(`above\n\n${CARRIER_DECLARATION}`)).toBe(true);
    expect(full).toContain(headSigil({ uri: URI, namespace: "⊙", kapu: true }));
    expect(full).toContain('<<^ code="&#x0011;" namespace="⊙" from="?" -> to="lar:///t/frame">>');
    expect(full).not.toContain("&#x0017;");
    expect(full.endsWith(`<<^ code="&#x0004;" -> to="?">>\nbelow\n`)).toBe(true);
    expect(verifyBcc(full)).toBe("ok");
  });

  test("RED: a carrier carrying a literal ETB mark reads as a retired spelling, torn", () => {
    const carrier = frameCarrier({ head: { uri: URI }, body: BODY });
    const withEtb = carrier.replace(
      /<<\^ code="&#x0004;" -> to="\?">>/,
      `\nsila\n<<^ code="&#x0017;">>\n<<^ code="&#x0004;" -> to="?">>`,
    );
    const v = verdict(withEtb);
    expect(v.kind).toBe("torn");
    if (v.kind === "torn") {
      expect(v.faults.some((f) => f.kind === "retired-spelling" && f.message.includes("ETB"))).toBe(true);
    }
  });

  test("declaration: null omits the line", () => {
    expect(frameCarrier({ head: { uri: URI }, body: "b", declaration: null }).startsWith("<<^ code=")).toBe(true);
  });
});

describe("stampCarrier — the body first, the check last", () => {
  const carrier = frameCarrier({ head: { uri: URI }, body: BODY });

  test("a patched body re-stamps to ok; an ok carrier comes back unchanged", () => {
    const patched = carrier.replace("Prose inside", "Edited prose inside");
    expect(verifyBcc(patched)).toBe("mismatch");
    expect(verifyBcc(stampCarrier(patched))).toBe("ok");
    expect(stampCarrier(carrier)).toBe(carrier);
  });

  test("a drifted check is REPLACED, never left beside a second", () => {
    const want = bccOf(carrier)!;
    const drifted = carrier.replace(`>>${want}`, `>> ${want}`);
    const stamped = stampCarrier(drifted);
    expect(stamped.split("ni:///").length - 1).toBe(1);
    expect(verifyBcc(stamped)).toBe("ok");
  });

  test("an unchecked frame gains its check; a torn one gains nothing", () => {
    const bare = carrier.replace(bccOf(carrier)!, "");
    expect(verifyBcc(bare)).toBe("unchecked");
    expect(stampCarrier(bare)).toBe(carrier);
    const torn = carrier.slice(0, carrier.indexOf('<<^ code="&#x0003;">>'));
    expect(stampCarrier(torn)).toBe(torn);
  });
});

describe("the ONE span reader", () => {
  const carrier = frameCarrier({ head: { uri: URI }, body: BODY });

  test("a fenced example of every mark is quoted, never framed", () => {
    const lesson = "```\n" + FRAME_MARKS.map((m) => `<<^ code="${m.code}">>`).join("\n") + "\n```\n\n";
    const taught = lesson + carrier;
    expect(checkSpan(taught)).toEqual({ start: checkSpan(carrier)!.start + lesson.length, end: checkSpan(carrier)!.end + lesson.length });
    expect(verifyBcc(taught)).toBe("ok");
    expect(readFrame(taught).faults).toEqual([]);
  });

  test("★ a second live ETX closes nothing past the first, and the reader NAMES it ★", () => {
    const stray = frameCarrier({ head: { uri: URI }, body: `${BODY}\n\n<<^ code="&#x0003;">>\n\nafter` });
    const st = frameStanding(stray);
    if (st.kind !== "framed") throw new Error("unframed");
    expect(stray.slice(st.end)).toMatch(/^\n\nafter/);
    expect(st.faults.map((f) => f.kind)).toEqual(["second-etx"]);
    // the writer's own check covered both ETX — the reader's first-ETX span cannot verify it in silence
    expect(verifyBcc(stray)).not.toBe("ok");
  });

  test("an ETX ahead of the STX and a second STX are named too", () => {
    expect(readFrame(`<<^ code="&#x0003;">>\n${carrier}`).faults.map((f) => f.kind)).toEqual(["etx-before-stx"]);
    expect(readFrame(`${carrier}\n<<^ code="&#x0002;">>\n`).faults.map((f) => f.message).join("\n")).toMatch(/2 text frames/);
  });

  test("torn and absent stay distinct", () => {
    expect(frameStanding("no frame here").kind).toBe("absent");
    expect(frameStanding('<<^ code="&#x0002;">>\nbody').kind).toBe("torn");
    expect(verifyBcc('<<^ code="&#x0002;">>\nbody')).toBe("torn");
    expect(verifyBcc("no frame here")).toBe("unchecked");
  });
});

describe("the check", () => {
  test("RFC 6920 form, full width, canonical-or-reject", () => {
    expect(bccOfSpan("")).toBe("ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU");
  });

  test("a foreign algorithm refuses — the message names, the reader decides", () => {
    const c = frameCarrier({ head: { uri: URI }, body: "b" });
    expect(verifyBcc(c.replace("ni:///sha-256;", "ni:///md5;"))).toBe("mismatch");
  });

  test("the slot classifier: empty, check, foreign", () => {
    expect(classifyPostamble("\n\n")).toEqual({ kind: "empty" });
    expect(classifyPostamble(`${bccOfSpan("x")}\n\n<<^ code="&#x0004;" -> to="?">>\n`).kind).toBe("bcc");
    expect(classifyPostamble("stranded prose\n").kind).toBe("foreign");
  });
});

describe("the marks", () => {
  test("a family alternation spells every variant, non-capturing", () => {
    expect(frameAlt("SOH")).toBe("&#x(?:0001|0011);");
    // A family matches exactly the marks that declare it — EOT's family holds one mark, so it alone.
    expect(frameAlt("EOT")).toBe("&#x(?:0004);");
    expect(new RegExp(frameAlt("EOT")).test("&#x0014;")).toBe(false);
    expect(() => markCode("NOPE")).toThrow();
    // NO FAMILY NAMES EVERY MARK — a line-walker's "is this a frame sigil at all?"
    const every = new RegExp(`^${frameAlt()}$`);
    for (const m of FRAME_MARKS) expect(every.test(m.code), m.name).toBe(true);
    expect(every.test("&#x0005;")).toBe(false);
  });
});
