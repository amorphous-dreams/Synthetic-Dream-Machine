/**
 * ONE TEXT, ONE GRADE — `check(text).grade` and `place(uri, text).grade` read the same text the same way.
 *
 * The mesh scenarist measured two readers over one witness carrier (a framed meme holding one
 * `<<~ ahu #/a>>…<<~/ahu>>` slot): the daemon's `place` graded it `warning` with `partial-form:ahu` and
 * `orphan-close:ahu`, while the browser face's `check` read `ok`. Both run INSIDE the VM, where the
 * grammar tiddlers hydrate the scans — so the split names the grammar's own `ahu` opener, not the
 * bootstrap scan a test outside the VM sees. Every claim here therefore asks the booted wiki's face.
 *
 * The CONTROLS: a closer with no opener grades `warning` on both readers (the parser stands it back up
 * as water); an opener whose closer never arrives grades `info` on both (a repaired frame). Both keep
 * the text, and both readers say the same thing about it.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";

const URI = "lar:///t.witness.npc/inventory";
/** The scenarist's witness meme, byte for byte (`tools/mesh-scenarios.sh run_meme` · `meme_text a`). */
const witness = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "t.witness.npc/inventory"\nbag = "backpack: rope, lantern"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n\n`).join("") +
  `<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;
/** The same carrier with its one slot torn: the opener stands, the closer never arrives. */
const unclosed = witness(["a"]).replace("<<~/ahu>>\n", "");
/** The same carrier with a closer no opener claims. */
const orphan = witness(["a"]).replace("<<~ ahu #/a>>\n", "");

describe.skipIf(wikiSkip)(`one text, one grade${skipNote}`, () => {
  let face: LaresMemeFace;
  beforeAll(async () => {
    const engine: TW5Engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  });

  test("the witness `#/a` slot parses whole inside the grammar-hydrated VM — no partial form, no orphan close", () => {
    const parsed = face.parse(URI, witness(["a"]));
    expect(parsed.failures.map((f) => f.reason)).toEqual([]);
  });

  test("`check` carries the grade `place` lands, and on the witness both read `clean`", async () => {
    const text = witness(["a"]);
    const checked = face.check(text);
    const placed = await face.place(URI, text);
    expect(placed.diagnostics.map((d) => d.code)).toEqual([]);
    expect(placed.grade).toBe("clean");
    expect(checked.grade).toBe(placed.grade);
    expect(placed.landed).toEqual([URI, `${URI}#/a`]);
  });

  test("CONTROL: a closer no opener claims grades `warning` on both readers", async () => {
    const checked = face.check(orphan);
    const placed = await face.place(`${URI}-orphan`, orphan.replaceAll(URI, `${URI}-orphan`));
    expect(checked.diagnostics.map((d) => d.code)).toEqual(["orphan-close:ahu"]);
    expect(checked.grade).toBe("warning");
    expect(placed.grade).toBe("warning");
    expect(placed.diagnostics.map((d) => d.code)).toEqual(checked.diagnostics.map((d) => d.code));
  });

  test("CONTROL: an opener whose closer never arrives grades `info` on both readers — repaired, text kept", async () => {
    const checked = face.check(unclosed);
    const placed = await face.place(`${URI}-unclosed`, unclosed.replaceAll(URI, `${URI}-unclosed`));
    expect(checked.diagnostics.map((d) => d.code)).toEqual(["unclosed-frame"]);
    expect(checked.grade).toBe("info");
    expect(placed.grade).toBe("info");
    expect(placed.diagnostics.map((d) => d.code)).toEqual(checked.diagnostics.map((d) => d.code));
  });
});

