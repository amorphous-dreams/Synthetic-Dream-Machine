// vm-grammar-boundary: exempt — reads the decomposer's own split (`memeticWikitextDeserializer`) to weld the read gradient's slot
// list to the stored family; it drives no meme-ast parse of its own.
/**
 * read-gradient — the slot list a read answers IS the stored family's (cold read #444, H1).
 *
 * A has-stack that drops a slot misreports the meme silently; `--slot` that refuses a real slot, or a page that carries eighteen
 * slots as one, breaks the gradient's own promise. The scanner reads the decomposer's own ahu scan (fence and inline-code mask,
 * the line law), so a quoted opener or closer never moves the depth.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { carrierFiles } from "../src/carrier-files.js";
import { carrierSlots, carrierSlotText, pageCarrier, READ_PAGE_BYTES } from "../src/read-gradient.js";

const REPO = new URL("../../..", import.meta.url).pathname;
const MEMETIC_WIKITEXT = `${REPO}bags/lares/ha.ka.ba/lares/api/pono/memetic-wikitext.mem`;

/** The top-level slots the decomposer stores for a carrier, in order, or null where it declares no address. */
function storedSlots(text: string): string[] | null {
  const uri = /^uri-path\s*=\s*"([^"]+)"/m.exec(text)?.[1];
  if (!uri) return null;
  const root = `lar:///${uri}`;
  let records: Array<Record<string, unknown>>;
  try { records = memeticWikitextDeserializer(text, { title: root }) as Array<Record<string, unknown>>; }
  catch { return null; }
  return records.map((r) => String(r["title"] ?? "")).filter((t) => t.startsWith(`${root}#/`) && !t.slice(root.length + 2).includes("/") && !t.includes("#/$"))
    .map((t) => t.slice(root.length));
}

describe("the read gradient's slots are the stored family's", () => {
  test("RED H1: memetic-wikitext.mem (inline-code ahu openers in its prose) reads every top-level slot the family stores", () => {
    const text = readFileSync(MEMETIC_WIKITEXT, "utf8");
    const stored = storedSlots(text)!;
    expect(stored.length).toBeGreaterThan(20);
    expect(carrierSlots(text).map((s) => s.slot)).toEqual(stored);
    expect(carrierSlotText(text, "#/grammar")).not.toBeNull();
  });

  test("RED H1: a quoted closer in inline code closes nothing; a quoted opener opens nothing", () => {
    const text = [
      "<<^ code=`&#x0001;` from=`?` to=`lar:///t/q`>>", "<<^ code=`&#x0002;`>>", "",
      "<<~ ahu slot=`#/a`>>", "", "! a", "", "a closer quoted inline: ``<<~/ahu>>`` and an opener: ``<<~ ahu slot=`#/fake`>>``", "", "<<~/ahu>>", "",
      "<<~ ahu slot=`#/b`>>", "", "! b", "", "<<~/ahu>>", "",
      "<<^ code=`&#x0003;`>>", "",
    ].join("\n");
    expect(carrierSlots(text).map((s) => s.slot)).toEqual(["#/a", "#/b"]);
    expect(carrierSlotText(text, "#/a")).toContain("an opener");
    expect(carrierSlotText(text, "#/b")).toMatch(/^<<~ ahu slot=`#\/b`>>[\s\S]*<<~\/ahu>>\n$/);
  });

  test("WITNESS: for every canon carrier, the scanner's top-level slots equal the stored family's, and no page outgrows a page unless one slot does", () => {
    const off: string[] = [];
    let checked = 0;
    for (const listed of carrierFiles(REPO)) {
      const file = listed.startsWith("/") ? listed : `${REPO}${listed}`;
      const text = readFileSync(file, "utf8");
      const stored = storedSlots(text);
      if (stored === null) continue;
      checked++;
      const read = carrierSlots(text);
      if (read.map((s) => s.slot).join(" ") !== stored.join(" ")) off.push(`${file.slice(REPO.length)}: read ${read.length} of ${stored.length}`);
      const biggest = Math.max(0, ...read.map((s) => s.bytes));
      for (let page = pageCarrier(text, "h".repeat(16), null); ; page = pageCarrier(text, "h".repeat(16), page.next)) {
        const size = new TextEncoder().encode(page.text).length;
        if (size > READ_PAGE_BYTES && size > biggest + 4096) off.push(`${file.slice(REPO.length)}: page ${page.page} carries ${size} bytes`);
        if (!page.next) break;
      }
    }
    expect(off).toEqual([]);
    expect(checked, "the witness reads the canon, never an empty walk").toBeGreaterThan(500);
  });
});
