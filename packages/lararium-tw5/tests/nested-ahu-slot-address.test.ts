/**
 * A NESTED SLOT OPEN CARRIES ITS WHOLE PATH FROM THE CARRIER ROOT (canon, enforced by
 * meme-normalize.ts's child-slot clause) — `<<~ ahu #/observe>> … <<~ ahu #/observe/observe-ha>>
 * … <<~/ahu>> … <<~/ahu>>` names the child at `#/observe/observe-ha`, never
 * `#/observe/observe/observe-ha`. The deserializer's `composeSlotPath` used to suffix-append the
 * nested open's (already-full) path onto its parent's prefix a second time, doubling the shared
 * segment. Live corpus: bags/lares/ha.ka.ba/lares/docs/history/dreamnet-memewiki.mem.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, test, expect } from "vitest";
import { frameCarrier } from "@lararium/memetic-frame";
import { memeticWikitextDeserializer } from "../src/deserializer.js";

const CORPUS_PATH = resolve(
  import.meta.dirname,
  "../../../bags/lares/ha.ka.ba/lares/docs/history/dreamnet-memewiki.mem",
);

describe("★ a nested ahu open addresses its full path exactly once ★", () => {
  test("live corpus: dreamnet-memewiki.mem's #/observe children never double their segment", () => {
    const text = readFileSync(CORPUS_PATH, "utf8");
    const uri = text.match(/to="([^"]+)"/)?.[1] ?? "lar:///ha.ka.ba/lares/docs/history/dreamnet-memewiki";
    const titles = memeticWikitextDeserializer(text, { title: uri }).map((r) => String(r.title));

    expect(titles).toContain(`${uri}#/observe/observe-ha`);
    expect(titles).toContain(`${uri}#/observe/observe-ka`);
    expect(titles).toContain(`${uri}#/observe/observe-ba`);
    // CONTROL: the doubled form a re-prefixing bug would mint never appears.
    for (const t of titles) expect(t).not.toMatch(/#\/observe\/observe\/observe-/);
  });

  test("synthetic 3-deep: #/a → #/a/b → #/a/b/c addresses exactly, no doubled segment", () => {
    const uri = "lar:///t/deep";
    const text = frameCarrier({
      head: { uri },
      body:
        "<<~ ahu #/a>>\n\n" +
        "<<~ ahu #/a/b>>\n\n" +
        "<<~ ahu #/a/b/c>>\n\nleaf\n\n<<~/ahu>>\n\n" +
        "<<~/ahu>>\n\n" +
        "<<~/ahu>>\n",
    });
    const titles = memeticWikitextDeserializer(text, { title: uri }).map((r) => String(r.title));

    expect(titles).toContain(`${uri}#/a`);
    expect(titles).toContain(`${uri}#/a/b`);
    expect(titles).toContain(`${uri}#/a/b/c`);
    for (const t of titles) {
      expect(t).not.toMatch(/#\/a\/a\b/);
      expect(t).not.toMatch(/#\/a\/b\/a\/b\b/);
      expect(t).not.toMatch(/#\/a\/b\/c\/a\/b\/c\b/);
    }
  });
});
