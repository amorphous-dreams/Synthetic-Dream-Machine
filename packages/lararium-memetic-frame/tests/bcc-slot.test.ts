/**
 * THE CHECK RIDES ITS SLOT — Train R's frame law.
 *
 * The foot reads ``<<^ code=`&#x0003;` bcc=`ni:///sha-256;…`>>``: the block check rides the ETX mark's
 * declared `bcc` slot as a named value, and the digest reads the span with that one ` bcc=`…`` run
 * deleted (DKIM's `b=` emptied, RFC 6376 §3.7). So the canonical ETX reads ``<<^ code=`&#x0003;`>>``,
 * the very bytes every check minted before the cut already covers: the value moves, never changes.
 *
 * Every other ETX spelling tears before a digest runs, so the one deletion stays the only slack.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import {
  frameCarrier, stampCarrier, META_OPEN_CANON,
  checkSpan, bccOf, bccOfSpan, verifyBcc, verdict, classifyPostamble,
} from "../src/index.js";

const URI = "lar:///t/bcc-slot";
const BODY = `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse inside the checked body.`;
const ETX = "<<^ code=`&#x0003;`>>";

/** The pre-cut foot, built by hand so this file never leans on the writer it tests. */
const TRAILER_RE = /^<<\^ code=`&#x0003;`>>(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)$/m;
const bareCarrier = (body = BODY): string =>
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\n" +
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n<<^ code=\`&#x0002;\`>>\n\n${body}\n\n${ETX}\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
/** The span's digest over the bare ETX, computed straight from the bytes. */
const bareDigest = (text: string): string => {
  const start = text.indexOf("<<^ code=`&#x0002;`>>");
  const end = text.indexOf(ETX) + ETX.length;
  return bccOfSpan(text.slice(start, end));
};
const slotted = (text: string, value: string): string => text.replace(ETX, `<<^ code=\`&#x0003;\` bcc=\`${value}\`>>`);
const sealed = (body = BODY): string => { const t = bareCarrier(body); return slotted(t, bareDigest(t)); };

describe("★ the digest reads the span with the bcc run deleted ★", () => {
  test("a slotted check verifies, and its value equals the bare-ETX digest (zero churn)", () => {
    const t = sealed();
    expect(bccOf(t)).toBe(bareDigest(bareCarrier()));
    expect(verifyBcc(t)).toBe("ok");
    expect(verdict(t)).toEqual({ kind: "match", check: bareDigest(bareCarrier()) });
  });

  test("the span still closes on the ETX sigil's own >>, bcc run included", () => {
    const t = sealed();
    const sp = checkSpan(t)!;
    expect(t.slice(sp.start, sp.end).endsWith("`>>")).toBe(true);
    expect(t.slice(sp.start, sp.end)).toContain(" bcc=`ni:///sha-256;");
  });

  test("a body edit under a standing slot reads stale, with both digests", () => {
    const t = sealed();
    const edited = t.replace("Prose inside", "Prose moved inside");
    const v = verdict(edited);
    expect(v.kind).toBe("stale");
    expect(verifyBcc(edited)).toBe("mismatch");
  });

  test("an alg the reader never accepts reads stale, never match", () => {
    const t = slotted(bareCarrier(), "ni:///md5;AAAA");
    expect(verdict(t).kind).toBe("stale");
  });

  test("CONTROL: the bare ETX reads absent — a stripped run equals a check never stamped", () => {
    expect(verifyBcc(bareCarrier())).toBe("unchecked");
    expect(verdict(bareCarrier())).toEqual({ kind: "absent" });
  });
});

