/**
 * THE FRAME VERDICT — one value, carrying its evidence, over the bytes alone.
 *
 * `verdict(text)` answers what the frame says about a text before any grammar reads it: the check
 * matches (`match`), stands stale with both digests in hand (`stale`), was never stamped on a framed
 * carrier (`absent`), cannot be divided without choosing (`torn`, its faults named), or no frame
 * stands at all (`bare` — not a meme).
 */
import { describe, test, expect } from "vitest";
import { frameCarrier, bccOf, verdict, META_OPEN_CANON } from "../src/index.js";

const URI = "lar:///t/verdict";
const carrier = frameCarrier({ head: { uri: URI }, body: `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse.` });
const STX = '<<^ code="&#x0002;">>';
const ETX = '<<^ code="&#x0003;">>';
const CHECK = /ni:\/\/\/sha-256;[A-Za-z0-9_-]+/;
const STALE = "ni:///sha-256;0000000000000000000000000000000000000000000";

describe("★ verdict(text) ★", () => {
  test("a stamped carrier matches, and names the check it read", () => {
    expect(verdict(carrier)).toEqual({ kind: "match", check: bccOf(carrier) });
  });

  test("a stale check carries BOTH digests — the one standing and the one the bytes compute", () => {
    expect(verdict(carrier.replace(CHECK, STALE))).toEqual({ kind: "stale", stored: STALE, computed: bccOf(carrier) });
  });

  test("a check naming an algorithm the reader refuses reads stale, never match", () => {
    const foreign = carrier.replace(CHECK, "ni:///md5;AAAA");
    expect(verdict(foreign)).toMatchObject({ kind: "stale", stored: "ni:///md5;AAAA" });
  });

  test("a framed carrier holding no check reads absent", () => {
    expect(verdict(carrier.replace(CHECK, ""))).toEqual({ kind: "absent" });
  });

  test("a head-only carrier (no text frame) reads absent — it carries a frame, never a check", () => {
    expect(verdict(`<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\nprose\n\n<<^ code="&#x0004;" -> to="?">>\n`)).toEqual({ kind: "absent" });
  });

  test("STX with no ETX reads torn, the missing close named", () => {
    const v = verdict(carrier.slice(0, carrier.indexOf(ETX)));
    expect(v.kind).toBe("torn");
    if (v.kind === "torn") expect(v.faults.map((f) => f.kind)).toEqual(["no-etx"]);
  });

  test("a second live ETX reads torn", () => {
    const v = verdict(carrier.replace(ETX, `${ETX}\n\nstray\n\n${ETX}`));
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["second-etx"]);
  });

  test("an ETX ahead of the STX reads torn", () => {
    const v = verdict(carrier.replace(STX, `${ETX}\n${STX}`));
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["etx-before-stx"]);
  });

  test("a second STX alone tears — one file frames one carrier; a stream belongs to the SYN profile", () => {
    const v = verdict(carrier.replace(ETX, `${ETX}\n\n${STX}`));
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["second-stx"]);
  });

  test("a toml meta fence standing before STX reads torn — root metadata opens the body, below STX", () => {
    const pre = carrier.replace(`${STX}\n\n${META_OPEN_CANON}`, `${META_OPEN_CANON}`).replace("```\n\nProse.", `\`\`\`\n\n${STX}\n\nProse.`);
    expect(pre).not.toBe(carrier);
    const v = verdict(pre);
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["meta-before-stx"]);
  });

  test("CONTROL: a QUOTED meta fence before STX frames nothing and faults nothing", () => {
    const quoted = carrier.replace(STX, "````\n```toml meta\nk = 1\n```\n````\n" + STX);
    expect(verdict(quoted).kind).not.toBe("torn");
  });

  describe("★ a retired frame spelling reads torn, never repaired ★", () => {
    const HEAD = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    const EOT = `<<^ code="&#x0004;" -> to="?">>`;
    const retired: Record<string, string> = {
      "a bare `?` on the head": carrier.replace(HEAD, `<<^ code="&#x0001;" from=? -> to="${URI}">>`),
      "an unquoted target": carrier.replace(HEAD, `<<^ code="&#x0001;" from="?" -> to=${URI}>>`),
      "a positional head": carrier.replace(HEAD, `<<^ code="&#x0001;" ? -> ${URI}>>`),
      "glyphs before the code": carrier.replace(HEAD, `<<^ॐ&#x0001; from="?" -> to="${URI}">>`),
      "a bare `?` on the release": carrier.replace(EOT, `<<^ code="&#x0004;" -> to=?>>`),
      "a positional release": carrier.replace(EOT, `<<^ code="&#x0004;" -> ?>>`),
      "an older declaration": carrier.replace(/^<<!DOCTYPE[^\n]*/, "<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///x>>"),
    };
    for (const [name, text] of Object.entries(retired)) {
      test(name, () => {
        expect(text).not.toBe(carrier);
        const v = verdict(text);
        expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["torn-spelling"]);
      });
    }
    test("CONTROL: the canonical head and release carry no tear", () => {
      expect(verdict(carrier).kind).toBe("match");
    });
  });

  test("NO frame at all reads bare — not a meme", () => {
    expect(verdict("bare data found on the internet\n\n```toml meta\nk = 1\n```\n")).toEqual({ kind: "bare" });
  });

  test("CONTROL: a QUOTED frame is still bare — a fenced mark frames nothing", () => {
    expect(verdict(`prose\n\n\`\`\`\n${STX}\n${ETX}\n\`\`\`\n`)).toEqual({ kind: "bare" });
  });
});
