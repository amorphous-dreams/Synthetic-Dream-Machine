/**
 * meme-normalize — a tick VALUE inside a live sigil roots its `lar:` fragment.
 *
 * `fencedSpans` masks every backtick span as inline code, and a sigil's named value rides a backtick span
 * (``uri=`lar:///…#name` ``), so the rooting clause never met the one place a fragment lives. A tick span
 * inside a live `<<~ … >>` call stands as a VALUE (the clause roots it); a tick span in prose stays a code
 * example (the clause leaves it).
 */
import { describe, expect, test } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { CARRIER_DECLARATION as DECLARATION } from "@lararium/memetic-frame";

const HEAD = (body: string) =>
  `${DECLARATION}\n\n<<^ code=\`&#x0001;\` from=\`?\` to=\`lar:///x\`>>\n` +
  "```toml meta\ncacheable = true\n```\n\n<<^ code=`&#x0002;`>>\n\n" + body + "\n\n<<^ code=`&#x0003;`>>\n";

const URI = "lar:///ha.ka.ba/lares/api/pono/foo";

describe("lar: fragment rooting inside a sigil's tick value", () => {
  test("a ticked uri value roots an unrooted fragment", () => {
    const r = normalizeMemeSource(HEAD(`<<~ loulou uri=\`${URI}#bar\`>>`));
    expect(r.text).toContain(`<<~ loulou uri=\`${URI}#/bar\`>>`);
  });

  test("a ticked value roots on every sigil of a line, and a second pass converges", () => {
    const once = normalizeMemeSource(HEAD(`<<~ aka uri=\`${URI}#a\`>> and <<~ kanawai uri=\`${URI}#b\`>>`));
    expect(once.text).toContain(`${URI}#/a\``);
    expect(once.text).toContain(`${URI}#/b\``);
    expect(normalizeMemeSource(once.text).changed).toBe(false);
  });

  test("CONTROL: a code span in prose stays as authored", () => {
    const r = normalizeMemeSource(HEAD(`prose \`${URI}#bar\` prose`));
    expect(r.text).toContain(`\`${URI}#bar\``);
    expect(r.text).not.toContain("#/bar");
  });

  test("CONTROL: a ticked value inside a fenced example stays as authored", () => {
    const r = normalizeMemeSource(HEAD(`\`\`\`\n<<~ loulou uri=\`${URI}#bar\`>>\n\`\`\``));
    expect(r.text).toContain(`uri=\`${URI}#bar\``);
  });

  test("CONTROL: an already-rooted ticked value round-trips byte-unchanged", () => {
    const src = HEAD(`<<~ loulou uri=\`${URI}#/bar\`>>`);
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(src);
  });
});