describe("★ every other ETX spelling tears before a digest runs ★", () => {
  const value = bareDigest(bareCarrier());
  const spelled = (etx: string): string => bareCarrier().replace(ETX, etx);
  const torn = (etx: string): string[] => {
    const v = verdict(spelled(etx));
    return v.kind === "torn" ? v.faults.map((f) => f.kind) : [v.kind];
  };

  test.each([
    ["a doubled run", `<<^ code=\`&#x0003;\` bcc=\`${value}\` bcc=\`${value}\`>>`],
    ["a run off its final seat", `<<^ code=\`&#x0003;\` bcc=\`${value}\` x=\`y\`>>`],
    ["a foreign param", "<<^ code=`&#x0003;` x=`y`>>"],
    ["an unticked value", `<<^ code=\`&#x0003;\` bcc=${value}>>`],
    ["a double-ticked value", `<<^ code=\`&#x0003;\` bcc=\`\`${value}\`\`>>`],
    ["an ill-shaped value", "<<^ code=`&#x0003;` bcc=`not-a-check`>>"],
    ["a doubled space", `<<^ code=\`&#x0003;\`  bcc=\`${value}\`>>`],
  ])("%s tears", (_name, etx) => {
    expect(torn(etx)).toContain("torn-spelling");
  });

  test("the two lawful spellings never tear", () => {
    expect(verdict(spelled(ETX)).kind).toBe("absent");
    expect(verdict(spelled(`<<^ code=\`&#x0003;\` bcc=\`${value}\`>>`)).kind).toBe("match");
  });
});

describe("★ the retired trailer refuses by name ★", () => {
  const trailer = (): string => { const t = bareCarrier(); return t.replace(ETX, ETX + bareDigest(t)); };

  test("a check standing after the ETX >> tears as retired-trailer, naming the cure", () => {
    const v = verdict(trailer());
    expect(v.kind).toBe("torn");
    if (v.kind !== "torn") return;
    const f = v.faults.find((x) => x.kind === "retired-trailer");
    expect(f?.message).toMatch(/grammar-cut/);
  });

  test("a check one space after the >> tears as retired-trailer too — never a second check beside a minted slot", () => {
    const t = bareCarrier(); const spaced = t.replace(ETX, `${ETX} ${bareDigest(t)}`);
    const v = verdict(spaced);
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toContain("retired-trailer");
    expect(stampCarrier(spaced)).toBe(spaced);
  });

  test("a sigil smuggled inside the bcc value tears; the reader anchors on the span reader's ETX", () => {
    const t = bareCarrier(); const value = bareDigest(t);
    const smuggled = t.replace(ETX, `<<^ code=\`&#x0003;\` bcc=\`x<<^ code=\`&#x0003;\` bcc=\`${value}\`>>`);
    expect(verdict(smuggled).kind).toBe("torn");
    expect(verifyBcc(smuggled)).toBe("torn");
  });

  test("nothing stands between ETX and EOT: a bare check there reads foreign", () => {
    expect(classifyPostamble(`\n${bareDigest(bareCarrier())}\n`).kind).toBe("foreign");
    expect(TRAILER_RE.test(trailer())).toBe(true);
  });
});

describe("★ the writers mint the slot ★", () => {
  test("frameCarrier mints the bcc run inside the ETX sigil, nothing after its >>", () => {
    const c = frameCarrier({ head: { uri: URI }, body: BODY });
    expect(c).toMatch(/\n<<\^ code=`&#x0003;` bcc=`ni:\/\/\/sha-256;[A-Za-z0-9_-]{43}`>>\n\n<<\^ code=`&#x0004;` to=`\?`>>\n$/);
    expect(verifyBcc(c)).toBe("ok");
  });

  test("stampCarrier mints the run on a bare ETX and replaces a stale one in place", () => {
    const minted = stampCarrier(bareCarrier());
    expect(minted).toBe(sealed());
    const stale = slotted(bareCarrier(), "ni:///sha-256;AAAA");
    expect(stampCarrier(stale)).toBe(sealed());
  });

  test("stampCarrier leaves a matching slotted carrier byte-identical", () => {
    expect(stampCarrier(sealed())).toBe(sealed());
  });
});

describe("★ verifyBcc and verdict never disagree on a frame fault ★", () => {
  test("RED: a second live ETX, and an ETX standing after EOT, read torn in verifyBcc as in verdict", () => {
    const second = sealed().replace("<<^ code=`&#x0004;` to=`?`>>", "<<^ code=`&#x0003;`>>\n\n<<^ code=`&#x0004;` to=`?`>>");
    const afterEot = sealed() + "\n<<^ code=`&#x0003;`>>\n";
    for (const t of [second, afterEot]) {
      expect(verdict(t).kind).toBe("torn");
      expect(verifyBcc(t)).toBe("torn");
    }
  });

  test("CONTROL: a clean sealed carrier reads ok in both", () => {
    expect(verdict(sealed()).kind).toBe("match");
    expect(verifyBcc(sealed())).toBe("ok");
  });
});
